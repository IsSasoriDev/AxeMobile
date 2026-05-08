import { useEffect, useState } from "react";
import { Trophy, Cpu, Zap, TrendingUp, TrendingDown, Minus, Clock } from "lucide-react";
import { MinerDevice } from "@/hooks/useNetworkScanner";
import { useHashrateHistory } from "@/hooks/useHashrateHistory";

interface BestDiffRecord {
  value: number;
  miner: string;
  at: string; // ISO
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

  // Track best diff with timestamp
  useEffect(() => {
    const saved = localStorage.getItem("bestDifficultyRecord");
    let current: BestDiffRecord | null = saved ? JSON.parse(saved) : null;

    let updated = false;
    devices.forEach((d) => {
      const v = (d.bestDiff || 0) as number;
      if (v > 0 && (!current || v > current.value)) {
        current = {
          value: v,
          miner: d.name || d.IP,
          at: new Date().toISOString(),
        };
        updated = true;
      }
    });

    if (updated && current) {
      localStorage.setItem("bestDifficultyRecord", JSON.stringify(current));
    }
    setBestRecord(current);
  }, [devices]);

  const renderAvg = (label: string, avg: number | null) => {
    let trendIcon = <Minus className="h-3 w-3" />;
    let colorClass = "text-muted-foreground";
    let pct: string | null = null;

    if (avg !== null && avg > 0) {
      const delta = ((totalHashRate - avg) / avg) * 100;
      if (delta > 2) {
        trendIcon = <TrendingUp className="h-3 w-3" />;
        colorClass = "text-success";
      } else if (delta < -2) {
        trendIcon = <TrendingDown className="h-3 w-3" />;
        colorClass = "text-destructive";
      }
      pct = `${delta >= 0 ? "+" : ""}${delta.toFixed(1)}%`;
    }

    return (
      <div className="p-2 rounded-lg bg-secondary/30 border border-border/20">
        <p className="text-[8px] text-muted-foreground font-mono uppercase tracking-wider mb-1">{label}</p>
        <p className="text-sm font-bold font-mono">
          {avg !== null ? `${avg.toFixed(2)}` : "—"}
          <span className="text-[9px] text-muted-foreground ml-1">GH/s</span>
        </p>
        <div className={`flex items-center gap-1 mt-0.5 ${colorClass}`}>
          {trendIcon}
          <span className="text-[9px] font-mono">{pct ?? "no data"}</span>
        </div>
      </div>
    );
  };

  return (
    <div className="rounded-xl border border-primary/30 bg-gradient-to-br from-primary/10 via-card/60 to-accent/5 backdrop-blur-sm p-4 space-y-3 shadow-glow">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-md bg-primary/15 border border-primary/30">
            <Cpu className="h-4 w-4 text-primary" />
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground font-mono uppercase tracking-widest">Fleet Summary</p>
            <p className="text-sm font-bold font-mono">{activeDevices}/{devices.length} active miner{devices.length === 1 ? "" : "s"}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-[8px] text-muted-foreground font-mono uppercase tracking-wider">Current</p>
          <p className="text-lg font-black font-mono text-primary">
            {totalHashRate.toFixed(2)}<span className="text-[10px] text-muted-foreground ml-1">GH/s</span>
          </p>
        </div>
      </div>

      {/* Best diff + power row */}
      <div className="grid grid-cols-2 gap-2">
        <div className="p-2.5 rounded-lg bg-warning/10 border border-warning/30">
          <div className="flex items-center gap-1.5 mb-1">
            <Trophy className="h-3 w-3 text-warning" />
            <p className="text-[9px] text-muted-foreground font-mono uppercase tracking-wider">Top Best Diff</p>
          </div>
          <p className="text-base font-black font-mono text-warning">{formatDiff(bestRecord?.value || 0)}</p>
          <div className="flex items-center justify-between text-[9px] font-mono text-muted-foreground mt-0.5">
            <span className="truncate max-w-[60%]">{bestRecord?.miner || "—"}</span>
            <span className="flex items-center gap-1">
              <Clock className="h-2.5 w-2.5" />
              {formatRelative(bestRecord?.at)}
            </span>
          </div>
        </div>

        <div className="p-2.5 rounded-lg bg-accent/10 border border-accent/30">
          <div className="flex items-center gap-1.5 mb-1">
            <Zap className="h-3 w-3 text-accent" />
            <p className="text-[9px] text-muted-foreground font-mono uppercase tracking-wider">Power Draw</p>
          </div>
          <p className="text-base font-black font-mono text-accent">
            {totalPower.toFixed(0)}<span className="text-[10px] text-muted-foreground ml-1">W</span>
          </p>
          <p className="text-[9px] font-mono text-muted-foreground mt-0.5">
            {totalHashRate > 0 ? `${(totalPower / (totalHashRate / 1000)).toFixed(1)} W/TH` : "— W/TH"}
          </p>
        </div>
      </div>

      {/* Hashrate averages */}
      <div>
        <p className="text-[9px] text-muted-foreground font-mono uppercase tracking-widest mb-1.5">
          Avg Hashrate (vs current)
        </p>
        <div className="grid grid-cols-3 gap-2">
          {renderAvg("10m", avg10m)}
          {renderAvg("1h", avg1h)}
          {renderAvg("24h", avg24h)}
        </div>
      </div>
    </div>
  );
}
