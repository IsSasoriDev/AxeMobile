// Lightweight in-memory app logger that intercepts console output and
// global errors so users can view live logs from inside the app.

export type LogLevel = "log" | "info" | "warn" | "error" | "debug";

export interface LogEntry {
  id: number;
  ts: number;
  level: LogLevel;
  message: string;
}

const MAX_LOGS = 500;
let buffer: LogEntry[] = [];
let nextId = 1;
const listeners = new Set<(logs: LogEntry[]) => void>();
let installed = false;

const safeStringify = (v: unknown): string => {
  if (v instanceof Error) return `${v.name}: ${v.message}\n${v.stack ?? ""}`.trim();
  if (typeof v === "string") return v;
  try {
    return JSON.stringify(v, (_k, val) => (val instanceof Error ? `${val.name}: ${val.message}` : val), 2);
  } catch {
    try { return String(v); } catch { return "[unserializable]"; }
  }
};

const emit = () => {
  const snapshot = buffer.slice();
  listeners.forEach((l) => {
    try { l(snapshot); } catch {}
  });
};

const SUPPRESS_PATTERNS = [/Lovable Script/i, /❤️/];

export const pushLog = (level: LogLevel, ...args: unknown[]) => {
  const message = args.map(safeStringify).join(" ");
  if (SUPPRESS_PATTERNS.some((re) => re.test(message))) return;
  buffer.push({ id: nextId++, ts: Date.now(), level, message });
  if (buffer.length > MAX_LOGS) buffer = buffer.slice(-MAX_LOGS);
  emit();
};

export const getLogs = (): LogEntry[] => buffer.slice();

export const clearLogs = () => {
  buffer = [];
  emit();
};

export const subscribeLogs = (cb: (logs: LogEntry[]) => void) => {
  listeners.add(cb);
  cb(buffer.slice());
  return () => listeners.delete(cb);
};

export const installLogger = () => {
  if (installed || typeof window === "undefined") return;
  installed = true;

  (["log", "info", "warn", "error", "debug"] as LogLevel[]).forEach((level) => {
    const original = (console as any)[level]?.bind(console);
    (console as any)[level] = (...args: unknown[]) => {
      pushLog(level, ...args);
      original?.(...args);
    };
  });

  window.addEventListener("error", (e) => {
    pushLog("error", `[window.error] ${e.message}`, e.error ?? "", `@ ${e.filename}:${e.lineno}:${e.colno}`);
  });
  window.addEventListener("unhandledrejection", (e) => {
    pushLog("error", "[unhandledrejection]", (e as PromiseRejectionEvent).reason);
  });

  pushLog("info", "Logger initialized");
};
