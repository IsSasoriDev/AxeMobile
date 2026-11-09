import { useEffect, useState } from "react";
import { Copy, ExternalLink, Pickaxe } from "lucide-react";
import { api, openExternal, type Point } from "@/api";
import { useApp } from "@/App";
import { ConfirmButton } from "@/components/bits";
import { Chart } from "@/components/Chart";
import { useToast } from "@/components/Toast";
import { usePoll } from "@/hooks";
import { ago, diff, displayName, hash, hashStr } from "@/format";

interface Worker {
  id: number;
  name: string;
  address: string;
  ip: string;
  agent: string;
  since: number;
  diff: number;
  accepted: number;
  rejected: number;
  best: number;
  last_share: number;
  hashrate: number;
}

interface PoolStatus {
  enabled: boolean;
  running: boolean;
  port: number;
  error: string;
  node: { ok: boolean; chain: string; blocks: number; headers: number; syncing: boolean; progress: number; version: string; error: string };
  height: number;
  net_diff: number;
  reward: number;
  fees: number;
  txs: number;
  template_at: number;
  hashrate: number;
  workers: Worker[];
  accepted: number;
  rejected: number;
  best: number;
  blocks_found: number;
  address_ok: boolean;
  address_error: string;
}

interface PoolResp {
  status: PoolStatus;
  stratum: string;
  odds: { day: number; month: number; year: number; expected_days: number | null };
  blocks: { ts: number; height: number; hash: string; worker: string; reward: number; result: string }[];
}

interface SettingsResp {
  settings: Record<string, string>;
  fixed: string[];
}

// miners need an IP; when the page was opened by IP, that's the one to use
const ipHost = /^\d{1,3}(\.\d{1,3}){3}$/.test(window.location.hostname) ? window.location.hostname : null;

const btc = (sats: number) => (sats / 1e8).toFixed(8).replace(/0+$/, "").replace(/\.$/, "");

function pct(x: number) {
  if (!x || x <= 0) return "0%";
  if (x < 0.0001) return `1 in ${diff(1 / x)}`;
  if (x < 0.01) return `${(x * 100).toFixed(3)}%`;
  return `${(x * 100).toFixed(1)}%`;
}

