import { useEffect, useState } from "react";
import { Trophy, Cpu, Zap, TrendingUp, TrendingDown, Minus, Clock, Activity, Gauge } from "lucide-react";
import { MinerDevice } from "@/hooks/useNetworkScanner";
import { useHashrateHistory } from "@/hooks/useHashrateHistory";

interface BestDiffRecord {
  value: number;
  miner: string;
  at: string;
}

const formatDiff = (diff: number) => {
  if (!diff) return "0";
  if (diff >= 1e12) return `${(diff / 1e12).toFixed(2)}T`;
  if (diff >= 1e9) return `${(diff / 1e9).toFixed(2)}G`;
  if (diff >= 1e6) return `${(diff / 1e6).toFixed(2)}M`;
  if (diff >= 1e3) return `${(diff / 1e3).toFixed(2)}K`;
  return diff.toString();
};

const formatRelative = (iso?: string) => {
  if (!iso) return "—";
  const diff = Math.max(0, Date.now() - new Date(iso).getTime());
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
};

interface Props {
  devices: MinerDevice[];
  totalHashRate: number;
  totalPower: number;
  activeDevices: number;
}

export function MinerSummaryCard({ devices, totalHashRate, totalPower, activeDevices }: Props) {
  const { avg10m, avg1h, avg24h } = useHashrateHistory(totalHashRate, totalPower);
  const [bestRecord, setBestRecord] = useState<BestDiffRecord | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem("bestDifficultyRecord");
    let current: BestDiffRecord | null = saved ? JSON.parse(saved) : null;

    let updated = false;
    devices.forEach((d) => {
      const v = (d.bestDiff || 0) as number;
      if (v > 0 && (!current || v > current.value)) {
        current = { value: v, miner: d.name || d.IP, at: new Date().toISOString() };
        updated = true;
      }
    });

    if (updated && current) {
      localStorage.setItem("bestDifficultyRecord", JSON.stringify(current));
    }
    setBestRecord(current);
  }, [devices]);

  const efficiency = totalHashRate > 0 ? totalPower / (totalHashRate / 1000) : 0;
  const healthPct = devices.length > 0 ? (activeDevices / devices.length) * 100 : 0;

  const renderAvg = (label: string, avg: number | null) => {
    let TrendIcon = Minus;
    let colorClass = "text-muted-foreground";
    let bgGlow = "";
    let pct: string | null = null;

    if (avg !== null && avg > 0) {
      const delta = ((totalHashRate - avg) / avg) * 100;
      if (delta > 2) {
        TrendIcon = TrendingUp;
        colorClass = "text-success";
        bgGlow = "shadow-[0_0_20px_-8px_hsl(var(--success)/0.5)]";
      } else if (delta < -2) {
        TrendIcon = TrendingDown;
        colorClass = "text-destructive";
        bgGlow = "shadow-[0_0_20px_-8px_hsl(var(--destructive)/0.5)]";
      }
      pct = `${delta >= 0 ? "+" : ""}${delta.toFixed(1)}%`;
    }

    return (
      <div className={`group relative overflow-hidden rounded-lg bg-gradient-to-br from-secondary/40 to-secondary/10 border border-border/40 p-2.5 transition-all hover:border-primary/40 ${bgGlow}`}>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[9px] font-mono uppercase tracking-[0.15em] text-muted-foreground">{label}</span>
          <TrendIcon className={`h-3 w-3 ${colorClass}`} />
        </div>
        <div className="flex items-baseline gap-1">
          <span className="text-base font-black font-mono tabular-nums">
            {avg !== null ? avg.toFixed(2) : "—"}
          </span>
          <span className="text-[9px] text-muted-foreground font-mono">GH/s</span>
        </div>
        <div className={`text-[10px] font-mono mt-0.5 ${colorClass}`}>
          {pct ?? "no data"}
        </div>
      </div>
    );
  };

  return (
    <div className="relative overflow-hidden rounded-2xl border border-primary/30 bg-gradient-to-br from-card via-card to-primary/5 backdrop-blur-xl shadow-[0_0_40px_-12px_hsl(var(--primary)/0.4)]">
      {/* Decorative grid pattern */}
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{
        backgroundImage: 'linear-gradient(hsl(var(--primary)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--primary)) 1px, transparent 1px)',
        backgroundSize: '24px 24px'
      }} />
      {/* Glow accent */}
      <div className="absolute -top-20 -right-20 w-40 h-40 bg-primary/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-20 -left-20 w-40 h-40 bg-accent/15 rounded-full blur-3xl pointer-events-none" />

      <div className="relative p-5 space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="absolute inset-0 bg-primary/40 blur-md rounded-xl" />
              <div className="relative p-2.5 rounded-xl bg-gradient-to-br from-primary/30 to-primary/10 border border-primary/40">
                <Cpu className="h-5 w-5 text-primary" />
              </div>
            </div>
            <div>
              <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground">Fleet Overview</p>
              <p className="text-base font-bold font-mono leading-tight">
                <span className="text-primary">{activeDevices}</span>
                <span className="text-muted-foreground">/{devices.length}</span>
                <span className="text-xs text-muted-foreground ml-1.5 font-normal">online</span>
              </p>
              {/* Health bar */}
              <div className="mt-1.5 h-1 w-32 rounded-full bg-secondary/60 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-primary to-accent transition-all duration-500"
                  style={{ width: `${healthPct}%` }}
                />
              </div>
            </div>
          </div>

          <div className="text-right">
            <div className="flex items-center justify-end gap-1.5 mb-0.5">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-60" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
              </span>
              <p className="text-[10px] font-mono uppercase tracking-[0.15em] text-muted-foreground">Live</p>
            </div>
            <p className="text-3xl font-black font-mono text-primary leading-none tabular-nums">
              {totalHashRate.toFixed(2)}
            </p>
            <p className="text-[10px] font-mono text-muted-foreground mt-0.5 uppercase tracking-wider">GH/s total</p>
          </div>
        </div>

        {/* Stat tiles row */}
        <div className="grid grid-cols-2 gap-3">
          {/* Best diff */}
          <div className="relative overflow-hidden rounded-xl border border-warning/30 bg-gradient-to-br from-warning/10 via-warning/5 to-transparent p-3">
            <div className="absolute top-0 right-0 w-20 h-20 bg-warning/10 rounded-full blur-2xl" />
            <div className="relative">
              <div className="flex items-center gap-1.5 mb-2">
                <Trophy className="h-3.5 w-3.5 text-warning" />
                <p className="text-[10px] font-mono uppercase tracking-[0.15em] text-muted-foreground">All-Time Best Diff</p>
              </div>
              <p className="text-2xl font-black font-mono text-warning leading-none tabular-nums">
                {formatDiff(bestRecord?.value || 0)}
              </p>
              <div className="flex items-center justify-between text-[10px] font-mono text-muted-foreground mt-2 pt-2 border-t border-warning/20">
                <span className="truncate max-w-[55%]" title={bestRecord?.miner}>
                  {bestRecord?.miner || "—"}
                </span>
                <span className="flex items-center gap-1 shrink-0">
                  <Clock className="h-2.5 w-2.5" />
                  {formatRelative(bestRecord?.at)}
                </span>
              </div>
            </div>
          </div>

          {/* Power */}
          <div className="relative overflow-hidden rounded-xl border border-accent/30 bg-gradient-to-br from-accent/10 via-accent/5 to-transparent p-3">
            <div className="absolute top-0 right-0 w-20 h-20 bg-accent/10 rounded-full blur-2xl" />
            <div className="relative">
              <div className="flex items-center gap-1.5 mb-2">
                <Zap className="h-3.5 w-3.5 text-accent" />
                <p className="text-[10px] font-mono uppercase tracking-[0.15em] text-muted-foreground">Power Draw</p>
              </div>
              <p className="text-2xl font-black font-mono text-accent leading-none tabular-nums">
                {totalPower.toFixed(0)}
                <span className="text-xs text-muted-foreground ml-1 font-normal">W</span>
              </p>
              <div className="flex items-center justify-between text-[10px] font-mono text-muted-foreground mt-2 pt-2 border-t border-accent/20">
                <span className="flex items-center gap-1">
                  <Gauge className="h-2.5 w-2.5" />
                  Efficiency
                </span>
                <span className="text-foreground/80">
                  {efficiency > 0 ? `${efficiency.toFixed(1)} W/TH` : "—"}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Hashrate averages */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <Activity className="h-3 w-3 text-primary" />
              <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground">
                Rolling Averages
              </p>
            </div>
            <p className="text-[9px] font-mono text-muted-foreground/70">vs current</p>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {renderAvg("10m", avg10m)}
            {renderAvg("1h", avg1h)}
            {renderAvg("24h", avg24h)}
          </div>
        </div>
      </div>
    </div>
  );
}
