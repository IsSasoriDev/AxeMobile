import { useState, useEffect, useCallback, useMemo, useRef } from "react";
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
import { useNetworkScanner } from "@/hooks/useNetworkScanner";
import { useAxePoolStats } from "@/hooks/useAxePoolStats";

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

// Umbrel host candidates to try for auto-detection
const UMBREL_HOSTS = [
  'umbrel.local',
  'bitcoin.embassy', 
  '10.21.21.9',
  'localhost',
  window.location.hostname,
];

const AxePool = () => {
  const { devices, totalHashRate, activeDevices } = useNetworkScanner();
  const axePoolApi = useAxePoolStats();

  // RPC settings
  const [rpcHost, setRpcHost] = useState(() => localStorage.getItem('AXEPOOL_RPC_HOST') || 'umbrel.local');
  const [rpcPort, setRpcPort] = useState(() => localStorage.getItem('AXEPOOL_RPC_PORT') || '8332');
  const [rpcUser, setRpcUser] = useState(() => localStorage.getItem('AXEPOOL_RPC_USER') || 'umbrel');
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
  const [autoConnectAttempted, setAutoConnectAttempted] = useState(false);
  const [isAutoDetecting, setIsAutoDetecting] = useState(false);

  const activeMinerDevices = useMemo(() => devices.filter((d) => d.isActive), [devices]);
  const sharesBaselineRef = useRef<Record<string, { accepted: number; rejected: number }>>({});

  // Save settings to localStorage
  useEffect(() => {
    localStorage.setItem('AXEPOOL_RPC_HOST', rpcHost);
    localStorage.setItem('AXEPOOL_RPC_PORT', rpcPort);
    localStorage.setItem('AXEPOOL_RPC_USER', rpcUser);
    localStorage.setItem('AXEPOOL_RPC_PASSWORD', rpcPassword);
    localStorage.setItem('AXEPOOL_ADDRESS', poolAddress);
    localStorage.setItem('AXEPOOL_DIFFICULTY', poolDifficulty.toString());
  }, [rpcHost, rpcPort, rpcUser, rpcPassword, poolAddress, poolDifficulty]);

  // Derive pool + miner stats from real API or fallback to device-derived
  useEffect(() => {
    // If AxePool API is available, use its data
    if (axePoolApi.isApiAvailable && axePoolApi.poolStats) {
      const apiData = axePoolApi.poolStats;
      
      setMiners(apiData.miners.map(m => ({
        ...m,
        lastSeen: new Date(m.lastSeen)
      })));
      
      setPoolStats({
        totalHashrate: apiData.stats.totalHashrate,
        activeMiners: apiData.stats.activeMiners,
        totalShares: apiData.stats.totalShares,
        blocksFound: apiData.stats.blocksFound,
        lastBlockTime: apiData.stats.lastBlockTime ? new Date(apiData.stats.lastBlockTime) : null,
        poolDifficulty: apiData.stats.difficulty,
      });

      // Use API history if available
      if (axePoolApi.hashrateHistory.length > 0) {
        setHashrateHistory(axePoolApi.hashrateHistory);
      }
      if (axePoolApi.sharesHistory.length > 0) {
        setSharesHistory(axePoolApi.sharesHistory);
      }
      
      return;
    }
    
    // Fallback: derive from detected devices
    const now = new Date();

    const mapped: PoolMiner[] = activeMinerDevices.map((d) => ({
      id: d.IP,
      address: d.IP,
      name: d.name || d.IP,
      hashrate: d.hashRate || 0,
      shares: d.shares?.accepted || 0,
      lastSeen: now,
      active: true,
    }));

    setMiners(mapped);

    const totalAccepted = activeMinerDevices.reduce((sum, d) => sum + (d.shares?.accepted || 0), 0);

    setPoolStats((prev) => ({
      ...prev,
      totalHashrate: totalHashRate,
      activeMiners: activeDevices,
      totalShares: totalAccepted,
      poolDifficulty,
    }));
  }, [axePoolApi.isApiAvailable, axePoolApi.poolStats, axePoolApi.hashrateHistory, axePoolApi.sharesHistory, activeMinerDevices, totalHashRate, activeDevices, poolDifficulty]);

  // RPC call helper with configurable host
  const rpcCallWithHost = useCallback(async (host: string, port: string, user: string, pass: string, method: string, params: any[] = []) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    try {
      const response = await fetch(`http://${host}:${port}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Basic ' + btoa(`${user}:${pass}`),
        },
        body: JSON.stringify({
          jsonrpc: '1.0',
          id: Date.now(),
          method,
          params,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      if (data.error) {
        throw new Error(data.error.message);
      }
      return data.result;
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }, []);

  // RPC call with current settings
  const rpcCall = useCallback(async (method: string, params: any[] = []) => {
    return rpcCallWithHost(rpcHost, rpcPort, rpcUser, rpcPassword, method, params);
  }, [rpcHost, rpcPort, rpcUser, rpcPassword, rpcCallWithHost]);

  // Auto-detect Umbrel node credentials
  const autoDetectUmbrel = useCallback(async () => {
    setIsAutoDetecting(true);
    
    // Try to fetch credentials from Umbrel's API endpoints
    const umbrelApiEndpoints = [
      '/api/v1/bitcoin/info',
      '/v1/bitcoin/info',
    ];
    
    // Try each host with common credentials
    for (const host of UMBREL_HOSTS) {
      // Try fetching from Umbrel's middleware API first
      for (const endpoint of umbrelApiEndpoints) {
        try {
          const response = await fetch(`http://${host}:3005${endpoint}`, {
            signal: AbortSignal.timeout(3000),
          });
          if (response.ok) {
            const data = await response.json();
            if (data.rpcPassword || data.rpc_password) {
              const detectedPass = data.rpcPassword || data.rpc_password;
              setRpcHost(host);
              setRpcPassword(detectedPass);
              toast.success(`Auto-detected Umbrel node at ${host}`);
              setIsAutoDetecting(false);
              return { host, password: detectedPass };
            }
          }
        } catch {
          // Continue to next endpoint
        }
      }
      
      // Try common passwords if API doesn't work
      const commonPasswords = ['moneyprintergobrrr', 'password', ''];
      for (const pass of commonPasswords) {
        try {
          await rpcCallWithHost(host, '8332', 'umbrel', pass, 'getblockchaininfo');
          setRpcHost(host);
          setRpcUser('umbrel');
          setRpcPassword(pass);
          toast.success(`Connected to Umbrel node at ${host}`);
          setIsAutoDetecting(false);
          return { host, password: pass };
        } catch {
          // Continue to next password
        }
      }
    }
    
    setIsAutoDetecting(false);
    toast.info('Could not auto-detect Umbrel node. Please enter credentials manually.');
    return null;
  }, [rpcCallWithHost]);

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
      toast.error('Failed to connect. Check your RPC settings.');
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

  // Auto-detect and connect on mount
  useEffect(() => {
    if (autoConnectAttempted) return;
    setAutoConnectAttempted(true);
    
    const tryAutoConnect = async () => {
      // If we have saved credentials, try them first
      if (rpcPassword) {
        try {
          await connectToNode();
          return;
        } catch {
          // Continue to auto-detect
        }
      }
      
      // Try auto-detection
      const detected = await autoDetectUmbrel();
      if (detected) {
        // Credentials were updated, try connecting
        setTimeout(connectToNode, 500);
      }
    };
    
    tryAutoConnect();
  }, []);

  // Live hashrate + share deltas (1h window, 10s samples) - only when API not available
  useEffect(() => {
    // Skip if using API data
    if (axePoolApi.isApiAvailable) return;
    
    const formatTime = (d: Date) =>
      d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });

    const sample = () => {
      const now = new Date();
      const time = formatTime(now);

      let deltaAccepted = 0;
      let deltaRejected = 0;

      const nextBaseline: Record<string, { accepted: number; rejected: number }> = {
        ...sharesBaselineRef.current,
      };

      for (const dev of activeMinerDevices) {
        const accepted = dev.shares?.accepted || 0;
        const rejected = dev.shares?.rejected || 0;
        const prev = sharesBaselineRef.current[dev.IP];

        if (prev) {
          deltaAccepted += Math.max(0, accepted - prev.accepted);
          deltaRejected += Math.max(0, rejected - prev.rejected);
        }

        nextBaseline[dev.IP] = { accepted, rejected };
      }

      sharesBaselineRef.current = nextBaseline;

      setHashrateHistory((prev) => {
        const next = [...prev, { time, hashrate: totalHashRate, shares: deltaAccepted }];
        return next.slice(-360);
      });

      setSharesHistory((prev) => {
        const next = [...prev, { time, accepted: deltaAccepted, rejected: deltaRejected }];
        return next.slice(-360);
      });
    };

    // Prime baseline + first datapoint
    sample();
    const id = setInterval(sample, 10_000);
    return () => clearInterval(id);
  }, [axePoolApi.isApiAvailable, activeMinerDevices, totalHashRate]);

  // Get found blocks from API
  const foundBlocks = axePoolApi.blocks;

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
      <div className="p-3 sm:p-6 space-y-4 sm:space-y-6">
        {/* Header - Mobile Optimized */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h1 className="text-xl sm:text-3xl font-bold bg-gradient-to-r from-primary to-orange-500 bg-clip-text text-transparent flex items-center gap-2">
              <Pickaxe className="h-6 w-6 sm:h-8 sm:w-8 text-primary" />
              AxePool
            </h1>
            <Badge variant={isConnected ? "default" : "secondary"} className="gap-1 text-xs">
              {isConnected ? <CheckCircle2 className="h-3 w-3" /> : <AlertCircle className="h-3 w-3" />}
              {isConnected ? 'Connected' : 'Offline'}
            </Badge>
          </div>
          <div className="flex items-center justify-between">
            <p className="text-xs sm:text-sm text-muted-foreground">Solo mining pool for Bitaxe</p>
            <Button 
              size="sm"
              variant={poolEnabled ? "destructive" : "default"}
              onClick={() => setPoolEnabled(!poolEnabled)}
              disabled={!isConnected}
              className="h-8 text-xs"
            >
              {poolEnabled ? <Pause className="mr-1 h-3 w-3" /> : <Play className="mr-1 h-3 w-3" />}
              {poolEnabled ? 'Stop' : 'Start'}
            </Button>
          </div>
        </div>

        <Tabs defaultValue="dashboard" className="space-y-3 sm:space-y-4">
          <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 h-9">
            <TabsTrigger value="dashboard" className="text-xs sm:text-sm px-1">Dash</TabsTrigger>
            <TabsTrigger value="miners" className="text-xs sm:text-sm px-1">Miners</TabsTrigger>
            <TabsTrigger value="blocks" className="text-xs sm:text-sm px-1">Blocks</TabsTrigger>
            <TabsTrigger value="settings" className="text-xs sm:text-sm px-1">Settings</TabsTrigger>
          </TabsList>

          {/* Dashboard Tab */}
          <TabsContent value="dashboard" className="space-y-4 sm:space-y-6">
            {/* Node Status Cards - Mobile 2x2 Grid */}
            <div className="grid grid-cols-2 gap-2 sm:gap-4 lg:grid-cols-4">
              <Card className="border-primary/20">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 pb-1 sm:p-6 sm:pb-2">
                  <CardTitle className="text-xs sm:text-sm font-medium">Block Height</CardTitle>
                  <Blocks className="h-3 w-3 sm:h-4 sm:w-4 text-primary" />
                </CardHeader>
                <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
                  <div className="text-lg sm:text-2xl font-bold">{nodeInfo?.blocks?.toLocaleString() || '---'}</div>
                  <p className="text-[10px] sm:text-xs text-muted-foreground">
                    {nodeInfo?.chain === 'main' ? 'Mainnet' : nodeInfo?.chain || 'Unknown'}
                  </p>
                </CardContent>
              </Card>

              <Card className="border-primary/20">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 pb-1 sm:p-6 sm:pb-2">
                  <CardTitle className="text-xs sm:text-sm font-medium">Network Hash</CardTitle>
                  <Hash className="h-3 w-3 sm:h-4 sm:w-4 text-primary" />
                </CardHeader>
                <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
                  <div className="text-lg sm:text-2xl font-bold">
                    {miningInfo ? formatHashrate(miningInfo.networkhashps) : '---'}
                  </div>
                  <p className="text-[10px] sm:text-xs text-muted-foreground">Global</p>
                </CardContent>
              </Card>

              <Card className="border-primary/20">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 pb-1 sm:p-6 sm:pb-2">
                  <CardTitle className="text-xs sm:text-sm font-medium">Difficulty</CardTitle>
                  <Target className="h-3 w-3 sm:h-4 sm:w-4 text-primary" />
                </CardHeader>
                <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
                  <div className="text-lg sm:text-2xl font-bold">
                    {miningInfo ? formatDifficulty(miningInfo.difficulty) : '---'}
                  </div>
                  <p className="text-[10px] sm:text-xs text-muted-foreground">Current</p>
                </CardContent>
              </Card>

              <Card className="border-primary/20">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 pb-1 sm:p-6 sm:pb-2">
                  <CardTitle className="text-xs sm:text-sm font-medium">Peers</CardTitle>
                  <Network className="h-3 w-3 sm:h-4 sm:w-4 text-primary" />
                </CardHeader>
                <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
                  <div className="text-lg sm:text-2xl font-bold">{nodeInfo?.connections || '---'}</div>
                  <p className="text-[10px] sm:text-xs text-muted-foreground">Connected</p>
                </CardContent>
              </Card>
            </div>

            {/* Pool Stats - Mobile 2x2 Grid */}
            <div className="grid grid-cols-2 gap-2 sm:gap-4 lg:grid-cols-4">
              <Card className="bg-gradient-to-br from-orange-500/10 to-transparent border-orange-500/20">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 pb-1 sm:p-6 sm:pb-2">
                  <CardTitle className="text-xs sm:text-sm font-medium">Pool Hash</CardTitle>
                  <Zap className="h-3 w-3 sm:h-4 sm:w-4 text-orange-500" />
                </CardHeader>
                <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
                  <div className="text-lg sm:text-2xl font-bold text-orange-500">
                    {poolStats.totalHashrate.toFixed(1)} GH/s
                  </div>
                  <p className="text-[10px] sm:text-xs text-muted-foreground">{poolStats.activeMiners} miners</p>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-green-500/10 to-transparent border-green-500/20">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 pb-1 sm:p-6 sm:pb-2">
                  <CardTitle className="text-xs sm:text-sm font-medium">Shares</CardTitle>
                  <Activity className="h-3 w-3 sm:h-4 sm:w-4 text-green-500" />
                </CardHeader>
                <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
                  <div className="text-lg sm:text-2xl font-bold text-green-500">{poolStats.totalShares.toLocaleString()}</div>
                  <p className="text-[10px] sm:text-xs text-muted-foreground">Accepted</p>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-blue-500/10 to-transparent border-blue-500/20">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 pb-1 sm:p-6 sm:pb-2">
                  <CardTitle className="text-xs sm:text-sm font-medium">Blocks</CardTitle>
                  <Bitcoin className="h-3 w-3 sm:h-4 sm:w-4 text-blue-500" />
                </CardHeader>
                <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
                  <div className="text-lg sm:text-2xl font-bold text-blue-500">{poolStats.blocksFound}</div>
                  <p className="text-[10px] sm:text-xs text-muted-foreground">Found</p>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-purple-500/10 to-transparent border-purple-500/20">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 pb-1 sm:p-6 sm:pb-2">
                  <CardTitle className="text-xs sm:text-sm font-medium">ETA Block</CardTitle>
                  <Timer className="h-3 w-3 sm:h-4 sm:w-4 text-purple-500" />
                </CardHeader>
                <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
                  <div className="text-lg sm:text-2xl font-bold text-purple-500">{getEstimatedTimeToBlock()}</div>
                  <p className="text-[10px] sm:text-xs text-muted-foreground">Estimate</p>
                </CardContent>
              </Card>
            </div>

            {/* Charts - Stack on Mobile */}
            <div className="grid gap-3 sm:gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader className="p-3 sm:p-6">
                  <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
                    <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                    Hashrate (live)
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-2 sm:p-6 pt-0">
                  <ChartContainer config={chartConfig} className="h-[180px] sm:h-[250px] w-full">
                    <AreaChart data={hashrateHistory}>
                      <defs>
                        <linearGradient id="hashrateGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="time" className="text-[10px] sm:text-xs" tick={{ fontSize: 10 }} />
                      <YAxis className="text-[10px] sm:text-xs" tick={{ fontSize: 10 }} width={30} />
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
                <CardHeader className="p-3 sm:p-6">
                  <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
                    <Activity className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                    Shares (live)
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-2 sm:p-6 pt-0">
                  <ChartContainer config={chartConfig} className="h-[180px] sm:h-[250px] w-full">
                    <BarChart data={sharesHistory}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="time" className="text-[10px] sm:text-xs" tick={{ fontSize: 10 }} />
                      <YAxis className="text-[10px] sm:text-xs" tick={{ fontSize: 10 }} width={30} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Bar dataKey="accepted" fill="hsl(142, 76%, 36%)" stackId="stack" />
                      <Bar dataKey="rejected" fill="hsl(0, 84%, 60%)" stackId="stack" />
                    </BarChart>
                  </ChartContainer>
                </CardContent>
              </Card>
            </div>

            {/* Sync Progress */}
            {nodeInfo && nodeInfo.initialblockdownload && (
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

          {/* Miners Tab - Mobile Optimized */}
          <TabsContent value="miners" className="space-y-3">
            <Card>
              <CardHeader className="p-3 sm:p-6">
                <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
                  <Users className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                  Connected Miners
                </CardTitle>
                <CardDescription className="text-xs sm:text-sm">
                  stratum+tcp://{rpcHost}:3333
                </CardDescription>
              </CardHeader>
              <CardContent className="p-3 sm:p-6 pt-0">
                {miners.length === 0 ? (
                  <div className="text-center py-6 sm:py-12 text-muted-foreground">
                    <Cpu className="h-8 w-8 sm:h-12 sm:w-12 mx-auto mb-3 opacity-50" />
                    <p className="text-sm sm:text-lg font-medium">No miners connected</p>
                    <p className="text-xs sm:text-sm mt-1">Point your Bitaxe to this pool</p>
                    <p className="text-[10px] sm:text-xs mt-3 font-mono bg-muted p-2 rounded break-all">
                      stratum+tcp://{window.location.hostname}:3333
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {miners.map((miner) => (
                      <div key={miner.id} className="flex items-center justify-between p-2 bg-muted/50 rounded-lg">
                        <div className="min-w-0 flex-1">
                          <div className="font-medium text-sm truncate">{miner.name}</div>
                          <div className="text-xs text-muted-foreground">{miner.hashrate.toFixed(1)} GH/s • {miner.shares} shares</div>
                        </div>
                        <Badge variant={miner.active ? "default" : "secondary"} className="text-xs ml-2">
                          {miner.active ? 'On' : 'Off'}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Blocks Tab - Mobile Optimized */}
          <TabsContent value="blocks" className="space-y-3">
            <Card>
              <CardHeader className="p-3 sm:p-6">
                <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
                  <Blocks className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                  Block Template
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3 sm:p-6 pt-0">
                {blockTemplate ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-2 sm:gap-4">
                      <div className="bg-muted/50 p-2 rounded">
                        <div className="text-[10px] sm:text-xs text-muted-foreground">Height</div>
                        <div className="font-mono text-sm sm:text-base">{blockTemplate.height?.toLocaleString()}</div>
                      </div>
                      <div className="bg-muted/50 p-2 rounded">
                        <div className="text-[10px] sm:text-xs text-muted-foreground">TXs</div>
                        <div className="font-mono text-sm sm:text-base">{blockTemplate.transactions?.length}</div>
                      </div>
                      <div className="bg-muted/50 p-2 rounded">
                        <div className="text-[10px] sm:text-xs text-muted-foreground">Version</div>
                        <div className="font-mono text-sm sm:text-base">{blockTemplate.version}</div>
                      </div>
                      <div className="bg-muted/50 p-2 rounded">
                        <div className="text-[10px] sm:text-xs text-muted-foreground">Reward</div>
                        <div className="font-mono text-sm sm:text-base">{(blockTemplate.coinbasevalue / 1e8).toFixed(4)}</div>
                      </div>
                    </div>
                    <div className="bg-muted/50 p-2 rounded">
                      <div className="text-[10px] sm:text-xs text-muted-foreground">Previous Hash</div>
                      <div className="font-mono text-[10px] sm:text-xs break-all">{blockTemplate.previousblockhash}</div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-6 text-muted-foreground">
                    <Blocks className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Connect to node for block template</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="p-3 sm:p-6">
                <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
                  <Bitcoin className="h-4 w-4 sm:h-5 sm:w-5 text-orange-500" />
                  Found Blocks ({foundBlocks.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3 sm:p-6 pt-0">
                {foundBlocks.length === 0 ? (
                  <div className="text-center py-6 text-muted-foreground">
                    <Bitcoin className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm font-medium">No blocks found yet</p>
                    <p className="text-xs mt-1">Keep mining!</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {foundBlocks.slice(-10).reverse().map((block, i) => (
                      <div key={i} className="flex items-center justify-between p-2 bg-gradient-to-r from-orange-500/10 to-transparent rounded-lg border border-orange-500/20">
                        <div className="min-w-0 flex-1">
                          <div className="font-medium text-sm flex items-center gap-1">
                            <Bitcoin className="h-3 w-3 text-orange-500" />
                            Block #{block.height?.toLocaleString()}
                          </div>
                          <div className="text-xs text-muted-foreground truncate">
                            {block.hash?.slice(0, 16)}...
                          </div>
                        </div>
                        <div className="text-right ml-2">
                          <div className="text-sm font-bold text-orange-500">
                            {(block.reward / 1e8).toFixed(4)} BTC
                          </div>
                          <div className="text-[10px] text-muted-foreground">
                            {new Date(block.time).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Settings Tab - Mobile Optimized */}
          <TabsContent value="settings" className="space-y-3">
            <Card>
              <CardHeader className="p-3 sm:p-6">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
                    <Server className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                    Node Connection
                  </CardTitle>
                  <Button 
                    size="sm"
                    variant="outline"
                    onClick={autoDetectUmbrel}
                    disabled={isAutoDetecting}
                    className="h-7 text-xs"
                  >
                    {isAutoDetecting ? (
                      <RefreshCw className="h-3 w-3 animate-spin" />
                    ) : (
                      'Auto-Detect'
                    )}
                  </Button>
                </div>
                <CardDescription className="text-xs">
                  Umbrel credentials auto-detected on startup
                </CardDescription>
              </CardHeader>
              <CardContent className="p-3 sm:p-6 pt-0 space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Host</Label>
                    <Input
                      className="h-8 text-sm"
                      placeholder="umbrel.local"
                      value={rpcHost}
                      onChange={(e) => setRpcHost(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Port</Label>
                    <Input
                      className="h-8 text-sm"
                      placeholder="8332"
                      value={rpcPort}
                      onChange={(e) => setRpcPort(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">User</Label>
                    <Input
                      className="h-8 text-sm"
                      placeholder="umbrel"
                      value={rpcUser}
                      onChange={(e) => setRpcUser(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Password</Label>
                    <Input
                      className="h-8 text-sm"
                      type="password"
                      placeholder="••••••"
                      value={rpcPassword}
                      onChange={(e) => setRpcPassword(e.target.value)}
                    />
                  </div>
                </div>
                <Button 
                  onClick={connectToNode} 
                  disabled={isConnecting}
                  className="w-full h-9 text-sm"
                >
                  {isConnecting ? (
                    <RefreshCw className="mr-2 h-3 w-3 animate-spin" />
                  ) : (
                    <Server className="mr-2 h-3 w-3" />
                  )}
                  {isConnecting ? 'Connecting...' : 'Connect'}
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="p-3 sm:p-6">
                <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
                  <Settings className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                  Pool Settings
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3 sm:p-6 pt-0 space-y-3">
                <div className="space-y-1">
                  <Label className="text-xs">Payout Address</Label>
                  <Input
                    className="h-8 text-sm font-mono"
                    placeholder="bc1q..."
                    value={poolAddress}
                    onChange={(e) => setPoolAddress(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Pool Difficulty</Label>
                  <Input
                    className="h-8 text-sm"
                    type="number"
                    placeholder="1"
                    value={poolDifficulty}
                    onChange={(e) => setPoolDifficulty(Number(e.target.value))}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Node Info - Compact */}
            {nodeInfo && (
              <Card>
                <CardHeader className="p-3 sm:p-6">
                  <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
                    <Cpu className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                    Node Info
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-3 sm:p-6 pt-0">
                  <div className="grid grid-cols-2 gap-2 text-xs sm:text-sm">
                    <div className="bg-muted/50 p-2 rounded">
                      <span className="text-muted-foreground">Version</span>
                      <div className="font-mono truncate">{nodeInfo.subversion}</div>
                    </div>
                    <div className="bg-muted/50 p-2 rounded">
                      <span className="text-muted-foreground">Chain</span>
                      <div className="font-mono">{nodeInfo.chain}</div>
                    </div>
                    <div className="bg-muted/50 p-2 rounded">
                      <span className="text-muted-foreground">Pruned</span>
                      <div className="font-mono">{nodeInfo.pruned ? 'Yes' : 'No'}</div>
                    </div>
                    <div className="bg-muted/50 p-2 rounded">
                      <span className="text-muted-foreground">Size</span>
                      <div className="font-mono">{((nodeInfo.size_on_disk || 0) / 1e9).toFixed(1)} GB</div>
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
