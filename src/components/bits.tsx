import { ReactNode, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, type Miner } from "@/api";
import { displayName } from "@/format";
import { useToast } from "./Toast";

export function StatusPill({ m }: { m: Miner }) {
  if (m.needs_login) return <span className="pill still warn">Login</span>;
  if (!m.online) return <span className="pill still bad">Offline</span>;
  if (m.snap?.fault) return <span className="pill bad">Fault</span>;
  if (m.snap?.pool_connected === false) return <span className="pill warn">No pool</span>;
  return <span className="pill good">Mining</span>;
}

export function KindTag({ kind }: { kind: string }) {
  return <span className={`tag ${kind === "axeforge" ? "forge" : ""}`}>{kind === "axeforge" ? "AxeForge" : "AxeOS"}</span>;
}

export function Dot({ m }: { m: Miner }) {
  return <span className={`dot ${m.online ? "ok" : m.snap ? "off" : "wait"}`} />;
}

export function MinerPicker({ miners, current, base }: { miners: Miner[]; current?: number; base: string }) {
  return (
    <div className="picker">
      {miners.map((m) => (
        <Link key={m.id} to={`${base}/${m.id}`} className={m.id === current ? "on" : ""}>
          <Dot m={m} />
          {displayName(m)}
        </Link>
      ))}
    </div>
  );
}

export function Modal({ children, onClose }: { children: ReactNode; onClose: () => void }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  return (
    <div className="modal" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="card">{children}</div>
    </div>
  );
}

export function Seg<T extends string>({ value, options, onChange, xs }: { value: T; options: [T, string][]; onChange: (v: T) => void; xs?: boolean }) {
  return (
    <div className={`seg ${xs ? "xs" : ""}`}>
      {options.map(([v, l]) => (
        <button key={v} type="button" data-state={v === value ? "on" : "off"} className={v === value ? "on" : ""} onClick={() => onChange(v)}>
          {l}
        </button>
      ))}
    </div>
  );
}

/** AxeForge two-factor login for one miner. */
export function LoginDialog({ miner, onClose, onDone }: { miner: Miner; onClose: () => void; onDone: () => void }) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const toast = useToast();
  const go = async () => {
    setBusy(true);
    setErr("");
    try {
      await api(`/miners/${miner.id}/login`, { body: { code } });
      toast(`Logged in to ${displayName(miner)}`, "ok");
      onDone();
      onClose();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal onClose={onClose}>
      <h2>Log in to {displayName(miner)}</h2>
      <p className="meta">This miner has two-factor login on. Enter the 6-digit code from your authenticator app. AxeMobile keeps the session, so you only do this once.</p>
      <label className="f">Code</label>
      <input autoFocus inputMode="numeric" value={code} onChange={(e) => setCode(e.target.value)} onKeyDown={(e) => e.key === "Enter" && go()} placeholder="123456" />
      {err && <p className="note bad">{err}</p>}
      <div className="btns" style={{ marginTop: 14 }}>
        <button className="btn" disabled={busy || code.trim().length < 6} onClick={go}>Log in</button>
        <button className="btn alt" onClick={onClose}>Cancel</button>
      </div>
    </Modal>
  );
}

/** A button that asks for a second click before doing something drastic. */
export function ConfirmButton({ children, confirm, onConfirm, className = "btn alt", disabled }: { children: ReactNode; confirm: string; onConfirm: () => void; className?: string; disabled?: boolean }) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 3500);
    return () => clearTimeout(t);
  }, [armed]);
  return (
    <button
      type="button"
      disabled={disabled}
      className={`${className} ${armed ? "warn" : ""}`}
      onClick={() => {
        if (armed) {
          setArmed(false);
          onConfirm();
        } else setArmed(true);
      }}
    >
      {armed ? confirm : children}
    </button>
  );
}
