// Client for the AxeMobile engine API. The web UI is served by
// axemobile-server (Umbrel, Docker), so the API is always same-origin.

const base = "";
const token = "";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export async function api<T = any>(path: string, opts: { method?: string; body?: unknown } = {}): Promise<T> {
  const headers: Record<string, string> = {};
  if (token) headers["X-Axe-Token"] = token;
  if (opts.body !== undefined) headers["Content-Type"] = "application/json";
  let r: Response;
  try {
    r = await fetch(base + "/api" + path, {
      method: opts.method ?? (opts.body !== undefined ? "POST" : "GET"),
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });
  } catch {
    throw new ApiError(0, "Can't reach the AxeMobile engine");
  }
  const text = await r.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!r.ok) throw new ApiError(r.status, (data && data.error) || `HTTP ${r.status}`);
  return data as T;
}

export function openExternal(url: string) {
  window.open(url, "_blank", "noopener");
}

export interface Snapshot {
  kind: string;
  hostname: string;
  model: string;
  asic_model: string;
  asic_count: number | null;
  version: string;
  status: string;
  fault: string;
  hashrate: number | null;
  expected: number | null;
  temp: number | null;
  vr_temp: number | null;
  power: number | null;
  vin: number | null;
  freq: number | null;
  core_mv: number | null;
  fan_pct: number | null;
  fan_rpm: number | null;
  uptime: number | null;
  best_diff: number | null;
  session_best: number | null;
  accepted: number | null;
  rejected: number | null;
  pool_host: string;
  pool_user: string;
  pool_connected: boolean | null;
  pool_diff: number | null;
  network_diff: number | null;
  block_height: number | null;
  blocks: number | null;
  rssi: number | null;
  ssid: string;
  overclocked: boolean | null;
}

export interface Miner {
  id: number;
  ip: string;
  name: string;
  kind: "axeforge" | "axeos";
  model: string;
  best_diff: number;
  blocks: number;
  added_at: number;
  online: boolean;
  last_seen: number;
  error: string;
  needs_login: boolean;
  snap: Snapshot | null;
}

export interface Fleet {
  total: number;
  online: number;
  hashrate: number;
  expected: number;
  power: number;
  efficiency: number | null;
  best_diff: number;
  accepted: number;
  rejected: number;
  hottest: number | null;
  cost_per_day: number | null;
  currency: string;
}

export interface AppEvent {
  id: number;
  miner_id: number | null;
  ts: number;
  kind: string;
  message: string;
}

export interface Point {
  t: number;
  hashrate: number | null;
  temp: number | null;
  power: number | null;
}

export interface PoolEntry {
  enabled: boolean;
  url: string;
  port: number;
  user: string;
  pass: string;
  weight?: number;
  connected?: boolean | null;
}

export interface PoolConfig {
  pools: PoolEntry[];
  mode: string;
  needs_restart: boolean;
}

export interface Tuning {
  auto_tune: boolean | null;
  freq: number | null;
  core_mv: number | null;
  fan_target: number | null;
  fan_pct: number | null;
  fan_auto: boolean | null;
  limits: { max_freq: number | null; min_mv: number | null; max_mv: number | null; max_power: number | null; chip_ceiling: number | null } | null;
  needs_restart: boolean;
}

export interface Overview {
  fleet: Fleet;
  miners: Miner[];
  events: AppEvent[];
}

export interface Market {
  usd: number | null;
  eur: number | null;
  fee_fast: number | null;
  fee_hour: number | null;
  height: number | null;
  retarget_pct: number | null;
  retarget_blocks: number | null;
  updated: number;
}

export type Level = "info" | "warn" | "bad";

export interface Issue {
  code: string;
  level: Level;
  title: string;
  detail: string;
}

export interface FirmwareUpdate {
  current: string;
  latest: string;
  url: string;
}

export interface MinerHealth {
  id: number;
  name: string;
  model: string;
  online: boolean;
  score: number;
  level: Level;
  issues: Issue[];
  availability_24h: number | null;
  availability_7d: number | null;
  availability_30d: number | null;
  reboots_24h: number;
  reboots_7d: number;
  firmware: string;
  update: FirmwareUpdate | null;
}

export interface ReportDay {
  day: number;
  date: string;
  hashrate: number;
  energy_kwh: number;
  cost: number | null;
  accepted: number;
  rejected: number;
  availability: number | null;
  reboots: number;
  record: number | null;
}

export interface ReportMiner {
  id: number;
  name: string;
  model: string;
  hashrate: number;
  energy_kwh: number;
  cost: number | null;
  efficiency: number | null;
  accepted: number;
  rejected: number;
  reject_pct: number | null;
  availability: number | null;
  reboots: number;
  record: number | null;
}

export interface Report {
  days: ReportDay[];
  miners: ReportMiner[];
  total: ReportMiner;
  currency: string;
  price: number;
  span: number;
}

/** Minutes east of UTC, for day boundaries in reports. */
export const tzMinutes = () => -new Date().getTimezoneOffset();

/** Fetches a file from the API and saves it. */
export async function download(path: string, filename: string) {
  const headers: Record<string, string> = {};
  if (token) headers["X-Axe-Token"] = token;
  const r = await fetch(base + "/api" + path, { headers });
  if (!r.ok) throw new ApiError(r.status, `HTTP ${r.status}`);
  const url = URL.createObjectURL(await r.blob());
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
