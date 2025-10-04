import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface BitcoinNetworkStats {
  difficulty: number;
  hashrate: number; // in EH/s
  blockReward: number;
  priceUsd: number;
  marketCapUsd: number;
  nextDifficultyAdjustment: number;
  mempoolCount: number;
  mempoolVsize: number;
  updatedAt: string;
}

export function useBitcoinStats() {
  const [stats, setStats] = useState<BitcoinNetworkStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBitcoinStats = async (showToast = false) => {
    try {
      setError(null);
      
      const { data, error } = await supabase.functions.invoke('fetch-bitcoin-stats');
      
      if (error) throw error;
      
      if (showToast) {
        toast.success("Bitcoin network stats updated");
      }
      
      return data as BitcoinNetworkStats;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch Bitcoin stats';
      setError(errorMessage);
      if (showToast) {
        toast.error(errorMessage);
      }
      throw err;
    }
  };

  const loadStoredStats = async () => {
    try {
      const { data, error } = await supabase
        .from('bitcoin_network_stats')
        .select('*')
        .eq('id', 'current')
        .maybeSingle();

      if (error) throw error;
      
      if (data) {
        setStats({
          difficulty: data.difficulty,
          hashrate: data.hashrate,
          blockReward: data.block_reward,
          priceUsd: data.price_usd,
          marketCapUsd: data.market_cap_usd,
          nextDifficultyAdjustment: data.next_difficulty_adjustment,
          mempoolCount: data.mempool_count,
          mempoolVsize: data.mempool_vsize,
          updatedAt: data.updated_at
        });
      }
    } catch (err) {
      console.error('Error loading stored Bitcoin stats:', err);
    }
  };

  const refreshStats = async () => {
    setLoading(true);
    try {
      const newStats = await fetchBitcoinStats(true);
      setStats(newStats);
    } catch (err) {
      // Error is already handled in fetchBitcoinStats
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Load stored stats first for immediate display
    loadStoredStats().finally(() => setLoading(false));
    
    // Then fetch fresh stats in background
    fetchBitcoinStats(false).then(setStats).catch(() => {
      // Silent fail, use stored data
    });

    // Set up real-time subscription for live updates
    const channel = supabase
      .channel('bitcoin-stats-updates')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'bitcoin_network_stats'
        },
        (payload) => {
          console.log('Bitcoin stats updated in real-time:', payload);
          const newData = payload.new as any;
          setStats({
            difficulty: newData.difficulty,
            hashrate: newData.hashrate,
            blockReward: newData.block_reward,
            priceUsd: newData.price_usd,
            marketCapUsd: newData.market_cap_usd,
            nextDifficultyAdjustment: newData.next_difficulty_adjustment,
            mempoolCount: newData.mempool_count,
            mempoolVsize: newData.mempool_vsize,
            updatedAt: newData.updated_at
          });
        }
      )
      .subscribe();

    // Periodic refresh every 5 minutes
    const interval = setInterval(() => {
      fetchBitcoinStats(false).then(setStats).catch(() => {
        // Silent fail, keep existing data
      });
    }, 5 * 60 * 1000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, []);

  return {
    stats,
    loading,
    error,
    refreshStats,
  };
}
