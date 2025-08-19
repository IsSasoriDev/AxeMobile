import { useState } from "react";
import { MinerCard } from "@/components/miners/MinerCard";
import { AddMinerDialog } from "@/components/miners/AddMinerDialog";
import { WebViewFrame } from "@/components/webview/WebViewFrame";
import { useMinerStorage, Miner } from "@/hooks/useMinerStorage";

export default function Home() {
  const { miners, addMiner, deleteMiner, checkMinerStatus } = useMinerStorage();
  const [webViewMiner, setWebViewMiner] = useState<Miner | null>(null);

  const handleOpenWebView = (miner: Miner) => {
    setWebViewMiner(miner);
  };

  const handleCloseWebView = () => {
    setWebViewMiner(null);
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
        <AddMinerDialog onAddMiner={addMiner} />
      </div>

      {miners.length === 0 ? (
        <div className="text-center py-12">
          <div className="w-16 h-16 mx-auto mb-4 bg-gradient-primary rounded-xl flex items-center justify-center">
            <span className="text-2xl">⛏️</span>
          </div>
          <h3 className="text-xl font-semibold mb-2">No miners added yet</h3>
          <p className="text-muted-foreground mb-6">
            Start by adding your first Bitcoin miner to the dashboard
          </p>
          <AddMinerDialog onAddMiner={addMiner} />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {miners.map((miner) => (
            <MinerCard
              key={miner.id}
              miner={miner}
              onStatusCheck={checkMinerStatus}
              onDelete={deleteMiner}
              onOpenWebView={handleOpenWebView}
            />
          ))}
        </div>
      )}

      {webViewMiner && (
        <WebViewFrame
          url={`http://${webViewMiner.ipAddress}`}
          title={`${webViewMiner.name} Interface`}
          onClose={handleCloseWebView}
        />
      )}
    </div>
  );
}