export default function AxePool() {
  const { overview } = useApp();
  const toast = useToast();
  const { data, reload } = usePoll(() => api<PoolResp>("/pool"), 4000);
  const hist = usePoll(() => api<Point[]>("/pool/history?range=24h"), 60000);
  const [cfg, setCfg] = useState<SettingsResp | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<number | null>(null);

  const loadSettings = async () => {
    const r = await api<SettingsResp>("/settings");
    setCfg(r);
    setForm({ ...r.settings, node_pass: "" });
  };
  useEffect(() => {
    loadSettings().catch((e) => toast(e.message, "err"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fixed = (k: string) => cfg?.fixed.includes(k) ?? false;
  const put = async (patch: Record<string, string>) => {
    await api("/settings", { method: "PUT", body: patch });
    await loadSettings();
    setTimeout(reload, 1500);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const patch: Record<string, string> = { pool_address: (form.pool_address ?? "").trim() };
    for (const k of ["pool_port", "node_url", "node_user", "node_cookie"]) if (!fixed(k)) patch[k] = (form[k] ?? "").trim();
    if (form.node_pass && !fixed("node_pass")) patch.node_pass = form.node_pass;
    try {
      await put(patch);
      toast("Saved", "ok");
    } catch (er: any) {
      toast(er.message, "err");
    }
  };

  const copy = (label: string, v: string) => {
    navigator.clipboard?.writeText(v).then(
      () => toast(`${label} copied`, "ok"),
      () => toast("Couldn't copy", "err"),
    );
  };

  const point = async (id: number, name: string) => {
    setBusy(id);
    try {
      const r = await api<{ message: string }>(`/pool/point/${id}`, { body: { host: ipHost } });
      toast(r.message?.trim() ? `${name}: ${r.message}` : `${name} now mines on AxePool`, "ok");
    } catch (e: any) {
      toast(`${name}: ${e.message}`, "err");
    } finally {
      setBusy(null);
    }
  };

  const st = data?.status;
  const nodeFixed = fixed("node_url");
  const pill = !st ? null : !st.enabled ? <span className="pill still">Off</span> : st.error ? <span className="pill still bad">Error</span> : !st.node.ok ? <span className="pill warn">No node</span> : <span className="pill good">Running</span>;

  const settings = (
    <form className="card" onSubmit={save}>
      <h3>Settings</h3>
      <label className="switch">
        <div><b>Run AxePool</b><span>Listens for miners on the stratum port.</span></div>
        <input type="checkbox" className="tg" checked={form.pool_enabled === "1"} onChange={(e) => put({ pool_enabled: e.target.checked ? "1" : "0" }).catch((er) => toast(er.message, "err"))} />
      </label>
      <div className="grid g2" style={{ marginTop: 6 }}>
        <div>
          <label className="f">Payout address (used when a worker name has no address)</label>
          <input value={form.pool_address ?? ""} onChange={(e) => setForm({ ...form, pool_address: e.target.value })} placeholder="bc1q…" spellCheck={false} />
          <label className="f">Stratum port</label>
          <input type="number" min={1024} max={65535} disabled={fixed("pool_port")} value={form.pool_port ?? ""} onChange={(e) => setForm({ ...form, pool_port: e.target.value })} />
          <label className="f">Coinbase tag</label>
          <div className="mono" style={{ padding: "8px 0" }}>/AxeMobile AxePool/</div>
        </div>
        <div>
          {nodeFixed ? (
            <>
              <label className="f">Bitcoin node</label>
              <p className="meta" style={{ marginTop: 4 }}>Set up by Umbrel: AxePool uses the Bitcoin Node app on this device. Nothing to fill in.</p>
            </>
          ) : (
            <>
              <label className="f">Node RPC address</label>
              <input value={form.node_url ?? ""} onChange={(e) => setForm({ ...form, node_url: e.target.value })} placeholder="http://127.0.0.1:8332" />
              <label className="f">RPC user</label>
              <input value={form.node_user ?? ""} onChange={(e) => setForm({ ...form, node_user: e.target.value })} autoComplete="off" />
              <label className="f">RPC password</label>
              <input type="password" value={form.node_pass ?? ""} onChange={(e) => setForm({ ...form, node_pass: e.target.value })} placeholder={cfg?.settings.node_pass_set === "1" ? "saved; leave empty to keep it" : ""} autoComplete="new-password" />
            </>
          )}
        </div>
      </div>
      <div className="btns" style={{ marginTop: 14 }}>
        <button className="btn">Save</button>
      </div>
    </form>
  );

  if (st && !st.enabled) {
    return (
      <>
        <header className="top"><h1>AxePool</h1>{pill}</header>
        <div className="card mb">
          <h2 style={{ marginTop: 0 }}>Solo mine on your own node</h2>
          <p className="meta">AxePool runs a small stratum pool inside AxeMobile. Your miners get their work straight from your own Bitcoin node, and if one of them finds a block the whole reward goes to your address. There are no fees and no middleman.</p>
          <p className="meta">{nodeFixed ? "On Umbrel it uses the Bitcoin Node app, so there is nothing to set up." : "You need a Bitcoin Core node you can reach over RPC."}</p>
          <button className="btn" onClick={() => put({ pool_enabled: "1" }).catch((e) => toast(e.message, "err"))}><Pickaxe size={16} /> Turn on AxePool</button>
        </div>
        {settings}
      </>
    );
  }

  const [hv, hu] = hash(st?.hashrate ?? 0);
  const connected = new Set(st?.workers.map((w) => w.ip) ?? []);
  const stratum = data ? (ipHost ? `stratum+tcp://${ipHost}:${st?.port}` : data.stratum) : "–";
  const userHint = `${(form.pool_address ?? "").trim() || "your-btc-address"}.rig1`;

  return (
    <>
      <header className="top"><h1>AxePool</h1>{pill}</header>

      {st?.error && <div className="card mb note bad">{st.error}</div>}
      {st && !st.error && !st.node.ok && <div className="card mb note warn">{st.node.error ? `Bitcoin node: ${st.node.error}` : "Connecting to your Bitcoin node…"}</div>}

      <div className="grid g4 mb">
        <div className="card">
          <h3>Pool hashrate</h3>
          <div className="big">{hv}<small>{hu}</small></div>
          <div className="sub">{st?.workers.length ?? 0} worker{st?.workers.length === 1 ? "" : "s"}</div>
        </div>
        <div className="card">
          <h3>Best share</h3>
          <div className="big">{diff(st?.best)}</div>
          <div className="sub">{st?.accepted ?? 0} accepted · {st?.rejected ?? 0} rejected</div>
        </div>
        <div className="card">
          <h3>Chance of a block</h3>
          <div className="big">{pct(data?.odds.day ?? 0)}<small>today</small></div>
          <div className="sub">{pct(data?.odds.year ?? 0)} this year</div>
        </div>
        <div className="card">
          <h3>Blocks found</h3>
          <div className="big">{st?.blocks_found ?? 0}</div>
          <div className="sub">{st?.reward ? `next one pays ${btc(st.reward)} BTC` : "waiting for a template"}</div>
        </div>
      </div>

      <div className="grid g2 mb">
        <div className="card">
          <h3>Point your miners here</h3>
          <div className="kv">
            <div>Stratum</div><div><span className="mono">{stratum}</span> {data && <button className="btn sm alt" type="button" onClick={() => copy("Stratum", stratum)}><Copy size={12} /></button>}</div>
            <div>Username</div><div><span className="mono">{userHint}</span> <button className="btn sm alt" type="button" onClick={() => copy("Username", userHint)}><Copy size={12} /></button></div>
            <div>Password</div><div className="mono">x</div>
          </div>
          <p className="note">Each miner is paid to the address in its username. Without one, the payout address is used. Add "d=4096" as the password to pin a difficulty.</p>
        </div>
        <div className="card">
          <h3>Bitcoin node</h3>
          <div className="kv">
            <div>Node</div><div>{st?.node.version || "–"}</div>
            <div>Network</div><div>{st?.node.chain || "–"}</div>
            <div>Height</div><div>{st?.height ? `${st.height.toLocaleString()} (${st.node.syncing ? `syncing ${(st.node.progress * 100).toFixed(1)}%` : "in sync"})` : "–"}</div>
            <div>Difficulty</div><div>{diff(st?.net_diff)}</div>
            <div>Block reward</div><div>{st?.reward ? `${btc(st.reward)} BTC, ${btc(st.fees)} in fees` : "–"}</div>
            <div>Transactions</div><div>{st?.template_at ? `${st.txs} · updated ${ago(st.template_at)}` : "–"}</div>
          </div>
        </div>
      </div>

      <div className="card mb">
        <h3>Pool hashrate, last 24 hours</h3>
        {(hist.data?.length ?? 0) < 2 ? <div className="meta">The chart fills in a few minutes after a miner connects.</div> : <Chart points={(hist.data ?? []).map((p) => ({ ...p, temp: null, power: null }))} height={170} />}
      </div>

      <div className="card mb">
        <h3>Workers</h3>
        {!st?.workers.length && <div className="meta">Nobody connected yet. Use the stratum address above, or switch a miner over below.</div>}
        {!!st?.workers.length && (
          <table className="tbl">
            <thead><tr><th>Worker</th><th>Hashrate</th><th>Difficulty</th><th>Shares</th><th>Best</th><th>Last share</th></tr></thead>
            <tbody>
              {st.workers.map((w) => (
                <tr key={w.id}>
                  <td><b>{w.name}</b><div className="meta">{w.ip}{w.agent ? ` · ${w.agent}` : ""}</div></td>
                  <td>{hashStr(w.hashrate)}</td>
                  <td>{diff(w.diff)}</td>
                  <td>{w.accepted} / {w.rejected}</td>
                  <td>{diff(w.best)}</td>
                  <td>{w.last_share ? ago(w.last_share) : "–"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {!!overview?.miners.length && (
        <div className="card mb">
          <h3>Your miners</h3>
          <p className="meta" style={{ marginTop: 0 }}>Makes AxePool the miner's first pool and keeps its current pool as the fallback. AxeOS miners need a restart to switch.</p>
          <ul className="events">
            {overview.miners.map((m) => (
              <li key={m.id}>
                <span className={`dot ${connected.has(m.ip) ? "ok" : "wait"}`} />
                <span className="msg"><b>{displayName(m)}</b> <span className="meta">{m.ip}</span></span>
                {connected.has(m.ip) ? (
                  <span className="tag forge">On AxePool</span>
                ) : (
                  <ConfirmButton className="btn sm alt" confirm={`Switch ${displayName(m)}?`} disabled={busy === m.id} onConfirm={() => point(m.id, displayName(m))}>
                    {busy === m.id ? "Switching…" : "Mine here"}
                  </ConfirmButton>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {!!data?.blocks.length && (
        <div className="card mb">
          <h3>Blocks</h3>
          <ul className="events">
            {data.blocks.map((b) => (
              <li key={`${b.height}-${b.ts}`}>
                <span className={`dot ${b.result === "accepted" ? "ok" : "off"}`} />
                <span className="msg"><b>#{b.height}</b> <span className="meta">{b.worker} · {btc(b.reward)} BTC{b.result !== "accepted" ? ` · ${b.result}` : ""}</span></span>
                {b.result === "accepted" && (
                  <button className="btn sm alt" type="button" onClick={() => openExternal(`https://mempool.space/block/${b.hash}`)}><ExternalLink size={12} /> mempool.space</button>
                )}
                <time>{ago(b.ts)}</time>
              </li>
            ))}
          </ul>
        </div>
      )}

      {settings}
    </>
  );
}
