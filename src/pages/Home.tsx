import { useState } from "react";
import { MinerCard } from "@/components/miners/MinerCard";
import { AddMinerDialog } from "@/components/miners/AddMinerDialog";
import { WebViewFrame } from "@/components/webview/WebViewFrame";
import { useNetworkScanner, MinerDevice } from "@/hooks/useNetworkScanner";
import { useMinerNotifications } from "@/hooks/useMinerNotifications";
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
  
  // Enable notifications for block found and temp warnings
  useMinerNotifications(devices);
  
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
      <AnimatedCard animation="fade">
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/5 via-accent/5 to-primary/5 border border-primary/10 backdrop-blur-sm p-8">
          <div className="absolute inset-0 bg-gradient-to-r from-primary/10 to-transparent opacity-50" />
          <div className="relative flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="space-y-3">
              <h1 
                className="text-5xl md:text-6xl font-black bg-gradient-primary bg-clip-text text-transparent animate-in fade-in-0 slide-in-from-left-5 duration-700"
                style={{
                  textShadow: '0 0 40px hsl(var(--primary) / 0.3)'
                }}
              >
                AxeMobile
              </h1>
              <p className="text-muted-foreground text-xl animate-in fade-in-0 slide-in-from-left-5 duration-700 font-medium" style={{ animationDelay: '100ms' }}>
                Open Source Bitcoin Mining Dashboard
              </p>
            </div>
            <div className="animate-in fade-in-0 scale-in-0 duration-700" style={{ animationDelay: '200ms' }}>
              <AddMinerDialog onAddMiner={handleAddMiner} />
            </div>
          </div>
        </div>
      </AnimatedCard>

      {/* Stats Overview */}
      {devices.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <AnimatedCard delay={300} animation="slide-up">
            <Card className="group relative overflow-hidden bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border-primary/30 hover:border-primary/50 hover:shadow-glow transition-all duration-500">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <CardContent className="relative pt-6 pb-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Active Miners</p>
                    <p className="text-4xl font-black bg-gradient-primary bg-clip-text text-transparent"
                       style={{ textShadow: '0 0 20px hsl(var(--primary) / 0.3)' }}>
                      {activeDevices}<span className="text-2xl text-muted-foreground/50">/{devices.length}</span>
                    </p>
                  </div>
                  <div className="p-4 rounded-2xl bg-primary/20 group-hover:bg-primary/30 transition-colors duration-500">
                    <Activity className="h-8 w-8 text-primary group-hover:scale-110 transition-transform duration-500" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </AnimatedCard>

          <AnimatedCard delay={400} animation="slide-up">
            <Card className="group relative overflow-hidden bg-gradient-to-br from-success/10 via-success/5 to-transparent border-success/30 hover:border-success/50 hover:shadow-glow transition-all duration-500">
              <div className="absolute inset-0 bg-gradient-to-br from-success/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <CardContent className="relative pt-6 pb-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Total Hashrate</p>
                    <p className="text-4xl font-black text-success"
                       style={{ textShadow: '0 0 20px hsl(var(--success) / 0.3)' }}>
                      {totalHashRate.toFixed(2)}<span className="text-xl text-muted-foreground/70 ml-1">GH/s</span>
                    </p>
                  </div>
                  <div className="p-4 rounded-2xl bg-success/20 group-hover:bg-success/30 transition-colors duration-500">
                    <Cpu className="h-8 w-8 text-success group-hover:scale-110 transition-transform duration-500" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </AnimatedCard>

          <AnimatedCard delay={500} animation="slide-up">
            <Card className="group relative overflow-hidden bg-gradient-to-br from-warning/10 via-warning/5 to-transparent border-warning/30 hover:border-warning/50 hover:shadow-glow transition-all duration-500">
              <div className="absolute inset-0 bg-gradient-to-br from-warning/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <CardContent className="relative pt-6 pb-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Total Power</p>
                    <p className="text-4xl font-black text-warning"
                       style={{ textShadow: '0 0 20px hsl(var(--warning) / 0.3)' }}>
                      {totalPower.toFixed(0)}<span className="text-xl text-muted-foreground/70 ml-1">W</span>
                    </p>
                  </div>
                  <div className="p-4 rounded-2xl bg-warning/20 group-hover:bg-warning/30 transition-colors duration-500">
                    <Zap className="h-8 w-8 text-warning group-hover:scale-110 transition-transform duration-500" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </AnimatedCard>
        </div>
      )}

      {/* Miners Grid */}
      {devices.length === 0 ? (
        <AnimatedCard delay={300} animation="scale">
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-card via-card to-card/50 border border-primary/20 backdrop-blur-sm">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,hsl(var(--primary)/0.1),transparent_50%)]" />
            <div className="relative text-center py-24 px-8">
              <div className="w-32 h-32 mx-auto mb-8 bg-gradient-primary rounded-3xl flex items-center justify-center animate-float shadow-glow">
                <span className="text-7xl">⛏️</span>
              </div>
              <h3 className="text-3xl font-black mb-4 bg-gradient-primary bg-clip-text text-transparent"
                  style={{ textShadow: '0 0 40px hsl(var(--primary) / 0.3)' }}>
                No Miners Detected
              </h3>
              <p className="text-muted-foreground mb-10 text-lg max-w-md mx-auto">
                Connect your BitAxe or NerdAxe miners to start monitoring your mining operation
              </p>
              <AddMinerDialog onAddMiner={handleAddMiner} />
            </div>
          </div>
        </AnimatedCard>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {devices.map((miner, index) => (
            <AnimatedCard key={miner.IP} delay={600 + index * 50} animation="slide-up">
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