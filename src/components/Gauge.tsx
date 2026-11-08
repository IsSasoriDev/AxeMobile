import { hash } from "@/format";

/** Ring gauge in the style of the AxeForge dashboard. */
export function Gauge({ value, max, sub }: { value: number | null; max: number; sub: string }) {
  const [v, u] = hash(value);
  const r = 86;
  const c = 2 * Math.PI * r;
  const arc = c * 0.75;
  const pct = value && max > 0 ? Math.min(1, value / max) : 0;
  return (
    <div className="gauge">
      <svg viewBox="0 0 210 210" aria-label={`${v} ${u}`}>
        <defs>
          <linearGradient id="gg" x1="0" x2="1" y1="1" y2="0">
            <stop offset="0" stopColor="hsl(var(--primary))" />
            <stop offset="1" stopColor="hsl(var(--mag))" />
          </linearGradient>
        </defs>
        <circle
          cx="105" cy="105" r={r} fill="none" stroke="hsl(var(--border))" strokeWidth="12"
          strokeDasharray={`${arc} ${c}`} strokeLinecap="round" transform="rotate(135 105 105)"
        />
        <circle
          cx="105" cy="105" r={r} fill="none" stroke="url(#gg)" strokeWidth="12"
          strokeDasharray={`${arc * pct} ${c}`} strokeLinecap="round" transform="rotate(135 105 105)"
          style={{ transition: "stroke-dasharray .8s ease", filter: "drop-shadow(0 0 6px hsl(var(--primary) / .5))" }}
        />
        <text x="105" y="104" textAnchor="middle" className="v">{v}</text>
        <text x="105" y="128" textAnchor="middle" className="u">{u}</text>
        <text x="105" y="150" textAnchor="middle" className="s">{sub}</text>
      </svg>
    </div>
  );
}
