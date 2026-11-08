import { Link } from "react-router-dom";
import { Plus } from "lucide-react";
import { api, type AppEvent, type Market, type Point } from "@/api";
import { useApp } from "@/App";
import { usePoll, useLocal } from "@/hooks";
import { Chart } from "@/components/Chart";
import { Gauge } from "@/components/Gauge";
import { Dot, KindTag, Seg, StatusPill } from "@/components/bits";
import { ago, diff, displayName, hash, num, tempTone, uptime } from "@/format";

type Range = "1h" | "6h" | "24h" | "7d" | "30d";
export const RANGES: [Range, string][] = [["1h", "1H"], ["6h", "6H"], ["24h", "24H"], ["7d", "7D"], ["30d", "30D"]];

export function Events({ events, empty = "Nothing yet." }: { events: AppEvent[]; empty?: string }) {
  if (!events.length) return <div className="meta">{empty}</div>;
  return (
    <ul className="events">
      {events.map((e) => (
        <li key={e.id}>
          <i className={`ev ${e.kind}`} />
          <span className="msg">{e.message}</span>
          <time>{ago(e.ts)}</time>
        </li>
      ))}
    </ul>
  );
}

export default function Dashboard() {
  const { overview, error } = useApp();
  const [range, setRange] = useLocal<Range>("dash-range", "6h");
  const hist = usePoll(() => api<Point[]>(`/history?range=${range}`), 30000, [range]);
  const market = usePoll(() => api<{ market: Market | null }>("/market"), 60000);

  if (!overview) {
    return (
      <>
        <header className="top"><h1>Dashboard</h1></header>
        <div className="card empty">{error || "Starting up…"}</div>
      </>
    );
  }
  const { fleet: f, miners, events } = overview;
  const [hv, hu] = hash(f.hashrate);
  const pct = f.expected > 0 ? (f.hashrate / f.expected) * 100 : null;
  const rejectPct = f.accepted + f.rejected > 0 ? (f.rejected / (f.accepted + f.rejected)) * 100 : null;

  return (
    <>
      <header className="top">
        <h1>Dashboard</h1>
        {f.total > 0 && (
          <span className={`pill ${f.online === f.total ? "good" : f.online ? "warn" : "bad"}`}>
            {f.online}/{f.total} online
          </span>
        )}
      </header>
      {error && <div className="banner">{error}</div>}

      {f.total === 0 ? (
        <div className="card empty" style={{ padding: 50 }}>
          <div>
            <h2 style={{ margin: "0 0 6px" }}>No miners yet</h2>
            <p className="meta" style={{ marginBottom: 16 }}>Add a miner by IP or scan your network. AxeForge and AxeOS (Bitaxe, NerdAxe, NerdQaxe) are supported.</p>
            <Link className="btn" to="/swarm"><Plus /> Add miners</Link>
          </div>
        </div>
      ) : (
        <>
          <div className="hero">
            <div className="card">
              <Gauge value={f.hashrate} max={Math.max(f.expected, f.hashrate) || 1} sub={pct !== null ? `${num(pct, 1)}% of expected` : "total hashrate"} />
            </div>
            <div className="card">
              <span className="accent" />
              <h3>
                Fleet hashrate
                <span className="inline">
                  <span className="legend"><span><i style={{ background: "hsl(var(--primary))" }} />hashrate</span><span><i style={{ background: "hsl(var(--mag))" }} />avg temp</span></span>
                  <Seg xs value={range} options={RANGES} onChange={setRange} />
                </span>
              </h3>
              <Chart points={hist.data ?? []} second="temp" height={180} />
            </div>
          </div>

          <div className="grid g4 mb">
            <div className="card">
              <h3>Total hashrate</h3>
              <div className="big">{hv}<small>{hu}</small></div>
              <div className="sub">{f.online} miner{f.online === 1 ? "" : "s"} hashing</div>
            </div>
            <div className="card">
              <h3>Power</h3>
              <div className="big">{num(f.power, 1)}<small>W</small></div>
              <div className="sub">
                {f.efficiency ? `${num(f.efficiency, 1)} J/TH` : "–"}
                {f.cost_per_day !== null && ` · ${f.currency}${num(f.cost_per_day, 2)}/day`}
              </div>
            </div>
            <div className="card">
              <h3>Best difficulty</h3>
              <div className="big">{diff(f.best_diff)}</div>
              <div className="sub">across all miners</div>
            </div>
            <div className="card">
              <h3>Shares</h3>
              <div className="big">{Math.round(f.accepted).toLocaleString()}</div>
              <div className="sub">
                {Math.round(f.rejected)} rejected{rejectPct !== null && ` · ${num(rejectPct, 2)}%`}
                {f.hottest !== null && <> · hottest <span className={tempTone(f.hottest)}>{num(f.hottest, 0)}°C</span></>}
              </div>
            </div>
          </div>

          <div className="grid g3 mb">
            <div className="card">
              <h3>Bitcoin</h3>
              <div className="big">{market.data?.market?.usd ? `$${Math.round(market.data.market.usd).toLocaleString()}` : "–"}</div>
              <div className="sub">
                {market.data?.market?.eur ? `€${Math.round(market.data.market.eur).toLocaleString()} · ` : ""}
                {market.data?.market?.fee_fast ? `fees ${market.data.market.fee_fast} sat/vB` : "from mempool.space"}
              </div>
            </div>
            <div className="card">
              <h3>Chain</h3>
              <div className="big">{market.data?.market?.height ? market.data.market.height.toLocaleString() : "–"}</div>
              <div className="sub">
                {market.data?.market?.retarget_pct != null ? `next adjustment ${market.data.market.retarget_pct > 0 ? "+" : ""}${num(market.data.market.retarget_pct, 1)}% in ${market.data.market.retarget_blocks} blocks` : ""}
              </div>
            </div>
            <div className="card">
              <h3>Solo odds</h3>
              {(() => {
                const nd = Math.max(0, ...miners.map((m) => m.snap?.network_diff ?? 0));
                const per = nd > 0 && f.hashrate > 0 ? 1 - Math.exp(-((f.hashrate * 1e9) / (nd * 4294967296)) * 86400) : 0;
                return per > 0 ? (
                  <>
                    <div className="big">1 in {Math.round(1 / per).toLocaleString()}<small>per day</small></div>
                    <div className="sub">{num((1 - Math.pow(1 - per, 365)) * 100, 4)}% chance this year</div>
                  </>
                ) : (
                  <div className="big">–</div>
                );
              })()}
            </div>
          </div>

          <section className="mb">
            <h3 className="sectitle">Miners <Link to="/swarm" className="meta">Manage</Link></h3>
            <div className="miners">
              {miners.map((m) => {
                const s = m.snap;
                const [v, u] = hash(m.online ? s?.hashrate : null);
                return (
                  <Link key={m.id} to={`/miner/${m.id}`} className={`card mcard ${m.online ? "" : "off"}`}>
                    <div className="hd">
                      <Dot m={m} />
                      <b>{displayName(m)}</b>
                      <StatusPill m={m} />
                    </div>
                    <div className="hr">{v}<small>{u}</small></div>
                    <div className="meta">{m.model || "Unknown"} · <KindTag kind={m.kind} /> · {m.ip}</div>
                    <div className="stats">
                      <div><span>Temp</span><b className={tempTone(s?.temp)}>{num(s?.temp, 1)}°</b></div>
                      <div><span>Power</span><b>{num(s?.power, 1)} W</b></div>
                      <div><span>{m.online ? "Uptime" : "Seen"}</span><b>{m.online ? uptime(s?.uptime) : m.last_seen ? ago(m.last_seen) : "never"}</b></div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>

          <div className="card">
            <h3>Activity</h3>
            <Events events={events} empty="Events show up here: miners going offline, restarts, new best shares, blocks." />
          </div>
        </>
      )}
    </>
  );
}
