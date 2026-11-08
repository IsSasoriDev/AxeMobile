import { useEffect, useState } from "react";
import { Navigate, useParams } from "react-router-dom";
import { Copy } from "lucide-react";
import { api, type PoolConfig, type PoolEntry } from "@/api";
import { useApp } from "@/App";
import { KindTag, LoginDialog, MinerPicker, Modal, Seg } from "@/components/bits";
import { useToast } from "@/components/Toast";
import { displayName } from "@/format";

const PRESETS: { name: string; url: string; port: number }[] = [
  { name: "Public Pool", url: "public-pool.io", port: 21496 },
  { name: "CKPool solo", url: "solo.ckpool.org", port: 3333 },
  { name: "OCEAN", url: "mine.ocean.xyz", port: 3334 },
  { name: "Braiins", url: "stratum.braiins.com", port: 3333 },
];

export default function Pools() {
  const { id } = useParams();
  const { overview, reload } = useApp();
  const toast = useToast();
  const miners = overview?.miners ?? [];
  const mid = Number(id);
  const m = miners.find((x) => x.id === mid);
  const [cfg, setCfg] = useState<PoolConfig | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [login, setLogin] = useState(false);
  const [copyOpen, setCopyOpen] = useState(false);
  const [targets, setTargets] = useState<number[]>([]);

  const load = async () => {
    setErr("");
    setCfg(null);
    try {
      setCfg(await api<PoolConfig>(`/miners/${mid}/pools`));
    } catch (e: any) {
      setErr(e.message);
    }
  };
  useEffect(() => {
    if (m) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mid, !!m]);

  if (!overview) return <div className="card empty">Loading…</div>;
  if (!id && miners.length) return <Navigate to={`/pools/${miners[0].id}`} replace />;
  if (!miners.length) {
    return (
      <>
        <header className="top"><h1>Pools</h1></header>
        <div className="card empty">Add a miner first.</div>
      </>
    );
  }

  const forge = m?.kind === "axeforge";
  const set = (i: number, patch: Partial<PoolEntry>) =>
    setCfg((c) => (c ? { ...c, pools: c.pools.map((p, j) => (j === i ? { ...p, ...patch } : p)) } : c));

  const save = async () => {
    if (!cfg) return;
    setBusy(true);
    try {
      const r = await api<{ message: string }>(`/miners/${mid}/pools`, { method: "PUT", body: cfg });
      toast(r.message || "Saved", "ok");
      setTimeout(load, 1500);
    } catch (e: any) {
      if (e.status === 401) setLogin(true);
      toast(e.message, "err");
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    if (!cfg) return;
    setBusy(true);
    try {
      const r = await api<{ results: { id: number; ok: boolean; message: string }[] }>("/pools/apply", { body: { miners: targets, pools: cfg } });
      const bad = r.results.filter((x) => !x.ok);
      toast(bad.length ? `${r.results.length - bad.length} updated, ${bad.length} failed: ${bad[0].message}` : `Pools copied to ${r.results.length} miner${r.results.length === 1 ? "" : "s"}`, bad.length ? "err" : "ok");
      setCopyOpen(false);
    } finally {
      setBusy(false);
    }
  };

  const total = cfg?.pools.filter((p) => p.enabled).reduce((a, p) => a + (p.weight ?? 0), 0) ?? 0;

  return (
    <>
      <header className="top">
        <h1>Pools</h1>
        {m && <KindTag kind={m.kind} />}
      </header>
      <MinerPicker miners={miners} current={mid} base="/pools" />

      {!m ? (
        <div className="card empty">Pick a miner.</div>
      ) : err ? (
        <div className="banner">
          Couldn't read pools from {displayName(m)}: {err}{" "}
          {err === "login required" ? <a href="#" onClick={(e) => { e.preventDefault(); setLogin(true); }}>Log in</a> : <a href="#" onClick={(e) => { e.preventDefault(); load(); }}>Retry</a>}
        </div>
      ) : !cfg ? (
        <div className="card empty">Reading pools from {displayName(m)}…</div>
      ) : (
        <>
          {forge ? (
            <div className="card mb">
              <h3>Mode</h3>
              <Seg value={cfg.mode === "failover" ? "failover" : "split"} options={[["split", "Split by %"], ["failover", "Failover"]]} onChange={(v) => setCfg({ ...cfg, mode: v })} />
              <p className="note">
                {cfg.mode === "failover"
                  ? "Mines on the first enabled pool and moves down the list when it drops."
                  : "Splits the miner's work between the enabled pools by weight. Weights are normalised by the miner."}
              </p>
            </div>
          ) : (
            <div className="info">AxeOS has a main pool and a fallback. The miner needs a restart to pick up pool changes.</div>
          )}

          {cfg.pools.map((p, i) => (
            <div key={i} className={`pool ${p.enabled || (!forge && i === 0) ? "" : "offp"}`}>
              <div className="hd">
                <span className={`dot ${p.connected ? "ok" : ""}`} />
                <b>{forge ? `Pool ${i + 1}` : i === 0 ? "Main pool" : "Fallback pool"}</b>
                {p.connected && <span className="tag">in use</span>}
                {(forge || i > 0) && <input type="checkbox" className="tg" checked={p.enabled} onChange={(e) => set(i, { enabled: e.target.checked })} title="Enabled" />}
              </div>
              <div className="row">
                <div style={{ gridColumn: "span 2" }}>
                  <label className="f">Stratum host</label>
                  <input value={p.url} onChange={(e) => set(i, { url: e.target.value })} placeholder="public-pool.io" />
                </div>
                <div>
                  <label className="f">Port</label>
                  <input type="number" value={p.port || ""} onChange={(e) => set(i, { port: Number(e.target.value) })} />
                </div>
              </div>
              <div className="row">
                <div style={{ gridColumn: "span 2" }}>
                  <label className="f">Username (address.worker)</label>
                  <input value={p.user} onChange={(e) => set(i, { user: e.target.value })} placeholder="bc1q….worker" />
                </div>
                <div>
                  <label className="f">Password</label>
                  <input type="password" value={p.pass} onChange={(e) => set(i, { pass: e.target.value })} placeholder="unchanged" autoComplete="off" />
                </div>
              </div>
              {forge && cfg.mode !== "failover" && p.weight !== undefined && (
                <>
                  <label className="f">
                    Share of work <span className="rv">{total > 0 && p.enabled ? Math.round(((p.weight ?? 0) / total) * 100) : 0}%</span>
                  </label>
                  <input type="range" min={1} max={100} value={p.weight ?? 100} onChange={(e) => set(i, { weight: Number(e.target.value) })} />
                </>
              )}
              <div className="btns" style={{ marginTop: 10 }}>
                {PRESETS.map((x) => (
                  <button key={x.name} type="button" className="btn alt sm" onClick={() => set(i, { url: x.url, port: x.port, enabled: true })}>{x.name}</button>
                ))}
              </div>
            </div>
          ))}

          <div className="btns">
            <button className="btn" onClick={save} disabled={busy}>{forge ? "Save & reconnect" : "Save"}</button>
            {miners.length > 1 && (
              <button className="btn alt" onClick={() => { setTargets([]); setCopyOpen(true); }} disabled={busy}><Copy /> Copy to other miners</button>
            )}
            <span className="meta">{forge ? "No reboot needed." : "Restart the miner afterwards."} Empty password keeps the saved one.</span>
          </div>
        </>
      )}

      {login && m && <LoginDialog miner={m} onClose={() => setLogin(false)} onDone={() => { reload(); load(); }} />}
      {copyOpen && m && (
        <Modal onClose={() => setCopyOpen(false)}>
          <h2>Copy pools</h2>
          <p className="meta">Sends this pool setup to the miners you pick. AxeOS miners take the first two pools.</p>
          {miners.filter((x) => x.id !== m.id).map((x) => (
            <label key={x.id} className="switch" style={{ cursor: "pointer" }}>
              <div><b>{displayName(x)}</b><span>{x.model} · {x.ip}</span></div>
              <input type="checkbox" className="tg" checked={targets.includes(x.id)} onChange={(e) => setTargets(e.target.checked ? [...targets, x.id] : targets.filter((t) => t !== x.id))} />
            </label>
          ))}
          <div className="btns" style={{ marginTop: 14 }}>
            <button className="btn" disabled={!targets.length || busy} onClick={copy}>Copy to {targets.length || ""} miner{targets.length === 1 ? "" : "s"}</button>
            <button className="btn alt" onClick={() => setCopyOpen(false)}>Cancel</button>
          </div>
        </Modal>
      )}
    </>
  );
}
