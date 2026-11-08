import { useEffect, useState } from "react";
import { Navigate, useParams } from "react-router-dom";
import { RotateCcw } from "lucide-react";
import { api, type Tuning } from "@/api";
import { useApp } from "@/App";
import { ConfirmButton, KindTag, LoginDialog, MinerPicker } from "@/components/bits";
import { useToast } from "@/components/Toast";
import { displayName, hashStr, num } from "@/format";

export default function TuningPage() {
  const { id } = useParams();
  const { overview, reload } = useApp();
  const toast = useToast();
  const miners = overview?.miners ?? [];
  const mid = Number(id);
  const m = miners.find((x) => x.id === mid);
  const [t, setT] = useState<Tuning | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [login, setLogin] = useState(false);

  const load = async () => {
    setErr("");
    setT(null);
    try {
      setT(await api<Tuning>(`/miners/${mid}/tuning`));
    } catch (e: any) {
      setErr(e.message);
    }
  };
  useEffect(() => {
    if (m) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mid, !!m]);

  if (!overview) return <div className="card empty">Loading…</div>;
  if (!id && miners.length) return <Navigate to={`/tuning/${miners[0].id}`} replace />;
  if (!miners.length) {
    return (
      <>
        <header className="top"><h1>Tuning</h1></header>
        <div className="card empty">Add a miner first.</div>
      </>
    );
  }

  const forge = m?.kind === "axeforge";
  const L = t?.limits;
  const maxF = L?.max_freq ?? 1000;
  const minMv = L?.min_mv ?? 1000;
  const maxMv = L?.max_mv ?? 1400;
  const s = m?.snap;

  const save = async () => {
    if (!t) return;
    setBusy(true);
    try {
      const r = await api<{ message: string }>(`/miners/${mid}/tuning`, { method: "PUT", body: t });
      toast(r.message || "Saved", "ok");
      setTimeout(load, 1200);
    } catch (e: any) {
      if (e.status === 401) setLogin(true);
      toast(e.message, "err");
    } finally {
      setBusy(false);
    }
  };
  const retune = async () => {
    try {
      const r = await api<{ message: string }>(`/miners/${mid}/retune`, { body: {} });
      toast(r.message, "ok");
    } catch (e: any) {
      toast(e.message, "err");
    }
  };

  return (
    <>
      <header className="top">
        <h1>Tuning</h1>
        {m && <KindTag kind={m.kind} />}
      </header>
      <MinerPicker miners={miners} current={mid} base="/tuning" />

      {!m ? (
        <div className="card empty">Pick a miner.</div>
      ) : err ? (
        <div className="banner">
          Couldn't read settings from {displayName(m)}: {err}{" "}
          {err === "login required" ? <a href="#" onClick={(e) => { e.preventDefault(); setLogin(true); }}>Log in</a> : <a href="#" onClick={(e) => { e.preventDefault(); load(); }}>Retry</a>}
        </div>
      ) : !t ? (
        <div className="card empty">Reading settings from {displayName(m)}…</div>
      ) : (
        <>
          <div className="grid g3 mb">
            <div className="card"><h3>Running at</h3><div className="big">{s?.freq ? Math.round(s.freq) : "–"}<small>MHz</small></div><div className="sub">{s?.core_mv ? `${Math.round(s.core_mv)} mV core` : "–"}</div></div>
            <div className="card"><h3>Hashrate</h3><div className="big">{hashStr(s?.hashrate).split(" ")[0]}<small>{hashStr(s?.hashrate).split(" ")[1]}</small></div><div className="sub">{s?.expected ? `expected ${hashStr(s.expected)}` : ""}</div></div>
            <div className="card"><h3>Chip temp</h3><div className="big">{num(s?.temp, 1)}<small>°C</small></div><div className="sub">{s?.power ? `${num(s.power, 1)} W` : ""}</div></div>
          </div>

          {forge && (
            <div className="card mb">
              <h3>Auto-tune</h3>
              <label className="switch">
                <div><b>Let AxeForge find the best clock</b><span>The miner searches for the most efficient clock and voltage within the limits below and keeps adjusting it. Turn off to set a fixed point.</span></div>
                <input type="checkbox" className="tg" checked={!!t.auto_tune} onChange={(e) => setT({ ...t, auto_tune: e.target.checked })} />
              </label>
              <div className="btns">
                <ConfirmButton className="btn alt sm" confirm="Click again to start over" onConfirm={retune}><RotateCcw size={14} /> Restart auto-tune search</ConfirmButton>
              </div>
            </div>
          )}

          <div className="card mb">
            <h3>{forge ? (t.auto_tune ? "Tuner start point" : "Manual point") : "Clock & voltage"}</h3>
            <label className="f">Frequency <span className="rv">{Math.round(t.freq ?? 0)} MHz</span></label>
            <input type="range" min={100} max={maxF} step={5} value={t.freq ?? 0} onChange={(e) => setT({ ...t, freq: Number(e.target.value) })} />
            <label className="f">Core voltage <span className="rv">{Math.round(t.core_mv ?? 0)} mV</span></label>
            <input type="range" min={minMv} max={maxMv} step={5} value={t.core_mv ?? minMv} onChange={(e) => setT({ ...t, core_mv: Number(e.target.value) })} />
            <div className="row" style={{ marginTop: 6 }}>
              <div><label className="f">Exact frequency (MHz)</label><input type="number" value={t.freq ?? ""} onChange={(e) => setT({ ...t, freq: Number(e.target.value) })} /></div>
              <div><label className="f">Exact voltage (mV)</label><input type="number" value={t.core_mv ?? ""} onChange={(e) => setT({ ...t, core_mv: Number(e.target.value) })} /></div>
            </div>
            {!forge && <p className="note">AxeOS applies clock and voltage after a restart.</p>}
          </div>

          <div className="card mb">
            <h3>Cooling</h3>
            {!forge && (
              <label className="switch">
                <div><b>Automatic fan</b><span>Drive the fan to hold the target temperature.</span></div>
                <input type="checkbox" className="tg" checked={!!t.fan_auto} onChange={(e) => setT({ ...t, fan_auto: e.target.checked })} />
              </label>
            )}
            {(forge || t.fan_auto) && t.fan_target !== null && (
              <>
                <label className="f">Target chip temperature <span className="rv">{Math.round(t.fan_target ?? 0)} °C</span></label>
                <input type="range" min={40} max={L?.chip_ceiling ?? 75} value={t.fan_target ?? 60} onChange={(e) => setT({ ...t, fan_target: Number(e.target.value) })} />
              </>
            )}
            {(forge || !t.fan_auto) && (
              <>
                <label className="f">{forge ? "Minimum fan speed" : "Fan speed"} <span className="rv">{Math.round(t.fan_pct ?? 0)}%</span></label>
                <input type="range" min={0} max={100} value={t.fan_pct ?? 100} onChange={(e) => setT({ ...t, fan_pct: Number(e.target.value) })} />
              </>
            )}
          </div>

          {L && (
            <div className="card mb">
              <h3>Board limits (set by the firmware)</h3>
              <div className="lim">
                {L.max_freq !== null && <div><b>{L.max_freq} MHz</b><span>max clock</span></div>}
                {L.min_mv !== null && <div><b>{L.min_mv}–{L.max_mv} mV</b><span>core voltage</span></div>}
                {L.chip_ceiling !== null && <div><b>{L.chip_ceiling}°C</b><span>chip ceiling</span></div>}
                {L.max_power !== null && <div><b>{L.max_power} W</b><span>max power</span></div>}
              </div>
            </div>
          )}

          <div className="btns">
            <button className="btn" onClick={save} disabled={busy}>Save tuning</button>
            <button className="btn alt" onClick={load} disabled={busy}>Reset</button>
          </div>
        </>
      )}
      {login && m && <LoginDialog miner={m} onClose={() => setLogin(false)} onDone={() => { reload(); load(); }} />}
    </>
  );
}
