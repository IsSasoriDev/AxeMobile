import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, ExternalLink, Gauge as GaugeIcon, Pencil, RotateCcw, Waves } from "lucide-react";
import { api, openExternal, type AppEvent, type Point } from "@/api";
import { useApp } from "@/App";
import { usePoll, useLocal } from "@/hooks";
import { Chart } from "@/components/Chart";
import { Gauge } from "@/components/Gauge";
import { ConfirmButton, KindTag, LoginDialog, Modal, Seg, StatusPill } from "@/components/bits";
import { useToast } from "@/components/Toast";
import { diff, displayName, hash, num, tempTone, uptime } from "@/format";
import { Events, RANGES } from "./Dashboard";

function pctBar(v: number | null | undefined, max: number, tone = "") {
  const p = v ? Math.min(100, (v / max) * 100) : 0;
  return (
    <div className="bar">
      <i style={{ width: `${p}%`, background: tone ? `hsl(var(--${tone}))` : undefined }} />
    </div>
  );
}

const toneVar = (t: string) => (t === "bad" ? "destructive" : t === "warn" ? "warning" : t === "good" ? "success" : "");

export default function MinerPage() {
  const { id } = useParams();
  const mid = Number(id);
  const { overview, reload } = useApp();
  const toast = useToast();
  const nav = useNavigate();
  const [range, setRange] = useLocal<"1h" | "6h" | "24h" | "7d" | "30d">("miner-range", "1h");
  const [chartKey, setChartKey] = useLocal<"hashrate" | "temp" | "power">("miner-chart", "hashrate");
  const hist = usePoll(() => api<Point[]>(`/miners/${mid}/history?range=${range}`), 15000, [mid, range]);
  const ev = usePoll(() => api<AppEvent[]>(`/events?miner=${mid}&limit=15`), 15000, [mid]);
  const [login, setLogin] = useState(false);
  const [renaming, setRenaming] = useState<string | null>(null);

  const m = overview?.miners.find((x) => x.id === mid);
  if (!overview) return <div className="card empty">Loading…</div>;
  if (!m) {
    return (
      <div className="card empty">
        <div>
          <p>That miner is not in the list any more.</p>
          <Link to="/" className="btn alt">Back to dashboard</Link>
        </div>
      </div>
    );
  }
  const s = m.snap;
  const online = m.online && !!s;
  const rejPct = s && (s.accepted ?? 0) + (s.rejected ?? 0) > 0 ? ((s.rejected ?? 0) / ((s.accepted ?? 0) + (s.rejected ?? 0))) * 100 : null;
  const eff = s?.power && s?.hashrate ? s.power / (s.hashrate / 1000) : null;

  const restart = async () => {
    try {
      const r = await api<{ message: string }>(`/miners/${mid}/restart`, { body: {} });
      toast(r.message || "Restarting", "ok");
    } catch (e: any) {
      toast(e.message, "err");
    }
  };
  const remove = async () => {
    await api(`/miners/${mid}`, { method: "DELETE" });
    await reload();
    toast(`Removed ${displayName(m)}`);
    nav("/swarm");
  };
  const saveName = async () => {
    if (renaming === null) return;
    await api(`/miners/${mid}`, { method: "PATCH", body: { name: renaming } });
    setRenaming(null);
    reload();
  };

  return (
    <>
      <header className="top">
        <h1>
          <Link to="/" className="back" title="Back"><ArrowLeft size={20} /></Link>
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{displayName(m)}</span>
          <button className="icon-btn" title="Rename" onClick={() => setRenaming(m.name)}><Pencil /></button>
          <small className="hide-sm">{m.model} · {m.ip}</small>
        </h1>
        <KindTag kind={m.kind} />
        <StatusPill m={m} />
      </header>

      {m.needs_login && (
        <div className="info">
          This miner has two-factor login on. <a href="#" onClick={(e) => { e.preventDefault(); setLogin(true); }}>Log in</a> so AxeMobile can read and change it.
        </div>
      )}
      {!m.online && !m.needs_login && <div className="banner">Not answering{m.error ? `: ${m.error}` : ""}. Last data is shown below.</div>}
      {s?.fault && <div className="banner">Fault: {s.fault}</div>}

      <div className="hero">
        <div className="card">
          <Gauge value={online ? s!.hashrate : null} max={Math.max(s?.expected ?? 0, s?.hashrate ?? 0) || 1} sub={s?.expected ? `expected ${hash(s.expected).join(" ")}` : "hashrate"} />
        </div>
        <div className="card">
          <span className="accent" />
          <h3>
            History
            <span className="inline">
              <Seg xs value={chartKey} options={[["hashrate", "Hashrate"], ["temp", "Temp"], ["power", "Power"]]} onChange={setChartKey} />
              <Seg xs value={range} options={RANGES} onChange={setRange} />
            </span>
          </h3>
          <Chart points={hist.data ?? []} main={chartKey} second={chartKey === "hashrate" ? "temp" : undefined} height={180} />
        </div>
      </div>

      <div className="grid g4 mb">
        <div className="card">
          <h3>ASIC temp</h3>
          <div className={`big ${tempTone(s?.temp)}`}>{num(s?.temp, 1)}<small>°C</small></div>
          {pctBar(s?.temp, 85, toneVar(tempTone(s?.temp)))}
        </div>
        <div className="card">
          <h3>VR temp</h3>
          <div className={`big ${tempTone(s?.vr_temp ? s.vr_temp - 15 : null)}`}>{num(s?.vr_temp, 1)}<small>°C</small></div>
          {pctBar(s?.vr_temp, 110)}
        </div>
        <div className="card">
          <h3>Power</h3>
          <div className="big">{num(s?.power, 1)}<small>W</small></div>
          <div className="sub">{eff ? `${num(eff, 1)} J/TH` : "–"} · {num(s?.vin, 2)} V in</div>
        </div>
        <div className="card">
          <h3>Fan</h3>
          <div className="big">{s?.fan_rpm ? Math.round(s.fan_rpm) : "–"}<small>RPM</small></div>
          {pctBar(s?.fan_pct, 100)}
          <div className="sub">{num(s?.fan_pct, 0)}%</div>
        </div>
      </div>

      <div className="grid g3 mb">
        <div className="card">
          <h3>Now mining <span className={`dot ${s?.pool_connected === false ? "off" : online ? "ok" : ""}`} /></h3>
          <div className="kv">
            <div>Pool</div><div title={s?.pool_host}>{s?.pool_host || "–"}</div>
            {s?.pool_user && (<><div>Worker</div><div title={s.pool_user}>{s.pool_user}</div></>)}
            <div>Pool diff</div><div>{diff(s?.pool_diff)}</div>
            <div>Accepted</div><div>{s?.accepted ? Math.round(s.accepted).toLocaleString() : "–"}</div>
            <div>Rejected</div><div>{s?.rejected !== null && s?.rejected !== undefined ? `${Math.round(s.rejected)}${rejPct !== null ? ` (${num(rejPct, 2)}%)` : ""}` : "–"}</div>
            <div>Block</div><div>{s?.block_height ? s.block_height.toLocaleString() : "–"}</div>
          </div>
        </div>
        <div className="card">
          <h3>Best shares</h3>
          <div className="big">{diff(Math.max(m.best_diff, s?.best_diff ?? 0))}</div>
          <div className="sub">all time</div>
          <div className="kv" style={{ marginTop: 12 }}>
            <div>This session</div><div>{diff(s?.session_best)}</div>
            <div>Network</div><div>{diff(s?.network_diff)}</div>
            <div>Blocks found</div><div>{Math.max(m.blocks, s?.blocks ?? 0)}</div>
          </div>
        </div>
        <div className="card">
          <h3>Device</h3>
          <div className="kv">
            <div>Board</div><div>{s?.model || m.model || "–"}</div>
            <div>ASIC</div><div>{s?.asic_model ? `${s.asic_count ?? 1}× ${s.asic_model}` : "–"}</div>
            <div>Clock</div><div>{s?.freq ? `${Math.round(s.freq)} MHz @ ${Math.round(s.core_mv ?? 0)} mV` : "–"}</div>
            <div>Firmware</div><div>{s?.version ? `${m.kind === "axeforge" ? "AxeForge" : "AxeOS"} ${s.version}` : "–"}</div>
            <div>Uptime</div><div>{uptime(s?.uptime)}</div>
            <div>Wi-Fi</div><div>{s?.rssi ? `${s.ssid || ""} ${Math.round(s.rssi)} dBm` : "–"}</div>
          </div>
        </div>
      </div>

      <div className="grid g2">
        <div className="card">
          <h3>Actions</h3>
          <div className="btns">
            <Link className="btn alt" to={`/pools/${m.id}`}><Waves /> Pools</Link>
            <Link className="btn alt" to={`/tuning/${m.id}`}><GaugeIcon /> Tuning</Link>
            <button className="btn alt" onClick={() => openExternal(`http://${m.ip}/`)}><ExternalLink /> Open miner page</button>
            <ConfirmButton confirm="Click again to restart" onConfirm={restart}><RotateCcw size={16} /> Restart</ConfirmButton>
          </div>
          <div className="btns" style={{ marginTop: 18 }}>
            <ConfirmButton className="btn alt sm" confirm="Remove and delete its history?" onConfirm={remove}>Remove from AxeMobile</ConfirmButton>
          </div>
        </div>
        <div className="card">
          <h3>Activity</h3>
          <Events events={ev.data ?? []} />
        </div>
      </div>

      {login && <LoginDialog miner={m} onClose={() => setLogin(false)} onDone={reload} />}
      {renaming !== null && (
        <Modal onClose={() => setRenaming(null)}>
          <h2>Rename</h2>
          <p className="meta">Only changes the name in AxeMobile, not the miner's hostname.</p>
          <label className="f">Name</label>
          <input autoFocus value={renaming} onChange={(e) => setRenaming(e.target.value)} onKeyDown={(e) => e.key === "Enter" && saveName()} placeholder={m.ip} />
          <div className="btns" style={{ marginTop: 14 }}>
            <button className="btn" onClick={saveName}>Save</button>
            <button className="btn alt" onClick={() => setRenaming(null)}>Cancel</button>
          </div>
        </Modal>
      )}
    </>
  );
}
