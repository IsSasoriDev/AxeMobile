export const num = (v: number | null | undefined, d = 1) =>
  v === null || v === undefined || !isFinite(v) ? "–" : v.toFixed(d);

/** GH/s in, best unit out. */
export function hash(ghs: number | null | undefined): [string, string] {
  if (ghs === null || ghs === undefined || !isFinite(ghs)) return ["–", "GH/s"];
  if (ghs >= 1e6) return [(ghs / 1e6).toFixed(2), "PH/s"];
  if (ghs >= 1000) return [(ghs / 1000).toFixed(2), "TH/s"];
  return [ghs.toFixed(ghs >= 100 ? 0 : 1), "GH/s"];
}

export const hashStr = (ghs: number | null | undefined) => hash(ghs).join(" ");

export function diff(d: number | null | undefined): string {
  if (!d || !isFinite(d)) return "–";
  const u = ["", "K", "M", "G", "T", "P", "E"];
  let i = 0;
  while (d >= 1000 && i < u.length - 1) {
    d /= 1000;
    i++;
  }
  return d.toFixed(d >= 100 ? 0 : 2) + u[i];
}

export function uptime(s: number | null | undefined): string {
  if (!s) return "–";
  const d = Math.floor(s / 86400),
    h = Math.floor((s % 86400) / 3600),
    m = Math.floor((s % 3600) / 60);
  return d ? `${d}d ${h}h` : h ? `${h}h ${m}m` : `${m}m`;
}

export function ago(ts: number): string {
  const s = Math.max(0, Date.now() / 1000 - ts);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return new Date(ts * 1000).toLocaleDateString();
}

export const displayName = (m: { name: string; ip: string }) => m.name || m.ip;

export function tempTone(t: number | null | undefined): string {
  if (t === null || t === undefined) return "dim";
  if (t >= 70) return "bad";
  if (t >= 62) return "warn";
  return "good";
}
