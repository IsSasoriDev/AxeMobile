import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, AreaChart, Area, BarChart, Bar, Legend } from "recharts";
import { 
  Server, 
  Cpu, 
  Activity, 
  Zap, 
  Clock, 
  Hash, 
  Blocks, 
  TrendingUp,
  Users,
  Settings,
  RefreshCw,
  Play,
  Pause,
  AlertCircle,
  CheckCircle2,
  Pickaxe,
  Bitcoin,
  Network,
  Timer,
  Target
} from "lucide-react";
import { toast } from "sonner";

interface NodeInfo {
  chain: string;
  blocks: number;
  headers: number;
  bestblockhash: string;
  difficulty: number;
  mediantime: number;
  verificationprogress: number;
  initialblockdownload: boolean;
  chainwork: string;
  size_on_disk: number;
  pruned: boolean;
  version: number;
  subversion: string;
  connections: number;
  connected: boolean;
}

interface MiningInfo {
  blocks: number;
  difficulty: number;
  networkhashps: number;
  pooledtx: number;
  chain: string;
  warnings: string;
}

interface PoolMiner {
  id: string;
  address: string;
  name: string;
  hashrate: number;
  shares: number;
  lastSeen: Date;
  active: boolean;
}

interface PoolStats {
  totalHashrate: number;
  activeMiners: number;
  totalShares: number;
  blocksFound: number;
  lastBlockTime: Date | null;
  poolDifficulty: number;
}

interface BlockTemplate {
  version: number;
  previousblockhash: string;
  transactions: any[];
  coinbasevalue: number;
  height: number;
  target: string;
  mintime: number;
  curtime: number;
  bits: string;
}

interface HashRateDataPoint {
  time: string;
  hashrate: number;
  shares: number;
}

interface SharesDataPoint {
  time: string;
  accepted: number;
  rejected: number;
}

