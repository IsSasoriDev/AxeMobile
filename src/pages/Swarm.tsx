import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Radar, RotateCcw, Users, Waves } from "lucide-react";
import { api, type Miner } from "@/api";
import { useApp } from "@/App";
import { ConfirmButton, Dot, KindTag, LoginDialog, Modal, StatusPill } from "@/components/bits";
import { ScoreBadge, UpdateTag } from "@/components/health";
import { useToast } from "@/components/Toast";
import { ago, diff, displayName, hashStr, num, tempTone, uptime } from "@/format";

interface Found {
  ip: string;
  kind: string;
  model: string;
  hostname: string;
  hashrate: number | null;
  known: boolean;
}
interface Peer {
  ip: string;
  name: string;
  model: string;
  known: boolean;
}

/** Sets the first pool on several miners, with each miner's name as the worker. */
function BulkPool({ miners, onClose, onDone }: { miners: Miner[]; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [url, setUrl] = useState("");
  const [port, setPort] = useState(3333);
  const [user, setUser] = useState("");
  const [pass, setPass] = useState("");
  const [worker, setWorker] = useState(true);
  const [busy, setBusy] = useState(false);
  const clean = (n: string) => n.replace(/[^A-Za-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "") || "miner";
  const go = async () => {
    setBusy(true);
    let ok = 0;
    const fails: string[] = [];
    const axeos: Miner[] = [];
    for (const m of miners) {
      const u = worker && user.trim() && !user.includes(".") ? `${user.trim()}.${clean(displayName(m))}` : user.trim();
      try {
        await api(`/miners/${m.id}/pools`, { method: "PUT", body: { pools: [{ enabled: true, url: url.trim(), port, user: u, pass }], mode: "", needs_restart: false } });
        ok++;
        if (m.kind === "axeos") axeos.push(m);
      } catch (e: any) {
        fails.push(`${displayName(m)}: ${e.message}`);
      }
    }
    if (axeos.length) await api("/bulk/restart", { body: { miners: axeos.map((m) => m.id) } }).catch(() => {});
    setBusy(false);
    toast(fails.length ? `${ok} updated, ${fails.length} failed. ${fails[0]}` : `Pool set on ${ok} miner${ok === 1 ? "" : "s"}${axeos.length ? `, restarting ${axeos.length} AxeOS` : ""}`, fails.length ? "err" : "ok");
    if (!fails.length) onDone();
  };
  return (
    <Modal onClose={onClose}>
      <h2>Set pool on {miners.length} miner{miners.length === 1 ? "" : "s"}</h2>
      <p className="meta">Replaces each miner's first pool. Fallback pools stay as they are. AxeOS miners restart to switch.</p>
      <div className="row">
        <div style={{ gridColumn: "span 2" }}>
          <label className="f">Stratum host</label>
          <input autoFocus value={url} onChange={(e) => setUrl(e.target.value)} placeholder="public-pool.io" />
        </div>
        <div>
          <label className="f">Port</label>
          <input type="number" value={port || ""} onChange={(e) => setPort(Number(e.target.value))} />
        </div>
      </div>
      <div className="row">
        <div style={{ gridColumn: "span 2" }}>
          <label className="f">Bitcoin address</label>
          <input value={user} onChange={(e) => setUser(e.target.value)} placeholder="bc1q…" />
        </div>
        <div>
          <label className="f">Password</label>
          <input value={pass} onChange={(e) => setPass(e.target.value)} placeholder="x" autoComplete="off" />
        </div>
      </div>
      <label className="switch" style={{ marginTop: 6 }}>
        <div><b>Add each miner's name as the worker</b><span>bc1q….{clean(displayName(miners[0]))}, so the pool shows them apart.</span></div>
        <input type="checkbox" className="tg" checked={worker} onChange={(e) => setWorker(e.target.checked)} />
      </label>
      <div className="btns" style={{ marginTop: 14 }}>
        <button className="btn" disabled={busy || !url.trim() || !user.trim() || !port} onClick={go}>{busy ? "Sending…" : `Set on ${miners.length}`}</button>
        <button className="btn alt" onClick={onClose}>Cancel</button>
      </div>
    </Modal>
  );
}

export default function Swarm() {
  const { overview, reload, health, reloadHealth } = useApp();
  const toast = useToast();
  const nav = useNavigate();
  const [ip, setIp] = useState("");
  const [name, setName] = useState("");
  const [adding, setAdding] = useState(false);
  const [subnet, setSubnet] = useState("");
  const [scanning, setScanning] = useState(false);
  const [found, setFound] = useState<Found[] | null>(null);
  const [peers, setPeers] = useState<{ from: string; list: Peer[] } | null>(null);
  const [login, setLogin] = useState<Miner | null>(null);
  const [sel, setSel] = useState<number[]>([]);
  const [poolFor, setPoolFor] = useState<Miner[] | null>(null);

  useEffect(() => {
    api<{ subnet: string }>("/scan").then((r) => setSubnet(r.subnet)).catch(() => {});
  }, []);

  const miners = overview?.miners ?? [];
  const f = overview?.fleet;

  const add = async (addr: string, nm = "") => {
    setAdding(true);
    try {
      const m = await api<Miner>("/miners", { body: { ip: addr, name: nm } });
      toast(`Added ${displayName(m)}`, "ok");
      setFound((x) => x?.map((y) => (y.ip === addr ? { ...y, known: true } : y)) ?? null);
      setPeers((p) => (p ? { ...p, list: p.list.map((y) => (y.ip === addr ? { ...y, known: true } : y)) } : p));
      await reload();
      return true;
    } catch (e: any) {
      toast(e.message, "err");
      return false;
    } finally {
      setAdding(false);
    }
  };

  const scan = async () => {
    setScanning(true);
    setFound(null);
    try {
      const r = await api<{ subnet: string; found: Found[] }>("/scan", { body: { subnet } });
      setSubnet(r.subnet);
      setFound(r.found);
      toast(r.found.length ? `Found ${r.found.length} miner${r.found.length === 1 ? "" : "s"} on ${r.subnet}.x` : `No miners on ${r.subnet}.x`);
    } catch (e: any) {
      toast(e.message, "err");
    } finally {
      setScanning(false);
    }
  };

  const loadPeers = async (m: Miner) => {
    try {
      const r = await api<{ peers: Peer[] }>(`/miners/${m.id}/swarm`);
      setPeers({ from: displayName(m), list: r.peers });
      if (!r.peers.length) toast(`${displayName(m)} doesn't know any other miners`);
    } catch (e: any) {
      toast(e.message, "err");
    }
  };

  const forge = miners.filter((m) => m.kind === "axeforge" && m.online);
  const picked = miners.filter((m) => sel.includes(m.id));
  const toggle = (id: number, on: boolean) => setSel(on ? [...sel, id] : sel.filter((x) => x !== id));

  const restartPicked = async () => {
    try {
      const r = await api<{ results: { id: number; ok: boolean; message: string }[] }>("/bulk/restart", { body: { miners: sel } });
      const bad = r.results.filter((x) => !x.ok);
      toast(bad.length ? `${r.results.length - bad.length} restarting, ${bad.length} failed: ${bad[0].message}` : `Restarting ${r.results.length} miner${r.results.length === 1 ? "" : "s"}`, bad.length ? "err" : "ok");
      setSel([]);
      setTimeout(reloadHealth, 3000);
    } catch (e: any) {
      toast(e.message, "err");
    }
  };

  return (
    <>
      <header className="top">
        <h1>Swarm</h1>
        {f && f.total > 0 && <span className="meta">{f.online} of {f.total} online · {hashStr(f.hashrate)} · {num(f.power, 0)} W</span>}
      </header>

      <div className="grid g2 mb">
        <div className="card">
          <h3>Add a miner</h3>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (await add(ip.trim(), name.trim())) {
                setIp("");
                setName("");
              }
            }}
          >
            <div className="row">
              <div>
                <label className="f">IP address or hostname</label>
                <input value={ip} onChange={(e) => setIp(e.target.value)} placeholder="192.168.1.50" />
              </div>
              <div>
                <label className="f">Name (optional)</label>
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="uses the miner's hostname" />
              </div>
            </div>
            <div className="btns" style={{ marginTop: 14 }}>
              <button className="btn" disabled={adding || !ip.trim()}><Plus /> Add</button>
              <span className="meta">AxeMobile works out whether it runs AxeForge or AxeOS.</span>
            </div>
          </form>
        </div>
        <div className="card">
          <h3>Scan the network</h3>
          <label className="f">Subnet (/24)</label>
          <div className="inline">
            <input value={subnet} onChange={(e) => setSubnet(e.target.value)} placeholder="192.168.1" />
            <button className="btn" onClick={scan} disabled={scanning}><Radar /> {scanning ? "Scanning…" : "Scan"}</button>
          </div>
          <p className="note">Checks .1 to .254 for AxeForge and AxeOS miners. Takes about 10 seconds.</p>
          {forge.length > 0 && (
            <div className="btns" style={{ marginTop: 10 }}>
              {forge.map((m) => (
                <button key={m.id} className="btn alt sm" onClick={() => loadPeers(m)}><Users size={14} /> Import {displayName(m)}'s swarm</button>
              ))}
            </div>
          )}
        </div>
      </div>

      {(found || peers) && (
        <div className="card mb">
          <h3>
            {peers && !found ? `Miners ${peers.from} knows about` : `Found on ${subnet}.x`}
            <button className="icon-btn" title="Close" onClick={() => { setFound(null); setPeers(null); }}>×</button>
          </h3>
          {found?.length === 0 && <div className="meta">Nothing answered. Check the subnet, or add the miner by IP.</div>}
          <div className="scroll-x">
            <table className="tbl">
              <tbody>
                {(found ?? []).map((x) => (
                  <tr key={x.ip}>
                    <td className="mono">{x.ip}</td>
                    <td>{x.hostname || "–"}</td>
                    <td>{x.model} <KindTag kind={x.kind} /></td>
                    <td className="num">{hashStr(x.hashrate)}</td>
                    <td className="num">{x.known ? <span className="meta">added</span> : <button className="btn sm" disabled={adding} onClick={() => add(x.ip)}>Add</button>}</td>
                  </tr>
                ))}
                {!found &&
                  peers?.list.map((x) => (
                    <tr key={x.ip}>
                      <td className="mono">{x.ip}</td>
                      <td>{x.name || "–"}</td>
                      <td>{x.model}</td>
                      <td />
                      <td className="num">{x.known ? <span className="meta">added</span> : <button className="btn sm" disabled={adding} onClick={() => add(x.ip, x.name)}>Add</button>}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="card">
        <h3>Miners</h3>
        {miners.length === 0 ? (
          <div className="meta">No miners yet. Add one above.</div>
        ) : (
          <div className="scroll-x">
            <table className="tbl">
              <thead>
                <tr>
                  <th className="sel">
                    <input type="checkbox" className="ck" title="Select all" checked={sel.length === miners.length} onChange={(e) => setSel(e.target.checked ? miners.map((m) => m.id) : [])} />
                  </th>
                  <th>Miner</th>
                  <th className="num">Health</th>
                  <th className="hide-sm">Model</th>
                  <th className="hide-sm">Firmware</th>
                  <th className="num">Hashrate</th>
                  <th className="num">Temp</th>
                  <th className="num hide-sm">Power</th>
                  <th className="num hide-sm">Best</th>
                  <th className="num hide-sm">Uptime</th>
                  <th className="num">Status</th>
                </tr>
              </thead>
              <tbody>
                {miners.map((m) => {
                  const s = m.snap;
                  return (
                    <tr key={m.id} className="click" onClick={() => (m.needs_login ? setLogin(m) : nav(`/miner/${m.id}`))}>
                      <td className="sel" onClick={(e) => e.stopPropagation()}>
                        <input type="checkbox" className="ck" checked={sel.includes(m.id)} onChange={(e) => toggle(m.id, e.target.checked)} />
                      </td>
                      <td>
                        <div className="name"><Dot m={m} />{displayName(m)}</div>
                        <div className="meta mono">{m.ip}</div>
                      </td>
                      <td className="num"><ScoreBadge h={health[m.id]} /></td>
                      <td className="hide-sm">{m.model} <KindTag kind={m.kind} /></td>
                      <td className="hide-sm mono" style={{ fontSize: 12 }}>{s?.version || "–"}<UpdateTag u={health[m.id]?.update} /></td>
                      <td className="num">{m.online ? hashStr(s?.hashrate) : "–"}</td>
                      <td className={`num ${tempTone(s?.temp)}`}>{m.online ? `${num(s?.temp, 1)}°` : "–"}</td>
                      <td className="num hide-sm">{m.online ? `${num(s?.power, 1)} W` : "–"}</td>
                      <td className="num hide-sm">{diff(Math.max(m.best_diff, s?.best_diff ?? 0))}</td>
                      <td className="num hide-sm">{m.online ? uptime(s?.uptime) : m.last_seen ? ago(m.last_seen) : "–"}</td>
                      <td className="num"><StatusPill m={m} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {sel.length > 0 && (
        <div className="bulkbar">
          <b>{sel.length} selected</b>
          <button className="btn alt sm" onClick={() => setPoolFor(picked)}><Waves size={14} /> Set pool</button>
          <ConfirmButton className="btn alt sm" confirm={`Restart ${sel.length}?`} onConfirm={restartPicked}><RotateCcw size={14} /> Restart</ConfirmButton>
          <button className="btn alt sm" onClick={() => setSel([])}>Clear</button>
        </div>
      )}
      {poolFor && <BulkPool miners={poolFor} onClose={() => setPoolFor(null)} onDone={() => { setPoolFor(null); setSel([]); }} />}
      {login && <LoginDialog miner={login} onClose={() => setLogin(null)} onDone={reload} />}
    </>
  );
}
