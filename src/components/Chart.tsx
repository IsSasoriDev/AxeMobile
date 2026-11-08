import { useMemo, useRef, useState } from "react";
import type { Point } from "@/api";
import { hashStr, num } from "@/format";

type Key = "hashrate" | "temp" | "power";

const fmt: Record<Key, (v: number) => string> = {
  hashrate: (v) => hashStr(v),
  temp: (v) => `${num(v, 1)} °C`,
  power: (v) => `${num(v, 1)} W`,
};

/** Area chart with an optional second line on its own scale. */
export function Chart({ points, main = "hashrate", second, height = 170 }: { points: Point[]; main?: Key; second?: Key; height?: number }) {
  const ref = useRef<SVGSVGElement>(null);
  const [hover, setHover] = useState<number | null>(null);
  const W = 800;
  const H = height;
  const pad = { l: 4, r: 4, t: 12, b: 6 };

  const geo = useMemo(() => {
    const pts = points.filter((p) => p[main] !== null);
    if (pts.length < 2) return null;
    const t0 = pts[0].t;
    const t1 = pts[pts.length - 1].t;
    const sx = (t: number) => pad.l + ((t - t0) / Math.max(1, t1 - t0)) * (W - pad.l - pad.r);
    const mk = (k: Key) => {
      const vals = pts.map((p) => p[k]).filter((v): v is number => v !== null);
      if (vals.length < 2) return null;
      let lo = Math.min(...vals);
      let hi = Math.max(...vals);
      if (k === "hashrate") lo = Math.max(0, lo - (hi - lo) * 0.6 - hi * 0.02);
      if (hi - lo < 1e-9) {
        hi += 1;
        lo -= 1;
      }
      const sy = (v: number) => pad.t + (1 - (v - lo) / (hi - lo)) * (H - pad.t - pad.b);
      const xy = pts.filter((p) => p[k] !== null).map((p) => [sx(p.t), sy(p[k] as number)] as const);
      const line = xy.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join("");
      return { line, xy };
    };
    const a = mk(main)!;
    const area = `${a.line}L${a.xy[a.xy.length - 1][0]},${H}L${a.xy[0][0]},${H}Z`;
    return { pts, a, area, b: second ? mk(second) : null, sx, t0, t1 };
  }, [points, main, second, H]);

  if (!geo) return <div className="chart empty" style={{ height }}>Collecting history…</div>;

  const onMove = (e: React.MouseEvent) => {
    const box = ref.current!.getBoundingClientRect();
    const x = ((e.clientX - box.left) / box.width) * W;
    let best = 0;
    let bd = Infinity;
    geo.pts.forEach((p, i) => {
      const d = Math.abs(geo.sx(p.t) - x);
      if (d < bd) {
        bd = d;
        best = i;
      }
    });
    setHover(best);
  };
  const hp = hover !== null ? geo.pts[hover] : null;
  const span = geo.t1 - geo.t0;
  const tl = (t: number) => {
    const d = new Date(t * 1000);
    return span > 2 * 86400
      ? d.toLocaleDateString([], { month: "short", day: "numeric" })
      : d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div className="chartwrap">
      <svg ref={ref} className="chart" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ height }} onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
        <defs>
          <linearGradient id={`ca-${main}`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="hsl(var(--primary))" stopOpacity=".35" />
            <stop offset="1" stopColor="hsl(var(--primary))" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75].map((f) => (
          <line key={f} x1="0" x2={W} y1={f * H} y2={f * H} stroke="hsl(var(--border))" strokeDasharray="3 5" vectorEffect="non-scaling-stroke" />
        ))}
        <path d={geo.area} fill={`url(#ca-${main})`} />
        <path d={geo.a.line} fill="none" stroke="hsl(var(--primary))" strokeWidth="2" vectorEffect="non-scaling-stroke" />
        {geo.b && <path d={geo.b.line} fill="none" stroke="hsl(var(--mag))" strokeWidth="1.5" strokeOpacity=".8" vectorEffect="non-scaling-stroke" />}
        {hp && <line x1={geo.sx(hp.t)} x2={geo.sx(hp.t)} y1={0} y2={H} stroke="hsl(var(--foreground) / .4)" vectorEffect="non-scaling-stroke" />}
      </svg>
      <div className="axis">
        <span>{tl(geo.t0)}</span>
        <span>{tl(geo.t0 + span / 2)}</span>
        <span>{tl(geo.t1)}</span>
      </div>
      {hp && (
        <div className="tip" style={{ left: `${Math.min(85, Math.max(15, (geo.sx(hp.t) / W) * 100))}%` }}>
          <b>{fmt[main](hp[main] as number)}</b>
          {second && hp[second] !== null && <span className="t2">{fmt[second](hp[second] as number)}</span>}
          <span>{new Date(hp.t * 1000).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
        </div>
      )}
    </div>
  );
}
