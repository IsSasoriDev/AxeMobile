import { useState } from "react";
import { MinerCard } from "@/components/miners/MinerCard";
import { AddMinerDialog } from "@/components/miners/AddMinerDialog";
import { WebViewFrame } from "@/components/webview/WebViewFrame";
import { useNetworkScanner, MinerDevice } from "@/hooks/useNetworkScanner";

export default function Home() {
  const { devices, addDevice, removeDevice, refreshDevices, updateDeviceName } = useNetworkScanner();
  const [webViewMiner, setWebViewMiner] = useState<MinerDevice | null>(null);

  const handleOpenWebView = (miner: MinerDevice) => {
    setWebViewMiner(miner);
  };

  const handleCloseWebView = () => {
    setWebViewMiner(null);
  };

  const handleAddMiner = async (minerData: { name: string; ipAddress: string; model: 'bitaxe' | 'nerdaxe' }) => {
    await addDevice(minerData.ipAddress);
  };

  const handleStatusCheck = async (miner: MinerDevice) => {
    await refreshDevices();
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-primary bg-clip-text text-transparent">
            AxeMobile Dashboard
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage your Bitcoin miners with ease
          </p>
        </div>
        <AddMinerDialog onAddMiner={handleAddMiner} />
      </div>

      {devices.length === 0 ? (
        <div className="text-center py-12">
          <div className="w-16 h-16 mx-auto mb-4 bg-gradient-primary rounded-xl flex items-center justify-center">
            <span className="text-2xl">⛏️</span>
          </div>
          <h3 className="text-xl font-semibold mb-2">No miners found yet</h3>
          <p className="text-muted-foreground mb-6">
            Start by scanning your network or adding miners manually
          </p>
          <AddMinerDialog onAddMiner={handleAddMiner} />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {devices.map((miner) => (
            <MinerCard
              key={miner.IP}
              miner={miner}
              onStatusCheck={handleStatusCheck}
              onDelete={() => removeDevice(miner.IP)}
              onOpenWebView={handleOpenWebView}
              onUpdateName={updateDeviceName}
            />
          ))}
        </div>
      )}

      {webViewMiner && (
        <WebViewFrame
          url={`http://${webViewMiner.IP}`}
          title={`${webViewMiner.IP} Interface`}
          onClose={handleCloseWebView}
        />
      )}
    </div>
  );
}