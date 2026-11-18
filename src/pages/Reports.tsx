import { useState } from "react";
import { Link } from "react-router-dom";
import { Download } from "lucide-react";
import { api, download, tzMinutes, type Report } from "@/api";
import { usePoll, useLocal } from "@/hooks";
import { Seg } from "@/components/bits";
import { useToast } from "@/components/Toast";
import { availTone, pct } from "@/components/health";
import { diff, hash, hashStr, num } from "@/format";

type Span = "7" | "30" | "90";

const money = (r: Report, v: number | null) => (v === null ? null : `${r.currency}${num(v, 2)}`);

export default function Reports() {
  const toast = useToast();
  const [span, setSpan] = useLocal<Span>("report-span", "7");
  const rep = usePoll(() => api<Report>(`/report?days=${span}&tz=${tzMinutes()}`), 60000, [span]);
  const [busy, setBusy] = useState(false);
  const r = rep.data;

  const csv = async (path: string, name: string) => {
    setBusy(true);
    try {
      await download(path, name);
    } catch (e: any) {
      toast(e.message, "err");
    } finally {
      setBusy(false);
    }
  };

  const t = r?.total;
  const [hv, hu] = hash(t?.hashrate);
  const peak = Math.max(1, ...(r?.days ?? []).map((d) => d.hashrate));
  const days = [...(r?.days ?? [])].reverse();

  return (
    <>
      <header className="top">
        <h1>Reports</h1>
        <Seg value={span} options={[["7", "7 days"], ["30", "30 days"], ["90", "90 days"]]} onChange={setSpan} />
      </header>

      {!r ? (
        <div className="card empty">{rep.error || "Loading…"}</div>
      ) : !r.miners.length ? (
        <div className="card empty">
          <div>
            <p>Add a miner first. Reports fill in as AxeMobile reads your miners.</p>
            <Link to="/swarm" className="btn alt">Add miners</Link>
          </div>
        </div>
      ) : (
        <>
          <div className="grid g4 mb">
            <div className="card">
              <h3>Average hashrate</h3>
              <div className="big">{hv}<small>{hu}</small></div>
              <div className="sub">over {r.span} days, offline time counts as zero</div>
            </div>
            <div className="card">
              <h3>Energy</h3>
              <div className="big">{num(t!.energy_kwh, 1)}<small>kWh</small></div>
              <div className="sub">
                {money(r, t!.cost) ?? "set a price in System to see the cost"}
                {t!.efficiency ? ` · ${num(t!.efficiency, 1)} J/TH` : ""}
              </div>
            </div>
            <div className="card">
              <h3>Uptime</h3>
              <div className={`big ${availTone(t!.availability)}`}>{pct(t!.availability)}</div>
              <div className="sub">{t!.reboots} unplanned reboot{t!.reboots === 1 ? "" : "s"}</div>
            </div>
            <div className="card">
              <h3>Shares</h3>
              <div className="big">{Math.round(t!.accepted).toLocaleString()}</div>
              <div className="sub">
                {Math.round(t!.rejected).toLocaleString()} rejected{t!.reject_pct !== null ? ` · ${num(t!.reject_pct, 2)}%` : ""}
                {t!.record ? ` · best ${diff(t!.record)}` : ""}
              </div>
            </div>
          </div>

          <div className="card mb">
            <h3>
              By miner
              <span className="inline">
                <button className="btn alt sm" disabled={busy} onClick={() => csv(`/report.csv?days=${span}&tz=${tzMinutes()}`, `axemobile-report-${span}d.csv`)}><Download size={14} /> Daily CSV</button>
                <button className="btn alt sm" disabled={busy} onClick={() => csv("/history.csv", "axemobile-history.csv")}><Download size={14} /> Raw readings (48 h)</button>
              </span>
            </h3>
            <div className="scroll-x">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Miner</th>
                    <th className="num">Avg hashrate</th>
                    <th className="num">Uptime</th>
                    <th className="num">Reboots</th>
                    <th className="num hide-sm">Energy</th>
                    <th className="num hide-sm">Efficiency</th>
                    <th className="num hide-sm">Rejected</th>
                    <th className="num hide-sm">Best share</th>
                  </tr>
                </thead>
                <tbody>
                  {r.miners.map((m) => (
                    <tr key={m.id}>
                      <td>
                        <Link to={`/miner/${m.id}`} className="name" style={{ color: "inherit", textDecoration: "none" }}>{m.name}</Link>
                        <div className="meta">{m.model}</div>
                      </td>
                      <td className="num">{hashStr(m.hashrate)}</td>
                      <td className={`num ${availTone(m.availability)}`}>{pct(m.availability)}</td>
                      <td className={`num ${m.reboots > 2 ? "warn" : ""}`}>{m.reboots}</td>
                      <td className="num hide-sm">{num(m.energy_kwh, 2)} kWh{m.cost !== null ? <div className="meta">{money(r, m.cost)}</div> : null}</td>
                      <td className="num hide-sm">{m.efficiency ? `${num(m.efficiency, 1)} J/TH` : "–"}</td>
                      <td className="num hide-sm">{m.reject_pct !== null ? `${num(m.reject_pct, 2)}%` : "–"}</td>
                      <td className="num hide-sm">{diff(m.record)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card">
            <h3>By day</h3>
            <div className="scroll-x">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Day</th>
                    <th className="num" style={{ width: "34%" }}>Avg hashrate</th>
                    <th className="num">Uptime</th>
                    <th className="num">Reboots</th>
                    <th className="num hide-sm">Energy</th>
                    <th className="num hide-sm">Shares</th>
                    <th className="num hide-sm">New best</th>
                  </tr>
                </thead>
                <tbody>
                  {days.map((d) => (
                    <tr key={d.day}>
                      <td>{new Date(d.date + "T12:00:00").toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" })}</td>
                      <td className="num">
                        <div className="dbar">
                          <span className="track"><i style={{ width: `${(d.hashrate / peak) * 100}%` }} /></span>
                          <span>{d.availability === null ? "–" : hashStr(d.hashrate)}</span>
                        </div>
                      </td>
                      <td className={`num ${availTone(d.availability)}`}>{pct(d.availability)}</td>
                      <td className={`num ${d.reboots > 2 ? "warn" : ""}`}>{d.reboots}</td>
                      <td className="num hide-sm">{num(d.energy_kwh, 2)} kWh{d.cost !== null ? <div className="meta">{money(r, d.cost)}</div> : null}</td>
                      <td className="num hide-sm">{Math.round(d.accepted).toLocaleString()}{d.rejected > 0 ? <div className="meta">{Math.round(d.rejected)} rejected</div> : null}</td>
                      <td className="num hide-sm">{d.record ? diff(d.record) : "–"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="note">Uptime is the share of AxeMobile's readings a miner answered. Days AxeMobile wasn't running show "–". Energy is what the miners reported while they were being read.</p>
          </div>
        </>
      )}
    </>
  );
}
