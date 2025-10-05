import { useBitcoinStats } from "@/hooks/useBitcoinStats";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Activity, Bitcoin, RefreshCw } from "lucide-react";
import { DeviceScanner } from "@/components/miners/DeviceScanner";
import { useNetworkScanner } from "@/hooks/useNetworkScanner";

export default function Stats() {
  const { stats: bitcoinStats, loading: bitcoinLoading, refreshStats: refreshBitcoinStats } = useBitcoinStats();
  const { totalHashRate, totalPower, activeDevices } = useNetworkScanner();

  // Use live Bitcoin network statistics
  const networkDifficulty = bitcoinStats?.difficulty || 126271300000000;
  const networkHashrate = bitcoinStats?.hashrate || 898; // in EH/s
  const blockReward = bitcoinStats?.blockReward || 3.125;
  const bitcoinPrice = bitcoinStats?.priceUsd || 0;
  const secondsInDay = 86400;
  const blocksPerDay = secondsInDay / 600; // ~144 blocks per day (10 min average)
  
  // Calculate probability of finding a block (more accurate calculation)
  const hashesPerSecond = totalHashRate * 1000000000; // Convert GH/s to H/s
  const networkHashesPerSecond = networkHashrate * 1000000000000; // Convert EH/s to H/s
  const probabilityPerBlock = totalHashRate > 0 ? hashesPerSecond / networkHashesPerSecond : 0;
  const probabilityPerDay = probabilityPerBlock * blocksPerDay;
  const daysToFindBlock = probabilityPerDay > 0 ? 1 / probabilityPerDay : Infinity;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="h-6 w-6 text-primary" />
          <h1 className="text-3xl font-bold">Miner Statistics</h1>
        </div>
        <Button 
          onClick={refreshBitcoinStats} 
          disabled={bitcoinLoading}
          variant="outline"
          className="gap-2"
        >
          <RefreshCw className={`h-4 w-4 ${bitcoinLoading ? 'animate-spin' : ''}`} />
          Refresh Bitcoin Stats
        </Button>
      </div>

      {/* Device Scanner and Management */}
      <DeviceScanner />

      {/* Bitcoin Network Info */}
      <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bitcoin className="h-5 w-5" />
                Bitcoin Network Statistics
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${bitcoinStats ? 'bg-green-500' : 'bg-yellow-500'}`} />
                  <span className="text-sm text-muted-foreground">
                    {bitcoinStats ? `Last updated: ${new Date(bitcoinStats.updatedAt).toLocaleTimeString()}` : 'Loading...'}
                  </span>
                </div>
                {bitcoinPrice > 0 && (
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">Bitcoin Price</p>
                    <p className="text-lg font-semibold">${bitcoinPrice.toLocaleString()} USD</p>
                  </div>
                )}
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Network Difficulty</p>
                  <p className="text-lg font-semibold">{(networkDifficulty / 1e12).toFixed(2)}T</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Network Hashrate</p>
                  <p className="text-lg font-semibold">{networkHashrate.toFixed(0)} EH/s</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Block Reward</p>
                  <p className="text-lg font-semibold">{blockReward} BTC</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Your Network Share</p>
                  <p className="text-lg font-semibold">{(probabilityPerBlock * 100).toExponential(2)}%</p>
                </div>
              </div>
              
              {bitcoinStats && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t">
                  <div>
                    <p className="text-sm text-muted-foreground">Next Difficulty Adjustment</p>
                    <p className="text-lg font-semibold">{bitcoinStats.nextDifficultyAdjustment} blocks</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Mempool Transactions</p>
                    <p className="text-lg font-semibold">{(bitcoinStats.mempoolCount || 0).toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Market Cap</p>
                    <p className="text-lg font-semibold">${(bitcoinStats.marketCapUsd / 1e12).toFixed(2)}T</p>
                  </div>
                </div>
              )}
              <div className="pt-4 border-t">
                <p className="text-sm text-muted-foreground mb-2">Block Finding Probability</p>
                <div className="space-y-1">
                  <p>Per Block: {(probabilityPerBlock * 100).toExponential(6)}%</p>
                  <p>Per Day: {(probabilityPerDay * 100).toExponential(6)}%</p>
                  <p>Expected Time: {
                    daysToFindBlock === Infinity ? 'Never (insufficient hashrate)' :
                    daysToFindBlock > 365 ? `${(daysToFindBlock / 365).toFixed(1)} years` :
                    `${daysToFindBlock.toFixed(1)} days`
                  }</p>
                </div>
              </div>
        </CardContent>
      </Card>
    </div>
  );
}