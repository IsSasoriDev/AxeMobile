import { useBitcoinStats } from "@/hooks/useBitcoinStats";
import { Button } from "@/components/ui/button";
import { Activity, Bitcoin, RefreshCw, Trophy, Cpu, TrendingUp, Clock } from "lucide-react";
import { DeviceScanner } from "@/components/miners/DeviceScanner";
import { useNetworkScanner } from "@/hooks/useNetworkScanner";
import { useState, useEffect } from "react";

export default function Stats() {
  const { stats: bitcoinStats, loading: bitcoinLoading, refreshStats: refreshBitcoinStats } = useBitcoinStats();
  const { totalHashRate, totalPower, activeDevices, devices } = useNetworkScanner();
  const [bestDiff, setBestDiff] = useState(0);
  const [bestDiffMiner, setBestDiffMiner] = useState("");

  // Load best diff from localStorage and also check devices
  useEffect(() => {
    const saved = localStorage.getItem("bestDifficulty");
    if (saved) {
      const parsed = JSON.parse(saved);
      setBestDiff(parsed.value || 0);
      setBestDiffMiner(parsed.miner || "");
    }
  }, []);

  // Check for new best difficulty from devices
  useEffect(() => {
    devices.forEach(device => {
      const deviceBestDiff = (device as any).bestDiff || 0;
      if (deviceBestDiff > bestDiff) {
        setBestDiff(deviceBestDiff);
        setBestDiffMiner(device.name || device.IP);
        localStorage.setItem("bestDifficulty", JSON.stringify({
          value: deviceBestDiff,
          miner: device.name || device.IP
        }));
        checkAndUnlockAchievements(deviceBestDiff, device.name || device.IP);
      }
    });
  }, [devices, bestDiff]);

  const checkAndUnlockAchievements = (diff: number, minerName: string) => {
    const saved = localStorage.getItem("achievements");
    const achievements = saved ? JSON.parse(saved) : {};
    
    const diffThresholds = [
      { id: "first-hash", target: 1 },
      { id: "hundred-diff", target: 100 },
      { id: "thousand-diff", target: 1000 },
      { id: "10k-diff", target: 10000 },
      { id: "100k-diff", target: 100000 },
      { id: "1m-diff", target: 1000000 },
      { id: "10m-diff", target: 10000000 },
      { id: "100m-diff", target: 100000000 },
      { id: "1b-diff", target: 1000000000 },
    ];

    let newUnlocks = false;
    diffThresholds.forEach(({ id, target }) => {
      if (diff >= target && !achievements[id]?.unlocked) {
        achievements[id] = {
          unlocked: true,
          unlockedBy: minerName,
          unlockedAt: new Date().toISOString()
        };
        newUnlocks = true;
      }
    });

    if (newUnlocks) {
      localStorage.setItem("achievements", JSON.stringify(achievements));
    }
  };

  const formatDiff = (diff: number) => {
    if (diff >= 1e12) return `${(diff / 1e12).toFixed(2)}T`;
    if (diff >= 1e9) return `${(diff / 1e9).toFixed(2)}B`;
    if (diff >= 1e6) return `${(diff / 1e6).toFixed(2)}M`;
    if (diff >= 1e3) return `${(diff / 1e3).toFixed(2)}K`;
    return diff.toString();
  };

  const networkDifficulty = bitcoinStats?.difficulty || 126271300000000;
  const networkHashrate = bitcoinStats?.hashrate || 898;
  const blockReward = bitcoinStats?.blockReward || 3.125;
  const bitcoinPrice = bitcoinStats?.priceUsd || 0;
  const hashesPerSecond = totalHashRate * 1000000000;
  const networkHashesPerSecond = networkHashrate * 1000000000000;
  const probabilityPerBlock = totalHashRate > 0 ? hashesPerSecond / networkHashesPerSecond : 0;
  const probabilityPerDay = probabilityPerBlock * 144;
  const daysToFindBlock = probabilityPerDay > 0 ? 1 / probabilityPerDay : Infinity;

  return (
    <div className="h-full overflow-y-auto p-4 md:p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10 border border-primary/20">
            <Activity className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-bold font-mono tracking-tight">Statistics</h1>
            <p className="text-[10px] text-muted-foreground font-mono uppercase tracking-widest">Miner & Network Stats</p>
          </div>
        </div>
        <Button size="sm" onClick={refreshBitcoinStats} disabled={bitcoinLoading} variant="outline" className="gap-1.5 font-mono text-xs h-8">
          <RefreshCw className={`h-3 w-3 ${bitcoinLoading ? 'animate-spin' : ''}`} /> Refresh
        </Button>
      </div>

      {/* Device Scanner */}
      <DeviceScanner />

      {/* Best Difficulty */}
      <div className="rounded-xl border border-warning/20 bg-warning/5 backdrop-blur-sm p-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-warning/15">
            <Trophy className="h-5 w-5 text-warning" />
          </div>
          <div className="flex-1">
            <p className="text-[10px] text-muted-foreground font-mono uppercase tracking-widest">Best Difficulty Achieved</p>
            <p className="text-2xl font-black font-mono text-warning">{formatDiff(bestDiff)}</p>
            {bestDiffMiner && <p className="text-[10px] text-muted-foreground font-mono mt-0.5">by {bestDiffMiner}</p>}
          </div>
        </div>
      </div>

      {/* Bitcoin Network */}
      <div className="rounded-xl border border-border/40 bg-card/40 backdrop-blur-sm p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bitcoin className="h-4 w-4 text-primary" />
            <h2 className="text-xs font-bold font-mono uppercase tracking-widest text-muted-foreground">Bitcoin Network</h2>
          </div>
          <div className="flex items-center gap-1.5">
            <div className={`w-1.5 h-1.5 rounded-full ${bitcoinStats ? 'bg-accent' : 'bg-warning'}`} />
            <span className="text-[9px] text-muted-foreground font-mono">
              {bitcoinStats ? new Date(bitcoinStats.updatedAt).toLocaleTimeString() : 'Loading...'}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {[
            { label: "Difficulty", value: `${(networkDifficulty / 1e12).toFixed(2)}T`, icon: TrendingUp },
            { label: "Hashrate", value: `${networkHashrate.toFixed(0)} EH/s`, icon: Cpu },
            { label: "Block Reward", value: `${blockReward} BTC`, icon: Bitcoin },
            { label: "BTC Price", value: bitcoinPrice > 0 ? `$${bitcoinPrice.toLocaleString()}` : "—", icon: TrendingUp },
          ].map(item => (
            <div key={item.label} className="p-3 rounded-lg bg-secondary/30 border border-border/20 text-center">
              <p className="text-[8px] text-muted-foreground font-mono uppercase tracking-wider mb-1">{item.label}</p>
              <p className="text-base font-bold font-mono">{item.value}</p>
            </div>
          ))}
        </div>

        {bitcoinStats && (
          <div className="grid grid-cols-3 gap-2 pt-3 border-t border-border/20">
            <div className="text-center p-2">
              <p className="text-[8px] text-muted-foreground font-mono uppercase">Next Adjustment</p>
              <p className="text-sm font-bold font-mono">{bitcoinStats.nextDifficultyAdjustment} blk</p>
            </div>
            <div className="text-center p-2">
              <p className="text-[8px] text-muted-foreground font-mono uppercase">Mempool</p>
              <p className="text-sm font-bold font-mono">{(bitcoinStats.mempoolCount || 0).toLocaleString()}</p>
            </div>
            <div className="text-center p-2">
              <p className="text-[8px] text-muted-foreground font-mono uppercase">Market Cap</p>
              <p className="text-sm font-bold font-mono">${(bitcoinStats.marketCapUsd / 1e12).toFixed(2)}T</p>
            </div>
          </div>
        )}

        {/* Block finding probability */}
        <div className="pt-3 border-t border-border/20">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="h-3 w-3 text-muted-foreground" />
            <p className="text-[10px] text-muted-foreground font-mono uppercase tracking-widest">Block Finding Probability</p>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="p-2 rounded-lg bg-secondary/20 text-center">
              <p className="text-[8px] text-muted-foreground font-mono">Per Block</p>
              <p className="text-xs font-bold font-mono">{(probabilityPerBlock * 100).toExponential(2)}%</p>
            </div>
            <div className="p-2 rounded-lg bg-secondary/20 text-center">
              <p className="text-[8px] text-muted-foreground font-mono">Per Day</p>
              <p className="text-xs font-bold font-mono">{(probabilityPerDay * 100).toExponential(2)}%</p>
            </div>
            <div className="p-2 rounded-lg bg-secondary/20 text-center">
              <p className="text-[8px] text-muted-foreground font-mono">Expected Time</p>
              <p className="text-xs font-bold font-mono">
                {daysToFindBlock === Infinity ? '∞' :
                daysToFindBlock > 365 ? `${(daysToFindBlock / 365).toFixed(1)}y` :
                `${daysToFindBlock.toFixed(1)}d`}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
