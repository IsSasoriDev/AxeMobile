import { useState } from "react";
import { MinerCard } from "@/components/miners/MinerCard";
import { AddMinerDialog } from "@/components/miners/AddMinerDialog";
import { WebViewFrame } from "@/components/webview/WebViewFrame";
import { useNetworkScanner, MinerDevice } from "@/hooks/useNetworkScanner";
import { AnimatedCard } from "@/components/ui/animated-card";
import { Activity, Zap, Cpu } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export default function Home() {
  const { 
    devices, 
    addDevice, 
    removeDevice, 
    refreshDevices, 
    updateDeviceName,
    totalHashRate,
    totalPower,
    activeDevices
  } = useNetworkScanner();
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
    <div className="min-h-screen p-4 md:p-6 space-y-6">
      {/* Header Section */}
      <AnimatedCard>
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-2">
            <h1 className="text-4xl md:text-5xl font-bold bg-gradient-primary bg-clip-text text-transparent animate-in fade-in-0 slide-in-from-left-5 duration-700">
              AxeMobile Dashboard
            </h1>
            <p className="text-muted-foreground text-lg animate-in fade-in-0 slide-in-from-left-5 duration-700" style={{ animationDelay: '100ms' }}>
              Unleash the Open Source power
            </p>
          </div>
          <div className="animate-in fade-in-0 slide-in-from-right-5 duration-700" style={{ animationDelay: '200ms' }}>
            <AddMinerDialog onAddMiner={handleAddMiner} />
          </div>
        </div>
      </AnimatedCard>

      {/* Stats Overview */}
      {devices.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <AnimatedCard delay={300}>
            <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20 hover:scale-105 transition-transform duration-300">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-xl bg-primary/20">
                    <Activity className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Active Miners</p>
                    <p className="text-2xl font-bold">{activeDevices}/{devices.length}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </AnimatedCard>

          <AnimatedCard delay={400}>
            <Card className="bg-gradient-to-br from-success/10 to-success/5 border-success/20 hover:scale-105 transition-transform duration-300">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-xl bg-success/20">
                    <Cpu className="h-6 w-6 text-success" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Total Hashrate</p>
                    <p className="text-2xl font-bold">{totalHashRate.toFixed(2)} GH/s</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </AnimatedCard>

          <AnimatedCard delay={500}>
            <Card className="bg-gradient-to-br from-warning/10 to-warning/5 border-warning/20 hover:scale-105 transition-transform duration-300">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-xl bg-warning/20">
                    <Zap className="h-6 w-6 text-warning" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Total Power</p>
                    <p className="text-2xl font-bold">{totalPower.toFixed(0)} W</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </AnimatedCard>
        </div>
      )}

      {/* Miners Grid */}
      {devices.length === 0 ? (
        <AnimatedCard delay={300}>
          <div className="text-center py-20">
            <div className="w-24 h-24 mx-auto mb-6 bg-gradient-primary rounded-2xl flex items-center justify-center animate-pulse shadow-glow">
              <span className="text-5xl">⛏️</span>
            </div>
            <h3 className="text-2xl font-bold mb-3 bg-gradient-primary bg-clip-text text-transparent">
              No miners found yet
            </h3>
            <p className="text-muted-foreground mb-8 text-lg">
              Start by scanning your network or adding miners manually
            </p>
            <AddMinerDialog onAddMiner={handleAddMiner} />
          </div>
        </AnimatedCard>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {devices.map((miner, index) => (
            <AnimatedCard key={miner.IP} delay={600 + index * 100}>
              <MinerCard
                miner={miner}
                onStatusCheck={handleStatusCheck}
                onDelete={() => removeDevice(miner.IP)}
                onOpenWebView={handleOpenWebView}
                onUpdateName={updateDeviceName}
              />
            </AnimatedCard>
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