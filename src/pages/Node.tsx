import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import {
  Server, Globe, Activity, Layers, Database, Shield, Users,
  ArrowUpDown, Wifi, WifiOff, RefreshCw, HardDrive, Clock,
  CheckCircle2, AlertCircle, Cpu, Network, Box
} from "lucide-react";
import { toast } from "sonner";
import { useNodeStats } from "@/hooks/useNodeStats";

const Node = () => {
  const {
    config, updateConfig, connect, isConnected, isLoading,
    nodeInfo, peers, mempool, recentBlocks, syncProgress, error
  } = useNodeStats();

  const formatBytes = (bytes: number) => {
    if (bytes >= 1e12) return `${(bytes / 1e12).toFixed(2)} TB`;
    if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(2)} GB`;
    if (bytes >= 1e6) return `${(bytes / 1e6).toFixed(2)} MB`;
    return `${(bytes / 1e3).toFixed(0)} KB`;
  };

  const formatDifficulty = (d: number) => {
    if (d >= 1e12) return `${(d / 1e12).toFixed(2)}T`;
    if (d >= 1e9) return `${(d / 1e9).toFixed(2)}G`;
    if (d >= 1e6) return `${(d / 1e6).toFixed(2)}M`;
    return d.toFixed(2);
  };

  const isSynced = syncProgress >= 99.99;

  const StatCard = ({ title, value, sub, icon: Icon, accent }: { title: string; value: string; sub?: string; icon: any; accent?: string }) => (
    <div className="rounded-xl border border-border/40 bg-card/60 backdrop-blur-sm p-3 sm:p-4 transition-all duration-300 hover:border-primary/30 hover:-translate-y-0.5">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] sm:text-xs font-mono uppercase tracking-wider text-muted-foreground">{title}</span>
        <Icon className={`h-3.5 w-3.5 sm:h-4 sm:w-4 ${accent || "text-primary"}`} />
      </div>
      <p className={`text-lg sm:text-2xl font-black font-mono ${accent || "text-foreground"}`}>{value}</p>
      {sub && <p className="text-[9px] sm:text-[10px] text-muted-foreground font-mono">{sub}</p>}
    </div>
  );

  return (
    <ScrollArea className="h-[calc(100vh-3.5rem)]">
      <div className="p-4 sm:p-6 space-y-4 sm:space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10 border border-primary/20">
              <Server className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black font-mono tracking-tight">Bitcoin Node</h1>
              <p className="text-[10px] text-muted-foreground font-mono uppercase tracking-widest">Full Node Monitor</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={connect} disabled={isLoading}>
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
            <Badge variant={isConnected ? "default" : "secondary"} className="gap-1 text-[10px] sm:text-xs font-mono">
              {isConnected ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
              {isLoading ? "Connecting..." : isConnected ? "Connected" : "Offline"}
            </Badge>
          </div>
        </div>

        {/* Sync Progress Bar */}
        {isConnected && !isSynced && (
          <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-bold text-primary flex items-center gap-2">
                <Activity className="h-3.5 w-3.5 animate-pulse" /> Syncing Blockchain
              </span>
              <span className="text-xs font-mono font-bold">{syncProgress.toFixed(2)}%</span>
            </div>
            <div className="relative">
              <Progress value={syncProgress} className="h-3" />
              <div 
                className="absolute inset-0 rounded-full overflow-hidden"
                style={{
                  background: `linear-gradient(90deg, hsl(var(--primary) / 0.2) ${syncProgress}%, transparent ${syncProgress}%)`,
                  boxShadow: `0 0 ${Math.max(5, syncProgress / 5)}px hsl(var(--primary) / ${syncProgress / 200})`,
                }}
              />
            </div>
            <div className="flex justify-between text-[9px] font-mono text-muted-foreground">
              <span>Block {nodeInfo?.blocks?.toLocaleString()}</span>
              <span>Header {nodeInfo?.headers?.toLocaleString()}</span>
            </div>
          </div>
        )}

        {isConnected && isSynced && (
          <div className="rounded-xl border border-accent/30 bg-accent/5 p-3 flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 text-accent shrink-0" />
            <div>
              <p className="text-xs font-mono font-bold text-accent">Fully Synced</p>
              <p className="text-[10px] font-mono text-muted-foreground">Block {nodeInfo?.blocks?.toLocaleString()} • {nodeInfo?.chain}</p>
            </div>
          </div>
        )}

        <Tabs defaultValue={isConnected ? "overview" : "connect"} className="space-y-4">
          <TabsList className="grid w-full grid-cols-4 h-9 bg-card/50 border border-border/30">
            <TabsTrigger value="overview" className="text-xs font-mono">Overview</TabsTrigger>
            <TabsTrigger value="peers" className="text-xs font-mono">Peers</TabsTrigger>
            <TabsTrigger value="blocks" className="text-xs font-mono">Blocks</TabsTrigger>
            <TabsTrigger value="connect" className="text-xs font-mono">Connect</TabsTrigger>
          </TabsList>

          {/* Overview */}
          <TabsContent value="overview" className="space-y-4">
            {!isConnected ? (
              <div className="rounded-xl border border-dashed border-border/50 bg-card/20 p-6 text-center">
                <Server className="h-10 w-10 mx-auto mb-3 text-muted-foreground/30" />
                <p className="text-sm font-mono font-bold text-muted-foreground">Node not connected</p>
                <p className="text-xs text-muted-foreground mt-1">Go to Connect tab to configure your Bitcoin node RPC</p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
                  <StatCard title="Block Height" value={nodeInfo?.blocks?.toLocaleString() || "—"} sub={nodeInfo?.chain || ""} icon={Layers} accent="text-primary" />
                  <StatCard title="Connections" value={String(nodeInfo?.connections || 0)} sub={`In: ${nodeInfo?.connections_in || 0} Out: ${nodeInfo?.connections_out || 0}`} icon={Users} />
                  <StatCard title="Difficulty" value={formatDifficulty(nodeInfo?.difficulty || 0)} icon={Shield} accent="text-accent" />
                  <StatCard title="Disk Usage" value={nodeInfo?.size_on_disk ? formatBytes(nodeInfo.size_on_disk) : "—"} sub={nodeInfo?.pruned ? `Pruned to ${nodeInfo.pruneheight}` : "Full"} icon={HardDrive} />
                </div>

                {/* Mempool */}
                {mempool && (
                  <div className="rounded-xl border border-border/40 bg-card/40 backdrop-blur-sm p-4">
                    <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-3 flex items-center gap-2 font-mono">
                      <Database className="h-3 w-3 text-primary" /> Mempool
                    </h3>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="text-center p-3 rounded-lg bg-muted/30">
                        <p className="text-lg font-black font-mono">{mempool.size.toLocaleString()}</p>
                        <p className="text-[9px] text-muted-foreground font-mono uppercase">Transactions</p>
                      </div>
                      <div className="text-center p-3 rounded-lg bg-muted/30">
                        <p className="text-lg font-black font-mono">{formatBytes(mempool.bytes)}</p>
                        <p className="text-[9px] text-muted-foreground font-mono uppercase">Size</p>
                      </div>
                      <div className="text-center p-3 rounded-lg bg-muted/30">
                        <p className="text-lg font-black font-mono">{mempool.total_fee?.toFixed(4) || "0"}</p>
                        <p className="text-[9px] text-muted-foreground font-mono uppercase">Total Fee BTC</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Node Info */}
                <div className="rounded-xl border border-border/40 bg-card/40 backdrop-blur-sm p-4">
                  <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-3 flex items-center gap-2 font-mono">
                    <Cpu className="h-3 w-3 text-primary" /> Node Info
                  </h3>
                  <div className="space-y-2">
                    {[
                      { label: "Version", value: nodeInfo?.subversion || "—" },
                      { label: "Protocol", value: String(nodeInfo?.protocolversion || "—") },
                      { label: "Network", value: nodeInfo?.chain || "—" },
                      { label: "Pruned", value: nodeInfo?.pruned ? "Yes" : "No" },
                    ].map(item => (
                      <div key={item.label} className="flex justify-between p-2 rounded-lg bg-muted/20 hover:bg-muted/30 transition-colors">
                        <span className="text-[10px] font-mono text-muted-foreground uppercase">{item.label}</span>
                        <span className="text-xs font-mono font-bold">{item.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </TabsContent>

          {/* Peers / Map */}
          <TabsContent value="peers" className="space-y-4">
            {!isConnected ? (
              <div className="rounded-xl border border-dashed border-border/50 bg-card/20 p-6 text-center">
                <Globe className="h-10 w-10 mx-auto mb-3 text-muted-foreground/30" />
                <p className="text-sm font-mono text-muted-foreground">Connect to your node to see peers</p>
              </div>
            ) : (
              <>
                {/* World Map Visualization */}
                <div className="rounded-xl border border-border/40 bg-card/40 backdrop-blur-sm p-4">
                  <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-3 flex items-center gap-2 font-mono">
                    <Globe className="h-3 w-3 text-primary" /> Peer Network Map
                  </h3>
                  <div className="relative w-full aspect-[2/1] bg-muted/20 rounded-lg overflow-hidden border border-border/20">
                    {/* Simple world map background */}
                    <svg viewBox="0 0 1000 500" className="w-full h-full opacity-20">
                      {/* Simplified continent outlines */}
                      <ellipse cx="250" cy="200" rx="120" ry="80" fill="none" stroke="hsl(var(--primary))" strokeWidth="1" opacity="0.5" />
                      <ellipse cx="500" cy="180" rx="100" ry="90" fill="none" stroke="hsl(var(--primary))" strokeWidth="1" opacity="0.5" />
                      <ellipse cx="700" cy="220" rx="130" ry="70" fill="none" stroke="hsl(var(--primary))" strokeWidth="1" opacity="0.5" />
                      <ellipse cx="300" cy="350" rx="60" ry="50" fill="none" stroke="hsl(var(--primary))" strokeWidth="1" opacity="0.5" />
                      <ellipse cx="800" cy="350" rx="80" ry="40" fill="none" stroke="hsl(var(--primary))" strokeWidth="1" opacity="0.5" />
                    </svg>
                    
                    {/* Center node (you) */}
                    <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
                      <div className="relative">
                        <div className="w-4 h-4 rounded-full bg-primary animate-pulse" />
                        <div className="absolute inset-0 w-4 h-4 rounded-full bg-primary/30 animate-ping" />
                      </div>
                    </div>

                    {/* Peer dots distributed around */}
                    {peers.slice(0, 50).map((peer, i) => {
                      const angle = (i / Math.min(peers.length, 50)) * Math.PI * 2;
                      const radius = 30 + Math.random() * 15;
                      const x = 50 + Math.cos(angle) * radius;
                      const y = 50 + Math.sin(angle) * radius;
                      return (
                        <div
                          key={peer.id}
                          className="absolute"
                          style={{
                            left: `${Math.max(5, Math.min(95, x))}%`,
                            top: `${Math.max(5, Math.min(95, y))}%`,
                            transform: 'translate(-50%, -50%)',
                          }}
                        >
                          <div className={`w-2 h-2 rounded-full ${peer.inbound ? 'bg-accent' : 'bg-primary'} opacity-70`} />
                          {/* Connection line to center */}
                          <svg className="absolute top-1/2 left-1/2" style={{ width: '1px', height: '1px', overflow: 'visible' }}>
                            <line
                              x1="0" y1="0"
                              x2={`${(50 - Math.max(5, Math.min(95, x))) * 5}px`}
                              y2={`${(50 - Math.max(5, Math.min(95, y))) * 2.5}px`}
                              stroke="hsl(var(--primary))"
                              strokeWidth="0.5"
                              opacity="0.15"
                            />
                          </svg>
                        </div>
                      );
                    })}
                    
                    {/* Legend */}
                    <div className="absolute bottom-2 left-2 flex items-center gap-3 text-[8px] font-mono text-muted-foreground">
                      <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-primary" /> Outbound</span>
                      <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-accent" /> Inbound</span>
                    </div>
                    <div className="absolute top-2 right-2 text-[10px] font-mono font-bold text-primary">
                      {peers.length} peers
                    </div>
                  </div>
                </div>

                {/* Peer List */}
                <div className="rounded-xl border border-border/40 bg-card/40 backdrop-blur-sm p-4">
                  <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-3 flex items-center gap-2 font-mono">
                    <Network className="h-3 w-3 text-primary" /> Connected Peers ({peers.length})
                  </h3>
                  <div className="space-y-1.5 max-h-[400px] overflow-y-auto">
                    {peers.map((peer) => (
                      <div key={peer.id} className="p-2.5 rounded-lg bg-muted/20 hover:bg-muted/30 transition-colors">
                        <div className="flex items-center justify-between mb-1">
                          <code className="text-[10px] font-mono font-bold truncate max-w-[60%]">{peer.addr}</code>
                          <Badge variant={peer.inbound ? "secondary" : "default"} className="text-[8px] font-mono">
                            {peer.inbound ? "IN" : "OUT"}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-3 text-[9px] text-muted-foreground font-mono">
                          <span>{peer.subver}</span>
                          <span>↑{formatBytes(peer.bytessent)}</span>
                          <span>↓{formatBytes(peer.bytesrecv)}</span>
                          {peer.pingtime && <span>{(peer.pingtime * 1000).toFixed(0)}ms</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </TabsContent>

          {/* Blocks */}
          <TabsContent value="blocks" className="space-y-4">
            {!isConnected ? (
              <div className="rounded-xl border border-dashed border-border/50 bg-card/20 p-6 text-center">
                <Layers className="h-10 w-10 mx-auto mb-3 text-muted-foreground/30" />
                <p className="text-sm font-mono text-muted-foreground">Connect to your node to see recent blocks</p>
              </div>
            ) : (
              <>
                {/* Block Strip */}
                <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin">
                  {recentBlocks.map((block, i) => (
                    <div
                      key={block.hash}
                      className="shrink-0 w-24 sm:w-28 rounded-xl border border-border/40 bg-card/60 backdrop-blur-sm p-3 hover:border-primary/40 transition-all hover:-translate-y-1 group cursor-default"
                    >
                      {/* Mini 3D block */}
                      <div className="relative w-10 h-10 mx-auto mb-2">
                        <div className="absolute inset-0 rounded-md bg-gradient-to-br from-primary/40 to-primary/10 border border-primary/30 transform rotate-3 group-hover:rotate-6 transition-transform" />
                        <div className="absolute inset-0 rounded-md bg-gradient-to-br from-primary/30 to-primary/5 border border-primary/20 flex items-center justify-center">
                          <Box className="h-4 w-4 text-primary/70" />
                        </div>
                      </div>
                      <p className="text-xs font-mono font-black text-center text-primary">#{block.height.toLocaleString()}</p>
                      <p className="text-[8px] font-mono text-center text-muted-foreground mt-0.5">{block.nTx} txs</p>
                      <p className="text-[8px] font-mono text-center text-muted-foreground">{formatBytes(block.size)}</p>
                    </div>
                  ))}
                </div>

                {/* Block Details */}
                <div className="rounded-xl border border-border/40 bg-card/40 backdrop-blur-sm p-4">
                  <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-3 flex items-center gap-2 font-mono">
                    <Layers className="h-3 w-3 text-primary" /> Recent Blocks
                  </h3>
                  <div className="space-y-2">
                    {recentBlocks.map((block) => (
                      <div key={block.hash} className="p-3 rounded-lg bg-muted/20 hover:bg-muted/30 transition-colors">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-mono font-bold text-primary">#{block.height.toLocaleString()}</span>
                          <span className="text-[10px] text-muted-foreground font-mono">
                            {new Date(block.time * 1000).toLocaleString()}
                          </span>
                        </div>
                        <p className="text-[9px] text-muted-foreground font-mono truncate">{block.hash}</p>
                        <div className="flex gap-4 mt-1 text-[10px] font-mono text-muted-foreground">
                          <span>{block.nTx} transactions</span>
                          <span>{formatBytes(block.size)}</span>
                          <span>Weight: {(block.weight / 1e6).toFixed(2)}M</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </TabsContent>

          {/* Connect */}
          <TabsContent value="connect" className="space-y-4">
            <div className="rounded-xl border border-border/40 bg-card/40 backdrop-blur-sm p-4">
              <div className="flex items-center gap-2 mb-3">
                <Server className="h-4 w-4 text-primary" />
                <span className="text-sm font-bold font-mono">Node RPC Connection</span>
              </div>
              <p className="text-xs text-muted-foreground font-mono mb-4">
                Connect to your local Bitcoin Core node via RPC to monitor sync, peers, and blocks.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label className="text-[10px] font-mono uppercase">RPC Host</Label>
                  <Input placeholder="127.0.0.1" value={config.host} onChange={(e) => updateConfig({ host: e.target.value })} className="font-mono text-sm mt-1" />
                </div>
                <div>
                  <Label className="text-[10px] font-mono uppercase">RPC Port</Label>
                  <Input placeholder="8332" value={config.port} onChange={(e) => updateConfig({ port: e.target.value })} className="font-mono text-sm mt-1" />
                </div>
                <div>
                  <Label className="text-[10px] font-mono uppercase">RPC User</Label>
                  <Input placeholder="user" value={config.user} onChange={(e) => updateConfig({ user: e.target.value })} className="font-mono text-sm mt-1" />
                </div>
                <div>
                  <Label className="text-[10px] font-mono uppercase">RPC Password</Label>
                  <Input type="password" placeholder="••••••" value={config.pass} onChange={(e) => updateConfig({ pass: e.target.value })} className="font-mono text-sm mt-1" />
                </div>
              </div>

              <Button onClick={connect} className="mt-4 w-full font-mono text-xs" disabled={isLoading}>
                {isLoading ? (
                  <><RefreshCw className="h-3 w-3 mr-2 animate-spin" /> Connecting...</>
                ) : (
                  <><Wifi className="h-3 w-3 mr-2" /> Connect to Node</>
                )}
              </Button>

              {isConnected && (
                <p className="text-xs text-accent font-mono mt-2 flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" /> Connected — {nodeInfo?.subversion}
                </p>
              )}
              {error && (
                <p className="text-xs text-destructive font-mono mt-2 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" /> {error}
                </p>
              )}
            </div>

            {/* Setup Guide */}
            <div className="rounded-xl border border-dashed border-border/40 bg-card/20 p-4">
              <p className="text-xs font-mono text-muted-foreground leading-relaxed">
                <strong className="text-foreground">Setup Guide:</strong> Install Bitcoin Core from{" "}
                <code className="text-primary">bitcoincore.org</code>. Add these to your <code className="text-primary">bitcoin.conf</code>:
              </p>
              <pre className="mt-2 p-3 rounded-lg bg-muted/40 text-[10px] font-mono text-foreground overflow-x-auto">
{`server=1
rpcuser=yourusername
rpcpassword=yourpassword
rpcallowip=127.0.0.1

# For pruned node (saves disk space):
prune=550

# Or full node:
# txindex=1`}
              </pre>
              <p className="text-[10px] font-mono text-muted-foreground mt-2">
                Pruned mode keeps only the most recent blocks (~550MB min). Full node stores the entire blockchain (~600GB+).
              </p>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </ScrollArea>
  );
};

export default Node;
