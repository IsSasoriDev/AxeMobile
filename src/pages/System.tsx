import { useEffect, useRef, useState } from "react";
import { Download, RotateCcw, Upload } from "lucide-react";
import { api, openExternal } from "@/api";
import { useApp, type Theme } from "@/App";
import { ConfirmButton } from "@/components/bits";
import { useToast } from "@/components/Toast";
import { displayName } from "@/format";

interface SettingsResp {
  settings: Record<string, string>;
  db: { samples: number; hourly: number; events: number };
}

export default function System() {
  const { overview, theme, setTheme, reload } = useApp();
  const toast = useToast();
  const [s, setS] = useState<SettingsResp | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const file = useRef<HTMLInputElement>(null);

  const load = async () => {
    const r = await api<SettingsResp>("/settings");
    setS(r);
    setForm(r.settings);
  };
  useEffect(() => {
    load().catch((e) => toast(e.message, "err"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const put = async (patch: Record<string, string>) => {
    const r = await api<{ settings: Record<string, string> }>("/settings", { method: "PUT", body: patch });
    setForm(r.settings);
    if ("intro" in patch) {
      try {
        localStorage.setItem("axemobile-intro", patch.intro);
      } catch {
        /* ignore */
      }
    }
  };

  const saveGeneral = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await put({ poll_secs: form.poll_secs, energy_price: form.energy_price, currency: form.currency });
      toast("Saved", "ok");
      reload();
    } catch (er: any) {
      toast(er.message, "err");
    }
  };

  const exportData = async () => {
    const data = await api("/export");
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `axemobile-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };

  const importData = async (f: File) => {
    try {
      const data = JSON.parse(await f.text());
      const r = await api<{ added: number }>("/import", { body: data });
      toast(`Imported ${r.added} miner${r.added === 1 ? "" : "s"}`, "ok");
      reload();
      load();
    } catch (e: any) {
      toast(e.message || "That file isn't an AxeMobile backup", "err");
    }
  };

  const restartAll = async () => {
    const ms = (overview?.miners ?? []).filter((m) => m.online);
    let ok = 0;
    for (const m of ms) {
      try {
        await api(`/miners/${m.id}/restart`, { body: {} });
        ok++;
      } catch (e: any) {
        toast(`${displayName(m)}: ${e.message}`, "err");
      }
    }
    toast(`Restart sent to ${ok} miner${ok === 1 ? "" : "s"}`, "ok");
  };

  const themes: [Theme, string, string, string][] = [
    ["default", "AxeForge", "forge", "Dark glass, cyan and magenta."],
    ["dtv", "DTV Electronics", "dtv", "Black and orange, nebula, comets and the black-hole intro."],
  ];

  return (
    <>
      <header className="top"><h1>System</h1></header>

      <div className="card mb">
        <h3>Theme</h3>
        <div className="themes">
          {themes.map(([id, name, sw, desc]) => (
            <button key={id} type="button" data-state={theme === id ? "on" : "off"} className={`theme-opt ${theme === id ? "on" : ""}`} onClick={() => setTheme(id)}>
              <div className={`sw ${sw}`} />
              <b>{name}</b>
              <span className="meta">{desc}</span>
            </button>
          ))}
        </div>
        <label className="switch" style={{ marginTop: 8 }}>
          <div><b>Intro on start</b><span>The DTV theme plays its black-hole intro, the default theme a short splash.</span></div>
          <input type="checkbox" className="tg" checked={form.intro !== "0"} onChange={(e) => put({ intro: e.target.checked ? "1" : "0" })} />
        </label>
      </div>

      <form className="card mb" onSubmit={saveGeneral}>
        <h3>Monitoring</h3>
        <div className="row">
          <div>
            <label className="f">Read miners every (seconds)</label>
            <input type="number" min={3} max={300} value={form.poll_secs ?? ""} onChange={(e) => setForm({ ...form, poll_secs: e.target.value })} />
          </div>
          <div>
            <label className="f">Electricity price per kWh</label>
            <input type="number" step="0.001" min={0} value={form.energy_price ?? ""} onChange={(e) => setForm({ ...form, energy_price: e.target.value })} placeholder="0 = don't show cost" />
          </div>
          <div>
            <label className="f">Currency symbol</label>
            <input value={form.currency ?? ""} maxLength={4} onChange={(e) => setForm({ ...form, currency: e.target.value })} />
          </div>
        </div>
        <div className="btns" style={{ marginTop: 14 }}>
          <button className="btn">Save</button>
        </div>
      </form>

      <div className="grid g2 mb">
        <div className="card">
          <h3>Database</h3>
          <div className="kv">
            <div>Miners</div><div>{overview?.fleet.total ?? "–"}</div>
            <div>Recent samples</div><div>{s ? s.db.samples.toLocaleString() : "–"}</div>
            <div>Hourly averages</div><div>{s ? s.db.hourly.toLocaleString() : "–"}</div>
            <div>Events</div><div>{s ? s.db.events.toLocaleString() : "–"}</div>
          </div>
          <p className="note">Everything is stored locally in one SQLite file. Full detail is kept for two days, hourly averages for a year.</p>
        </div>
        <div className="card">
          <h3>Backup</h3>
          <p className="meta" style={{ marginTop: 0 }}>Your miner list and settings as a JSON file. Importing adds miners you don't have yet.</p>
          <div className="btns">
            <button className="btn alt" onClick={exportData}><Download /> Export</button>
            <button className="btn alt" onClick={() => file.current?.click()}><Upload /> Import</button>
            <input ref={file} type="file" accept="application/json,.json" style={{ display: "none" }} onChange={(e) => e.target.files?.[0] && importData(e.target.files[0])} />
          </div>
        </div>
      </div>

      <div className="grid g2">
        <div className="card">
          <h3>Fleet</h3>
          <p className="meta" style={{ marginTop: 0 }}>Sends a restart to every miner that is online right now.</p>
          <ConfirmButton confirm={`Restart ${overview?.fleet.online ?? 0} miners?`} onConfirm={restartAll} disabled={!overview?.fleet.online}><RotateCcw size={16} /> Restart all</ConfirmButton>
        </div>
        <div className="card">
          <h3>About</h3>
          <div className="kv">
            <div>Version</div><div>2.2.0</div>
            <div>Runs as</div><div>Web app (Umbrel)</div>
            <div>Firmware</div><div>AxeForge, AxeOS</div>
            <div>Source</div><div><a href="#" onClick={(e) => { e.preventDefault(); openExternal("https://github.com/IsSasoriDev/AxeMobile"); }}>github.com/IsSasoriDev/AxeMobile</a></div>
          </div>
        </div>
      </div>
    </>
  );
}
