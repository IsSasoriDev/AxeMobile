import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface CoinData {
  name: string;
  symbol: string;
  networkHashrate: number;
  blockReward: number;
  blockTime: number;
  price: number;
  difficulty: number;
}

const defaultCoinData: Record<string, CoinData> = {
  bitcoin: {
    name: "Bitcoin",
    symbol: "BTC",
    networkHashrate: 904000000,
    blockReward: 3.125,
    blockTime: 600,
    price: 118785,
    difficulty: 126271300000000,
  },
  bitcoincash: {
    name: "Bitcoin Cash",
    symbol: "BCH",
    networkHashrate: 4570000,
    blockReward: 3.125,
    blockTime: 600,
    price: 550,
    difficulty: 616530000000,
  },
  digibyte: {
    name: "DigiByte",
    symbol: "DGB",
    networkHashrate: 800000,
    blockReward: 665,
    blockTime: 15,
    price: 0.0081,
    difficulty: 12000000000,
  },
  ecash: {
    name: "eCash",
    symbol: "XEC",
    networkHashrate: 77520,
    blockReward: 1812500,
    blockTime: 660,
    price: 0.00001985,
    difficulty: 11910000000,
  },
  "bitcoin-ii": {
    name: "Bitcoin-II",
    symbol: "BC2",
    networkHashrate: 15000,
    blockReward: 50,
    blockTime: 600,
    price: 1.6811,
    difficulty: 200000000,
  },
};

export function useCoinStats() {
  const [coinData, setCoinData] = useState<Record<string, CoinData>>(defaultCoinData);
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  useEffect(() => {
    fetchAllStats();
    
    // Update every 5 minutes
    const interval = setInterval(fetchAllStats, 5 * 60 * 1000);
    
    return () => clearInterval(interval);
  }, []);

  const fetchAllStats = async () => {
    try {
      // Fetch Bitcoin stats
      const { data: btcStats } = await supabase.functions.invoke('fetch-bitcoin-stats');
      
      // Fetch altcoin stats
      const { data: altStats } = await supabase.functions.invoke('fetch-altcoin-stats', {
        body: { coin: 'all' }
      });

      const updatedData = { ...defaultCoinData };

      // Update Bitcoin data
      if (btcStats) {
        updatedData.bitcoin = {
          ...updatedData.bitcoin,
          networkHashrate: btcStats.hashrate * 1000000, // Convert EH/s to TH/s
          difficulty: btcStats.difficulty,
          price: btcStats.price,
        };
      }

      // Update altcoin data
      if (Array.isArray(altStats)) {
        altStats.forEach((stats: any) => {
          if (stats.coin && updatedData[stats.coin]) {
            updatedData[stats.coin] = {
              ...updatedData[stats.coin],
              networkHashrate: stats.networkHashrate,
              difficulty: stats.difficulty,
              price: stats.price,
              blockReward: stats.blockReward,
              blockTime: stats.blockTime,
            };
          }
        });
      }

      setCoinData(updatedData);
      setLastUpdate(new Date());
    } catch (error) {
      console.error('Error fetching coin stats:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const refreshStats = () => {
    setIsLoading(true);
    fetchAllStats();
  };

  return {
    coinData,
    isLoading,
    lastUpdate,
    refreshStats,
  };
}
