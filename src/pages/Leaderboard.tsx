import { api } from "@/api";
import { usePoll } from "@/hooks";
import { ago, diff } from "@/format";

interface Lb {
  shares: { miner_id: number; miner: string; ts: number; diff: number }[];
  miners: { id: number; name: string; model: string; best_diff: number; blocks: number }[];
}

const medal = ["#ffc83c", "#c8d2e1", "#d68c50"];

function Rank({ n }: { n: number }) {
  const c = medal[n - 1];
  return (
    <span className="rank" style={c ? { color: c, borderColor: c, background: `${c}22` } : undefined}>
      {n}
    </span>
  );
}

export default function Leaderboard() {
  const { data } = usePoll(() => api<Lb>("/leaderboard"), 30000);
  return (
    <>
      <header className="top"><h1>Leaderboard</h1></header>
      <div className="grid g2">
        <div className="card">
          <h3>Biggest shares your fleet has found</h3>
          {!data?.shares.length && <div className="meta">Each time a miner beats its best share it lands here.</div>}
          <ul className="events">
            {data?.shares.map((s, i) => (
              <li key={`${s.miner_id}-${s.ts}`}>
                <Rank n={i + 1} />
                <span className="msg"><b>{s.miner}</b></span>
                <b style={{ color: i === 0 ? "hsl(var(--warning))" : undefined }}>{diff(s.diff)}</b>
                <time>{ago(s.ts)}</time>
              </li>
            ))}
          </ul>
        </div>
        <div className="card">
          <h3>Miners by best difficulty</h3>
          <ul className="events">
            {data?.miners.map((m, i) => (
              <li key={m.id}>
                <Rank n={i + 1} />
                <span className="msg"><b>{m.name}</b> <span className="meta">{m.model}{m.blocks > 0 ? ` · ${m.blocks} block(s)!` : ""}</span></span>
                <b>{diff(m.best_diff)}</b>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </>
  );
}