const AxePool = () => {
  // Bitcoin Core/Knots RPC Settings
  const [rpcHost, setRpcHost] = useState(() => localStorage.getItem('AXEPOOL_RPC_HOST') || 'bitcoin.embassy');
  const [rpcPort, setRpcPort] = useState(() => localStorage.getItem('AXEPOOL_RPC_PORT') || '8332');
  const [rpcUser, setRpcUser] = useState(() => localStorage.getItem('AXEPOOL_RPC_USER') || '');
  const [rpcPassword, setRpcPassword] = useState(() => localStorage.getItem('AXEPOOL_RPC_PASSWORD') || '');
  
  // Pool Settings
  const [poolAddress, setPoolAddress] = useState(() => localStorage.getItem('AXEPOOL_ADDRESS') || '');
  const [poolDifficulty, setPoolDifficulty] = useState(() => Number(localStorage.getItem('AXEPOOL_DIFFICULTY')) || 1);
  const [poolEnabled, setPoolEnabled] = useState(false);
  
  // State
  const [nodeInfo, setNodeInfo] = useState<NodeInfo | null>(null);
  const [miningInfo, setMiningInfo] = useState<MiningInfo | null>(null);
  const [blockTemplate, setBlockTemplate] = useState<BlockTemplate | null>(null);
  const [miners, setMiners] = useState<PoolMiner[]>([]);
  const [poolStats, setPoolStats] = useState<PoolStats>({
    totalHashrate: 0,
    activeMiners: 0,
    totalShares: 0,
    blocksFound: 0,
    lastBlockTime: null,
    poolDifficulty: 1,
  });
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [hashrateHistory, setHashrateHistory] = useState<HashRateDataPoint[]>([]);
  const [sharesHistory, setSharesHistory] = useState<SharesDataPoint[]>([]);

  // Save settings to localStorage
  useEffect(() => {
    localStorage.setItem('AXEPOOL_RPC_HOST', rpcHost);
    localStorage.setItem('AXEPOOL_RPC_PORT', rpcPort);
    localStorage.setItem('AXEPOOL_RPC_USER', rpcUser);
    localStorage.setItem('AXEPOOL_RPC_PASSWORD', rpcPassword);
    localStorage.setItem('AXEPOOL_ADDRESS', poolAddress);
    localStorage.setItem('AXEPOOL_DIFFICULTY', poolDifficulty.toString());
  }, [rpcHost, rpcPort, rpcUser, rpcPassword, poolAddress, poolDifficulty]);

  // RPC call helper
  const rpcCall = useCallback(async (method: string, params: any[] = []) => {
    try {
      const response = await fetch(`http://${rpcHost}:${rpcPort}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Basic ' + btoa(`${rpcUser}:${rpcPassword}`),
        },
        body: JSON.stringify({
          jsonrpc: '1.0',
          id: Date.now(),
          method,
          params,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      if (data.error) {
        throw new Error(data.error.message);
      }
      return data.result;
    } catch (error) {
      console.error(`RPC ${method} error:`, error);
      throw error;
    }
  }, [rpcHost, rpcPort, rpcUser, rpcPassword]);

  // Connect to Bitcoin node
  const connectToNode = async () => {
    setIsConnecting(true);
    try {
      const blockchainInfo = await rpcCall('getblockchaininfo');
      const mInfo = await rpcCall('getmininginfo');
      const networkInfo = await rpcCall('getnetworkinfo');
      
      setNodeInfo({
        ...blockchainInfo,
        version: networkInfo.version,
        subversion: networkInfo.subversion,
        connections: networkInfo.connections,
        connected: true,
      });
      
      setMiningInfo(mInfo);
      setIsConnected(true);
      toast.success('Connected to Bitcoin node!');
    } catch (error) {
      console.error('Connection error:', error);
      toast.error('Failed to connect to Bitcoin node. Check your RPC settings.');
      setIsConnected(false);
    } finally {
      setIsConnecting(false);
    }
  };

  // Get block template for mining
  const getBlockTemplate = async () => {
    if (!isConnected) return;
    try {
      const template = await rpcCall('getblocktemplate', [{ rules: ['segwit'] }]);
      setBlockTemplate(template);
    } catch (error) {
      console.error('Block template error:', error);
    }
  };

  // Refresh node info
  const refreshNodeInfo = useCallback(async () => {
    if (!isConnected) return;
    try {
      const blockchainInfo = await rpcCall('getblockchaininfo');
      const mInfo = await rpcCall('getmininginfo');
      const networkInfo = await rpcCall('getnetworkinfo');
      
      setNodeInfo(prev => ({
        ...blockchainInfo,
        version: networkInfo.version,
        subversion: networkInfo.subversion,
        connections: networkInfo.connections,
        connected: true,
      }));
      
      setMiningInfo(mInfo);
    } catch (error) {
      console.error('Refresh error:', error);
      setIsConnected(false);
    }
  }, [isConnected, rpcCall]);

  // Auto refresh
  useEffect(() => {
    if (!isConnected) return;
    const interval = setInterval(() => {
      refreshNodeInfo();
      getBlockTemplate();
    }, 10000);
    return () => clearInterval(interval);
  }, [isConnected, refreshNodeInfo]);

  // Generate mock hashrate history for demo
  useEffect(() => {
    const now = new Date();
    const history: HashRateDataPoint[] = [];
    const sharesHist: SharesDataPoint[] = [];
    
    for (let i = 23; i >= 0; i--) {
      const time = new Date(now.getTime() - i * 3600000);
      history.push({
        time: time.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
        hashrate: Math.random() * 500 + 100,
        shares: Math.floor(Math.random() * 50),
      });
      sharesHist.push({
        time: time.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
        accepted: Math.floor(Math.random() * 45 + 5),
        rejected: Math.floor(Math.random() * 3),
      });
    }
    
    setHashrateHistory(history);
    setSharesHistory(sharesHist);
  }, []);

  // Calculate estimated time to block
  const getEstimatedTimeToBlock = () => {
    if (!miningInfo || poolStats.totalHashrate === 0) return 'N/A';
    const networkHashrate = miningInfo.networkhashps;
    const poolHashrateGH = poolStats.totalHashrate; // GH/s
    const poolHashrateH = poolHashrateGH * 1e9; // Convert to H/s
    const expectedBlocks = (poolHashrateH / networkHashrate) * 144; // blocks per day
    if (expectedBlocks < 0.001) return '100+ years';
    const daysToBlock = 1 / expectedBlocks;
    if (daysToBlock > 365) return `${Math.round(daysToBlock / 365)} years`;
    if (daysToBlock > 30) return `${Math.round(daysToBlock / 30)} months`;
    if (daysToBlock > 1) return `${Math.round(daysToBlock)} days`;
    return `${Math.round(daysToBlock * 24)} hours`;
  };

  const formatHashrate = (hashrate: number) => {
    if (hashrate >= 1e18) return `${(hashrate / 1e18).toFixed(2)} EH/s`;
    if (hashrate >= 1e15) return `${(hashrate / 1e15).toFixed(2)} PH/s`;
    if (hashrate >= 1e12) return `${(hashrate / 1e12).toFixed(2)} TH/s`;
    if (hashrate >= 1e9) return `${(hashrate / 1e9).toFixed(2)} GH/s`;
    if (hashrate >= 1e6) return `${(hashrate / 1e6).toFixed(2)} MH/s`;
    if (hashrate >= 1e3) return `${(hashrate / 1e3).toFixed(2)} KH/s`;
    return `${hashrate.toFixed(2)} H/s`;
  };

  const formatDifficulty = (diff: number) => {
    if (diff >= 1e12) return `${(diff / 1e12).toFixed(2)}T`;
    if (diff >= 1e9) return `${(diff / 1e9).toFixed(2)}G`;
    if (diff >= 1e6) return `${(diff / 1e6).toFixed(2)}M`;
    if (diff >= 1e3) return `${(diff / 1e3).toFixed(2)}K`;
    return diff.toFixed(2);
  };

  const chartConfig = {
    hashrate: { label: "Hashrate", color: "hsl(var(--primary))" },
    shares: { label: "Shares", color: "hsl(var(--secondary))" },
    accepted: { label: "Accepted", color: "hsl(142, 76%, 36%)" },
    rejected: { label: "Rejected", color: "hsl(0, 84%, 60%)" },
  };

  return (
    <ScrollArea className="h-[calc(100vh-3.5rem)]">
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-orange-500 bg-clip-text text-transparent flex items-center gap-3">
              <Pickaxe className="h-8 w-8 text-primary" />
              AxePool
            </h1>
            <p className="text-muted-foreground mt-1">Solo mining pool for your Bitaxe miners</p>
          </div>
          <div className="flex items-center gap-4">
            <Badge variant={isConnected ? "default" : "secondary"} className="gap-2">
              {isConnected ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
              {isConnected ? 'Connected' : 'Disconnected'}
            </Badge>
            <Button 
              variant={poolEnabled ? "destructive" : "default"}
              onClick={() => setPoolEnabled(!poolEnabled)}
              disabled={!isConnected}
            >
              {poolEnabled ? <Pause className="mr-2 h-4 w-4" /> : <Play className="mr-2 h-4 w-4" />}
              {poolEnabled ? 'Stop Pool' : 'Start Pool'}
            </Button>
          </div>
        </div>

        <Tabs defaultValue="dashboard" className="space-y-4">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="miners">Miners</TabsTrigger>
            <TabsTrigger value="blocks">Blocks</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>

          {/* Dashboard Tab */}
          <TabsContent value="dashboard" className="space-y-6">
            {/* Node Status Cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card className="border-primary/20">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Block Height</CardTitle>
                  <Blocks className="h-4 w-4 text-primary" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{nodeInfo?.blocks?.toLocaleString() || '---'}</div>
                  <p className="text-xs text-muted-foreground">
                    {nodeInfo?.chain === 'main' ? 'Mainnet' : nodeInfo?.chain || 'Unknown'}
                  </p>
                </CardContent>
              </Card>

              <Card className="border-primary/20">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Network Hashrate</CardTitle>
                  <Hash className="h-4 w-4 text-primary" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {miningInfo ? formatHashrate(miningInfo.networkhashps) : '---'}
                  </div>
                  <p className="text-xs text-muted-foreground">Global hashpower</p>
                </CardContent>
              </Card>

              <Card className="border-primary/20">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Difficulty</CardTitle>
                  <Target className="h-4 w-4 text-primary" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {miningInfo ? formatDifficulty(miningInfo.difficulty) : '---'}
                  </div>
                  <p className="text-xs text-muted-foreground">Current difficulty</p>
                </CardContent>
              </Card>

              <Card className="border-primary/20">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Connections</CardTitle>
                  <Network className="h-4 w-4 text-primary" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{nodeInfo?.connections || '---'}</div>
                  <p className="text-xs text-muted-foreground">Peer connections</p>
                </CardContent>
              </Card>
            </div>

            {/* Pool Stats */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card className="bg-gradient-to-br from-orange-500/10 to-transparent border-orange-500/20">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Pool Hashrate</CardTitle>
                  <Zap className="h-4 w-4 text-orange-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-orange-500">
                    {poolStats.totalHashrate.toFixed(2)} GH/s
                  </div>
                  <p className="text-xs text-muted-foreground">From {poolStats.activeMiners} miners</p>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-green-500/10 to-transparent border-green-500/20">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Shares</CardTitle>
                  <Activity className="h-4 w-4 text-green-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-500">{poolStats.totalShares.toLocaleString()}</div>
                  <p className="text-xs text-muted-foreground">All time accepted</p>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-blue-500/10 to-transparent border-blue-500/20">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Blocks Found</CardTitle>
                  <Bitcoin className="h-4 w-4 text-blue-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-blue-500">{poolStats.blocksFound}</div>
                  <p className="text-xs text-muted-foreground">Solo blocks mined</p>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-purple-500/10 to-transparent border-purple-500/20">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Time to Block</CardTitle>
                  <Timer className="h-4 w-4 text-purple-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-purple-500">{getEstimatedTimeToBlock()}</div>
                  <p className="text-xs text-muted-foreground">Estimated average</p>
                </CardContent>
              </Card>
            </div>

            {/* Charts */}
            <div className="grid gap-6 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-primary" />
                    Pool Hashrate (24h)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ChartContainer config={chartConfig} className="h-[250px] w-full">
                    <AreaChart data={hashrateHistory}>
                      <defs>
                        <linearGradient id="hashrateGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="time" className="text-xs" />
                      <YAxis className="text-xs" />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Area 
                        type="monotone" 
                        dataKey="hashrate" 
                        stroke="hsl(var(--primary))" 
                        fill="url(#hashrateGradient)"
                        strokeWidth={2}
                      />
                    </AreaChart>
                  </ChartContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="h-5 w-5 text-primary" />
                    Shares (24h)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ChartContainer config={chartConfig} className="h-[250px] w-full">
                    <BarChart data={sharesHistory}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="time" className="text-xs" />
                      <YAxis className="text-xs" />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Bar dataKey="accepted" fill="hsl(142, 76%, 36%)" stackId="stack" />
                      <Bar dataKey="rejected" fill="hsl(0, 84%, 60%)" stackId="stack" />
                    </BarChart>
                  </ChartContainer>
                </CardContent>
              </Card>
            </div>

            {/* Sync Progress */}
            {nodeInfo && !nodeInfo.initialblockdownload === false && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <RefreshCw className="h-5 w-5 text-primary animate-spin" />
                    Node Syncing
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Progress</span>
                      <span>{((nodeInfo.verificationprogress || 0) * 100).toFixed(2)}%</span>
                    </div>
                    <Progress value={(nodeInfo.verificationprogress || 0) * 100} />
                    <p className="text-xs text-muted-foreground">
                      {nodeInfo.blocks?.toLocaleString()} / {nodeInfo.headers?.toLocaleString()} blocks
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Miners Tab */}
          <TabsContent value="miners" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-primary" />
                  Connected Miners
                </CardTitle>
                <CardDescription>
                  Point your miners to: stratum+tcp://{rpcHost}:3333
                </CardDescription>
              </CardHeader>
              <CardContent>
                {miners.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Cpu className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p className="text-lg font-medium">No miners connected yet</p>
                    <p className="text-sm mt-2">Configure your Bitaxe miners to connect to this pool</p>
                    <p className="text-xs mt-4 font-mono bg-muted p-2 rounded">
                      Pool URL: stratum+tcp://{window.location.hostname}:3333
                    </p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Miner</TableHead>
                        <TableHead>Hashrate</TableHead>
                        <TableHead>Shares</TableHead>
                        <TableHead>Last Seen</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {miners.map((miner) => (
                        <TableRow key={miner.id}>
                          <TableCell>
                            <div>
                              <div className="font-medium">{miner.name}</div>
                              <div className="text-xs text-muted-foreground">{miner.address}</div>
                            </div>
                          </TableCell>
                          <TableCell>{miner.hashrate.toFixed(2)} GH/s</TableCell>
                          <TableCell>{miner.shares.toLocaleString()}</TableCell>
                          <TableCell>{miner.lastSeen.toLocaleTimeString()}</TableCell>
                          <TableCell>
                            <Badge variant={miner.active ? "default" : "secondary"}>
                              {miner.active ? 'Active' : 'Inactive'}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Blocks Tab */}
          <TabsContent value="blocks" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Blocks className="h-5 w-5 text-primary" />
                  Block Template
                </CardTitle>
                <CardDescription>
                  Current work being distributed to miners
                </CardDescription>
              </CardHeader>
              <CardContent>
                {blockTemplate ? (
                  <div className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
                      <div>
                        <Label className="text-xs text-muted-foreground">Height</Label>
                        <p className="font-mono">{blockTemplate.height?.toLocaleString()}</p>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Version</Label>
                        <p className="font-mono">{blockTemplate.version}</p>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Transactions</Label>
                        <p className="font-mono">{blockTemplate.transactions?.length}</p>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Coinbase Value</Label>
                        <p className="font-mono">{(blockTemplate.coinbasevalue / 1e8).toFixed(8)} BTC</p>
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Previous Block Hash</Label>
                      <p className="font-mono text-xs break-all">{blockTemplate.previousblockhash}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Target</Label>
                      <p className="font-mono text-xs break-all">{blockTemplate.target}</p>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    <Blocks className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Connect to your Bitcoin node to see block template</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bitcoin className="h-5 w-5 text-orange-500" />
                  Found Blocks
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-12 text-muted-foreground">
                  <Bitcoin className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p className="text-lg font-medium">No blocks found yet</p>
                  <p className="text-sm mt-2">Keep mining! Your block will show up here when found.</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Server className="h-5 w-5 text-primary" />
                  Bitcoin Node Connection
                </CardTitle>
                <CardDescription>
                  Connect to Bitcoin Core or Bitcoin Knots on your Umbrel
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="rpc-host">RPC Host</Label>
                    <Input
                      id="rpc-host"
                      placeholder="bitcoin.embassy or localhost"
                      value={rpcHost}
                      onChange={(e) => setRpcHost(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="rpc-port">RPC Port</Label>
                    <Input
                      id="rpc-port"
                      placeholder="8332"
                      value={rpcPort}
                      onChange={(e) => setRpcPort(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="rpc-user">RPC Username</Label>
                    <Input
                      id="rpc-user"
                      placeholder="Your RPC username"
                      value={rpcUser}
                      onChange={(e) => setRpcUser(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="rpc-password">RPC Password</Label>
                    <Input
                      id="rpc-password"
                      type="password"
                      placeholder="Your RPC password"
                      value={rpcPassword}
                      onChange={(e) => setRpcPassword(e.target.value)}
                    />
                  </div>
                </div>
                <Button 
                  onClick={connectToNode} 
                  disabled={isConnecting}
                  className="w-full md:w-auto"
                >
                  {isConnecting ? (
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Server className="mr-2 h-4 w-4" />
                  )}
                  {isConnecting ? 'Connecting...' : 'Connect to Node'}
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5 text-primary" />
                  Pool Settings
                </CardTitle>
                <CardDescription>
                  Configure your solo mining pool
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="pool-address">Payout Address</Label>
                  <Input
                    id="pool-address"
                    placeholder="Your Bitcoin address for block rewards"
                    value={poolAddress}
                    onChange={(e) => setPoolAddress(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    This address will receive block rewards when you find a block
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pool-difficulty">Pool Difficulty</Label>
                  <Input
                    id="pool-difficulty"
                    type="number"
                    placeholder="1"
                    value={poolDifficulty}
                    onChange={(e) => setPoolDifficulty(Number(e.target.value))}
                  />
                  <p className="text-xs text-muted-foreground">
                    Lower difficulty = more shares but more load on your node
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Node Info Card */}
            {nodeInfo && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Cpu className="h-5 w-5 text-primary" />
                    Node Information
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-2 text-sm">
                    <div>
                      <span className="text-muted-foreground">Version:</span>{' '}
                      <span className="font-mono">{nodeInfo.subversion}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Chain:</span>{' '}
                      <span className="font-mono">{nodeInfo.chain}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Pruned:</span>{' '}
                      <span className="font-mono">{nodeInfo.pruned ? 'Yes' : 'No'}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Size on Disk:</span>{' '}
                      <span className="font-mono">{((nodeInfo.size_on_disk || 0) / 1e9).toFixed(2)} GB</span>
                    </div>
                    <div className="md:col-span-2">
                      <span className="text-muted-foreground">Best Block:</span>{' '}
                      <span className="font-mono text-xs break-all">{nodeInfo.bestblockhash}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </ScrollArea>
  );
};

export default AxePool;
