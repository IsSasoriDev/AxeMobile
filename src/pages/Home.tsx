import { useState } from "react";
import { MinerCard } from "@/components/miners/MinerCard";
import { AddMinerDialog } from "@/components/miners/AddMinerDialog";
import { MinerSummaryCard } from "@/components/miners/MinerSummaryCard";
import { WebViewFrame } from "@/components/webview/WebViewFrame";
import { useNetworkScanner, MinerDevice } from "@/hooks/useNetworkScanner";
import { useMinerNotifications } from "@/hooks/useMinerNotifications";
import { useTrayStats } from "@/hooks/useTrayStats";
import { Pickaxe, Wifi, Search } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Home() {
  const { devices, addDevice, removeDevice, refreshDevices, updateDeviceName, updateDeviceIP, scanNetwork, isScanning, totalHashRate, totalPower, activeDevices } = useNetworkScanner();
  useMinerNotifications(devices);
  useTrayStats(activeDevices, devices.length, totalHashRate, totalPower, devices);
  const [webViewMiner, setWebViewMiner] = useState<MinerDevice | null>(null);

  const handleOpenWebView = (miner: MinerDevice) => setWebViewMiner(miner);
  const handleCloseWebView = () => setWebViewMiner(null);
  const handleAddMiner = async (minerData: { name: string; ipAddress: string; model: 'bitaxe' | 'nerdaxe' | 'avalon' }) => { await addDevice(minerData.ipAddress); };
  const handleStatusCheck = async () => { await refreshDevices(); };

  return (
    <div className="h-full overflow-y-auto p-4 md:p-6 space-y-4">
      {/* Compact header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10 border border-primary/20">
            <Pickaxe className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-bold font-mono tracking-tight">Home</h1>
            <p className="text-[10px] text-muted-foreground font-mono uppercase tracking-widest">Mining Dashboard</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={isScanning}
            onClick={() => scanNetwork()}
            className="gap-1.5 font-mono text-xs h-8"
          >
            <Search className={`h-3.5 w-3.5 ${isScanning ? 'animate-spin' : ''}`} />
            {isScanning ? 'Scanning...' : 'Scan Network'}
          </Button>
          <AddMinerDialog onAddMiner={handleAddMiner} />
        </div>
      </div>

      {/* Summary / Profile card */}
      {devices.length > 0 && (
        <MinerSummaryCard
          devices={devices}
          totalHashRate={totalHashRate}
          totalPower={totalPower}
          activeDevices={activeDevices}
        />
      )}

      {/* Miners Grid */}
      {devices.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 rounded-xl border border-dashed border-border/50 bg-card/20">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-4 animate-float">
            <Wifi className="h-8 w-8 text-primary/60" />
          </div>
          <h3 className="text-base font-bold font-mono mb-1">No Miners Connected</h3>
          <p className="text-xs text-muted-foreground font-mono mb-4 text-center max-w-xs">
            Add your BitAxe, NerdAxe, or Avalon Nano miner IP to start monitoring
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={isScanning} onClick={() => scanNetwork()} className="gap-1.5 font-mono text-xs">
              <Search className={`h-3.5 w-3.5 ${isScanning ? 'animate-spin' : ''}`} />
              {isScanning ? 'Scanning...' : 'Scan Network'}
            </Button>
            <AddMinerDialog onAddMiner={handleAddMiner} />
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {devices.map((miner) => (
            <MinerCard
              key={miner.IP}
              miner={miner}
              onStatusCheck={handleStatusCheck}
              onDelete={() => removeDevice(miner.IP)}
              onOpenWebView={handleOpenWebView}
              onUpdateName={updateDeviceName}
              onUpdateIP={updateDeviceIP}
            />
          ))}
        </div>
      )}

      {webViewMiner && (
        <WebViewFrame url={`http://${webViewMiner.IP}`} title={`${webViewMiner.IP} Interface`} onClose={handleCloseWebView} />
      )}
    </div>
  );
}
