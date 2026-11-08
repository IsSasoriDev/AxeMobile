import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Radar, Users } from "lucide-react";
import { api, type Miner } from "@/api";
import { useApp } from "@/App";
import { Dot, KindTag, LoginDialog, StatusPill } from "@/components/bits";
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

export default function Swarm() {
  const { overview, reload } = useApp();
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
                  <th>Miner</th>
                  <th className="hide-sm">Model</th>
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
                      <td>
                        <div className="name"><Dot m={m} />{displayName(m)}</div>
                        <div className="meta mono">{m.ip}</div>
                      </td>
                      <td className="hide-sm">{m.model} <KindTag kind={m.kind} /></td>
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
      {login && <LoginDialog miner={login} onClose={() => setLogin(null)} onDone={reload} />}
    </>
  );
}
