import { useState, useEffect, useCallback } from 'react';

export interface NodeInfo {
  version: number;
  subversion: string;
  protocolversion: number;
  connections: number;
  connections_in: number;
  connections_out: number;
  networkactive: boolean;
  blocks: number;
  headers: number;
  bestblockhash: string;
  difficulty: number;
  chain: string;
  verificationprogress: number;
  pruned: boolean;
  pruneheight?: number;
  size_on_disk?: number;
  warnings?: string;
}

export interface NodePeer {
  id: number;
  addr: string;
  addrlocal?: string;
  network: string;
  version: number;
  subver: string;
  inbound: boolean;
  pingtime?: number;
  synced_headers: number;
  synced_blocks: number;
  conntime: number;
  bytessent: number;
  bytesrecv: number;
  // Geo info (estimated from IP)
  lat?: number;
  lon?: number;
  country?: string;
}

export interface MempoolInfo {
  loaded: boolean;
  size: number;
  bytes: number;
  usage: number;
  total_fee: number;
  maxmempool: number;
  mempoolminfee: number;
}

export interface NodeBlock {
  hash: string;
  height: number;
  time: number;
  nTx: number;
  size: number;
  weight: number;
  difficulty: number;
}

interface NodeConfig {
  host: string;
  port: string;
  user: string;
  pass: string;
}

const DEFAULT_NODE_CONFIG: NodeConfig = {
  host: '127.0.0.1',
  port: '8332',
  user: '',
  pass: '',
};

const loadNodeConfig = (): NodeConfig => {
  try {
    const saved = localStorage.getItem('AXEMOBILE_NODE_CONFIG');
    if (saved) return { ...DEFAULT_NODE_CONFIG, ...JSON.parse(saved) };
  } catch {}
  return DEFAULT_NODE_CONFIG;
};

export function useNodeStats() {
  const [config, setConfig] = useState<NodeConfig>(loadNodeConfig);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [nodeInfo, setNodeInfo] = useState<NodeInfo | null>(null);
  const [peers, setPeers] = useState<NodePeer[]>([]);
  const [mempool, setMempool] = useState<MempoolInfo | null>(null);
  const [recentBlocks, setRecentBlocks] = useState<NodeBlock[]>([]);
  const [syncProgress, setSyncProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const rpcCall = useCallback(async (method: string, params: any[] = []) => {
    const url = `http://${config.host}:${config.port}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Basic ' + btoa(`${config.user}:${config.pass}`),
      },
      body: JSON.stringify({ jsonrpc: '2.0', id: method, method, params }),
      signal: AbortSignal.timeout(10000),
    });
    const data = await response.json();
    if (data.error) throw new Error(data.error.message);
    return data.result;
  }, [config]);

  const fetchNodeData = useCallback(async () => {
    if (!config.user || !config.pass) return;
    
    try {
      setIsLoading(true);
      
      // Fetch blockchain info
      const blockchainInfo = await rpcCall('getblockchaininfo');
      const networkInfo = await rpcCall('getnetworkinfo');
      
      const info: NodeInfo = {
        version: networkInfo.version,
        subversion: networkInfo.subversion,
        protocolversion: networkInfo.protocolversion,
        connections: networkInfo.connections || 0,
        connections_in: networkInfo.connections_in || 0,
        connections_out: networkInfo.connections_out || 0,
        networkactive: networkInfo.networkactive,
        blocks: blockchainInfo.blocks,
        headers: blockchainInfo.headers,
        bestblockhash: blockchainInfo.bestblockhash,
        difficulty: blockchainInfo.difficulty,
        chain: blockchainInfo.chain,
        verificationprogress: blockchainInfo.verificationprogress,
        pruned: blockchainInfo.pruned,
        pruneheight: blockchainInfo.pruneheight,
        size_on_disk: blockchainInfo.size_on_disk,
        warnings: blockchainInfo.warnings,
      };
      
      setNodeInfo(info);
      setSyncProgress(info.verificationprogress * 100);
      setIsConnected(true);
      setError(null);

      // Fetch peers
      try {
        const peerInfo = await rpcCall('getpeerinfo');
        setPeers(peerInfo.map((p: any) => ({
          id: p.id,
          addr: p.addr,
          addrlocal: p.addrlocal,
          network: p.network,
          version: p.version,
          subver: p.subver,
          inbound: p.inbound,
          pingtime: p.pingtime,
          synced_headers: p.synced_headers,
          synced_blocks: p.synced_blocks,
          conntime: p.conntime,
          bytessent: p.bytessent,
          bytesrecv: p.bytesrecv,
        })));
      } catch {}

      // Fetch mempool
      try {
        const mempoolInfo = await rpcCall('getmempoolinfo');
        setMempool(mempoolInfo);
      } catch {}

      // Fetch recent blocks
      try {
        const blockBlocks: NodeBlock[] = [];
        let hash = blockchainInfo.bestblockhash;
        for (let i = 0; i < 10; i++) {
          const block = await rpcCall('getblock', [hash]);
          blockBlocks.push({
            hash: block.hash,
            height: block.height,
            time: block.time,
            nTx: block.nTx,
            size: block.size,
            weight: block.weight,
            difficulty: block.difficulty,
          });
          if (!block.previousblockhash) break;
          hash = block.previousblockhash;
        }
        setRecentBlocks(blockBlocks);
      } catch {}

    } catch (e: any) {
      setIsConnected(false);
      setError(e.message || 'Failed to connect to node');
    } finally {
      setIsLoading(false);
    }
  }, [config, rpcCall]);

  const updateConfig = useCallback((newConfig: Partial<NodeConfig>) => {
    const updated = { ...config, ...newConfig };
    setConfig(updated);
    localStorage.setItem('AXEMOBILE_NODE_CONFIG', JSON.stringify(updated));
  }, [config]);

  const connect = useCallback(() => {
    setIsConnected(false);
    setError(null);
    fetchNodeData();
  }, [fetchNodeData]);

  // Poll when connected
  useEffect(() => {
    if (!isConnected) return;
    const interval = setInterval(fetchNodeData, 15000);
    return () => clearInterval(interval);
  }, [isConnected, fetchNodeData]);

  return {
    config,
    updateConfig,
    connect,
    isConnected,
    isLoading,
    nodeInfo,
    peers,
    mempool,
    recentBlocks,
    syncProgress,
    error,
  };
}
