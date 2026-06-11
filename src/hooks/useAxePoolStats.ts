import { useState, useEffect, useCallback } from 'react';

export interface PoolMiner {
  id: string;
  address: string;
  name: string;
  hashrate: number;
  shares: number;
  lastSeen: Date;
  active: boolean;
}

export interface PoolBlock {
  height: number;
  hash: string;
  reward: number;
  finder: string;
  time: string;
}

export interface AxePoolStats {
  pool: {
    name: string;
    version: string;
    uptime: number;
    stratumPort: number;
  };
  stats: {
    totalHashrate: number;
    activeMiners: number;
    totalShares: number;
    blocksFound: number;
    lastBlockTime: string | null;
    difficulty: number;
  };
  miners: PoolMiner[];
}

export interface HashrateDataPoint {
  time: string;
  hashrate: number;
  shares: number;
}

export interface SharesDataPoint {
  time: string;
  accepted: number;
  rejected: number;
}

// Try to detect the AxePool stats API URL
const getApiUrl = (): string | null => {
  // Check for environment variable (set in Docker)
  if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_AXEPOOL_API_URL) {
    return import.meta.env.VITE_AXEPOOL_API_URL;
  }

  // Check localStorage for custom URL
  const customUrl = localStorage.getItem('AXEPOOL_STATS_API');
  if (customUrl) return customUrl;

  // Try to auto-detect based on hostname (Umbrel deployment)
  const hostname = window.location.hostname;
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return null; // Local dev - use device-derived stats
  }

  // Try common Umbrel patterns
  if (hostname.includes('umbrel') || hostname.includes('.local')) {
    return `http://${hostname}:3334`;
  }

  // Try same host different port
  return `http://${hostname}:3334`;
};

export function useAxePoolStats() {
  const [apiUrl, setApiUrl] = useState<string | null>(getApiUrl);
  const [isApiAvailable, setIsApiAvailable] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [poolStats, setPoolStats] = useState<AxePoolStats | null>(null);
  const [hashrateHistory, setHashrateHistory] = useState<HashrateDataPoint[]>([]);
  const [sharesHistory, setSharesHistory] = useState<SharesDataPoint[]>([]);
  const [blocks, setBlocks] = useState<PoolBlock[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Check if API is available
  const checkApi = useCallback(async () => {
    if (!apiUrl) {
      setIsApiAvailable(false);
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch(`${apiUrl}/api/health`, {
        signal: AbortSignal.timeout(3000),
      });
      
      if (response.ok) {
        setIsApiAvailable(true);
        setError(null);
      } else {
        setIsApiAvailable(false);
      }
    } catch {
      setIsApiAvailable(false);
    } finally {
      setIsLoading(false);
    }
  }, [apiUrl]);

  // Fetch pool stats
  const fetchStats = useCallback(async () => {
    if (!apiUrl || !isApiAvailable) return;

    try {
      const response = await fetch(`${apiUrl}/api/pool/stats`, {
        signal: AbortSignal.timeout(5000),
      });

      if (response.ok) {
        const data = await response.json();
        setPoolStats(data);
        setError(null);
      }
    } catch (e) {
      console.error('Failed to fetch pool stats:', e);
      setError('Failed to connect to AxePool API');
    }
  }, [apiUrl, isApiAvailable]);

  // Fetch hashrate history
  const fetchHashrateHistory = useCallback(async () => {
    if (!apiUrl || !isApiAvailable) return;

    try {
      const response = await fetch(`${apiUrl}/api/pool/hashrate`, {
        signal: AbortSignal.timeout(5000),
      });

      if (response.ok) {
        const data = await response.json();
        setHashrateHistory(data.history || []);
      }
    } catch (e) {
      console.error('Failed to fetch hashrate history:', e);
    }
  }, [apiUrl, isApiAvailable]);

  // Fetch shares history
  const fetchSharesHistory = useCallback(async () => {
    if (!apiUrl || !isApiAvailable) return;

    try {
      const response = await fetch(`${apiUrl}/api/pool/shares`, {
        signal: AbortSignal.timeout(5000),
      });

      if (response.ok) {
        const data = await response.json();
        setSharesHistory(data.history || []);
      }
    } catch (e) {
      console.error('Failed to fetch shares history:', e);
    }
  }, [apiUrl, isApiAvailable]);

  // Fetch blocks
  const fetchBlocks = useCallback(async () => {
    if (!apiUrl || !isApiAvailable) return;

    try {
      const response = await fetch(`${apiUrl}/api/pool/blocks`, {
        signal: AbortSignal.timeout(5000),
      });

      if (response.ok) {
        const data = await response.json();
        setBlocks(data.blocks || []);
      }
    } catch (e) {
      console.error('Failed to fetch blocks:', e);
    }
  }, [apiUrl, isApiAvailable]);

  // Initial check
  useEffect(() => {
    checkApi();
  }, [checkApi]);

  // Poll for updates when API is available
  useEffect(() => {
    if (!isApiAvailable) return;

    // Initial fetch
    fetchStats();
    fetchHashrateHistory();
    fetchSharesHistory();
    fetchBlocks();

    // Poll every 10 seconds
    const interval = setInterval(() => {
      fetchStats();
      fetchHashrateHistory();
      fetchSharesHistory();
      fetchBlocks();
    }, 10000);

    return () => clearInterval(interval);
  }, [isApiAvailable, fetchStats, fetchHashrateHistory, fetchSharesHistory, fetchBlocks]);

  // Update API URL
  const updateApiUrl = useCallback((url: string | null) => {
    if (url) {
      localStorage.setItem('AXEPOOL_STATS_API', url);
    } else {
      localStorage.removeItem('AXEPOOL_STATS_API');
    }
    setApiUrl(url);
    setIsApiAvailable(false);
    setIsLoading(true);
  }, []);

  return {
    apiUrl,
    isApiAvailable,
    isLoading,
    poolStats,
    hashrateHistory,
    sharesHistory,
    blocks,
    error,
    updateApiUrl,
    refresh: fetchStats,
  };
}
