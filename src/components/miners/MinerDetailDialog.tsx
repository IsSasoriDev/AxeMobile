import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { MinerDevice } from "@/hooks/useNetworkScanner";
import {
  Activity, Cpu, Zap, Thermometer, Clock, CheckCircle, XCircle,
  Trophy, BarChart3, Gauge, Copy, RefreshCcw
} from "lucide-react";
import { toast } from "sonner";

interface MinerDetailDialogProps {
  miner: MinerDevice | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRefresh: () => void;
}

function formatUptime(seconds?: number): string {
  if (!seconds) return "N/A";
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function formatDifficulty(diff?: number): string {
  if (!diff) return "0";
  if (diff >= 1e12) return `${(diff / 1e12).toFixed(2)}T`;
  if (diff >= 1e9) return `${(diff / 1e9).toFixed(2)}G`;
  if (diff >= 1e6) return `${(diff / 1e6).toFixed(2)}M`;
  if (diff >= 1e3) return `${(diff / 1e3).toFixed(2)}K`;
  return diff.toFixed(2);
}

function StatRow({ icon: Icon, label, value, highlight, pulse }: {
  icon: React.ElementType;
  label: string;
  value: string | React.ReactNode;
  highlight?: boolean;
  pulse?: boolean;
}) {
  return (
    <div className={`flex items-center justify-between p-3 rounded-lg transition-all duration-300 hover:scale-[1.01] ${
      highlight
        ? 'bg-gradient-to-r from-primary/10 to-primary/5 border border-primary/20'
        : 'bg-muted/50 hover:bg-muted'
    }`}>
      <span className="text-sm font-semibold flex items-center gap-2 text-muted-foreground">
        <Icon className={`h-4 w-4 text-primary ${pulse ? 'animate-pulse' : ''}`} />
        <span className="uppercase tracking-wide text-xs">{label}</span>
      </span>
      <span className={`text-sm font-bold font-mono ${highlight ? 'text-primary' : ''}`}>
        {value}
      </span>
    </div>
  );
}

export function MinerDetailDialog({ miner, open, onOpenChange, onRefresh }: MinerDetailDialogProps) {
  if (!miner) return null;

  const totalShares = (miner.shares?.accepted || 0) + (miner.shares?.rejected || 0);
  const acceptRate = totalShares > 0 ? ((miner.shares?.accepted || 0) / totalShares) * 100 : 0;

  const tempColor = !miner.temp ? 'text-muted-foreground'
    : miner.temp > 70 ? 'text-destructive'
    : miner.temp > 60 ? 'text-warning'
    : 'text-success';

  const handleCopyIP = () => {
    navigator.clipboard.writeText(miner.IP);
    toast.success("IP copied to clipboard");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-xl font-black bg-gradient-primary bg-clip-text text-transparent">
                {miner.name || miner.IP}
              </DialogTitle>
              <div className="flex items-center gap-2 mt-1">
                <button onClick={handleCopyIP} className="flex items-center gap-1 text-xs text-muted-foreground font-mono hover:text-primary transition-colors">
                  {miner.IP}
                  <Copy className="h-3 w-3" />
                </button>
                <Badge variant={miner.isActive ? "default" : "destructive"} className="text-[10px]">
                  {miner.isActive ? "Online" : "Offline"}
                </Badge>
              </div>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-3">
          {/* Device Info */}
          <div className="text-[10px] text-muted-foreground font-mono uppercase tracking-widest mb-1">Device</div>
          <StatRow icon={Cpu} label="Model" value={miner.model || 'Unknown'} />
          {miner.version && <StatRow icon={BarChart3} label="Firmware" value={miner.version} />}
          <StatRow icon={Clock} label="Uptime" value={formatUptime(miner.uptimeSeconds)} />

          {/* Performance */}
          <div className="text-[10px] text-muted-foreground font-mono uppercase tracking-widest mt-4 mb-1">Performance</div>
          {miner.hashRate !== undefined && (
            <StatRow
              icon={Activity}
              label="Hashrate"
              value={`${miner.hashRate.toFixed(2)} GH/s`}
              highlight
              pulse
            />
          )}
          {miner.temp !== undefined && (
            <StatRow
              icon={Thermometer}
              label="Temperature"
              value={<span className={tempColor}>{miner.temp}°C</span>}
            />
          )}
          {miner.power !== undefined && (
            <StatRow icon={Zap} label="Power" value={`${miner.power.toFixed(1)}W`} />
          )}
          {miner.voltage !== undefined && miner.voltage > 0 && (
            <StatRow icon={Gauge} label="Voltage" value={`${miner.voltage.toFixed(0)}mV`} />
          )}
          {miner.frequency !== undefined && miner.frequency > 0 && (
            <StatRow icon={Gauge} label="Frequency" value={`${miner.frequency} MHz`} />
          )}
          {miner.fanSpeed !== undefined && miner.fanSpeed > 0 && (
            <StatRow icon={RefreshCcw} label="Fan Speed" value={`${miner.fanSpeed} RPM`} />
          )}

          {/* Shares & Difficulty */}
          <div className="text-[10px] text-muted-foreground font-mono uppercase tracking-widest mt-4 mb-1">Shares & Difficulty</div>
          
          <div className="p-3 rounded-lg bg-gradient-to-r from-primary/10 to-accent/5 border border-primary/20 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold flex items-center gap-2">
                <Trophy className="h-4 w-4 text-primary" />
                <span className="uppercase tracking-wide text-muted-foreground">Best Diff</span>
              </span>
              <span className="text-lg font-black bg-gradient-primary bg-clip-text text-transparent font-mono">
                {formatDifficulty(miner.bestDiff)}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="flex items-center gap-1.5 p-2 rounded-md bg-success/10 border border-success/20">
                <CheckCircle className="h-3.5 w-3.5 text-success" />
                <div>
                  <p className="text-[9px] text-muted-foreground uppercase">Accepted</p>
                  <p className="text-sm font-bold font-mono">{(miner.shares?.accepted || 0).toLocaleString()}</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 p-2 rounded-md bg-destructive/10 border border-destructive/20">
                <XCircle className="h-3.5 w-3.5 text-destructive" />
                <div>
                  <p className="text-[9px] text-muted-foreground uppercase">Rejected</p>
                  <p className="text-sm font-bold font-mono">{(miner.shares?.rejected || 0).toLocaleString()}</p>
                </div>
              </div>
            </div>

            {totalShares > 0 && (
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-muted-foreground uppercase tracking-wide">Accept Rate</span>
                  <span className={`font-bold font-mono ${acceptRate > 95 ? 'text-success' : acceptRate > 80 ? 'text-warning' : 'text-destructive'}`}>
                    {acceptRate.toFixed(1)}%
                  </span>
                </div>
                <Progress value={acceptRate} className="h-2" />
              </div>
            )}

            <div className="flex items-center justify-between text-[10px]">
              <span className="text-muted-foreground uppercase tracking-wide">Total Shares</span>
              <span className="font-bold font-mono">{totalShares.toLocaleString()}</span>
            </div>
          </div>

          {/* Efficiency */}
          {miner.hashRate && miner.power && miner.power > 0 && (
            <>
              <div className="text-[10px] text-muted-foreground font-mono uppercase tracking-widest mt-4 mb-1">Efficiency</div>
              <StatRow
                icon={Zap}
                label="J/TH"
                value={`${((miner.power / (miner.hashRate / 1000))).toFixed(1)} J/TH`}
                highlight
              />
            </>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={onRefresh}
            className="w-full mt-2 hover:bg-primary/10 hover:border-primary/50 transition-all font-semibold"
          >
            <RefreshCcw className="h-4 w-4 mr-2" />
            Refresh Stats
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
