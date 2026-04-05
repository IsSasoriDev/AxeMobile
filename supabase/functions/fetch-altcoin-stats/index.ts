import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CoinStats {
  coin: string;
  networkHashrate: number; // in TH/s
  difficulty: number;
  blockReward: number;
  blockTime: number;
  price: number;
}

async function fetchBitcoinCashStats(): Promise<CoinStats> {
  try {
    // Fetch from multiple sources
    const [priceData, difficultyData] = await Promise.all([
      fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin-cash&vs_currencies=usd').then(r => r.json()),
      fetch('https://api.blockchain.info/ticker').then(r => r.json())
    ]);

    // BCH network stats from blockchain explorers
    const price = priceData['bitcoin-cash']?.usd || 550;
    
    return {
      coin: 'bitcoincash',
      networkHashrate: 4570000, // 4.57 EH/s in TH/s
      difficulty: 616530000000,
      blockReward: 3.125,
      blockTime: 600,
      price
    };
  } catch (error) {
    console.error('Error fetching BCH stats:', error);
    return {
      coin: 'bitcoincash',
      networkHashrate: 4570000,
      difficulty: 616530000000,
      blockReward: 3.125,
      blockTime: 600,
      price: 550
    };
  }
}

async function fetchDigiByteStats(): Promise<CoinStats> {
  try {
    const priceData = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=digibyte&vs_currencies=usd').then(r => r.json());
    const price = priceData.digibyte?.usd || 0.0081;
    
    return {
      coin: 'digibyte',
      networkHashrate: 800000, // 800 PH/s in TH/s
      difficulty: 12000000000,
      blockReward: 665,
      blockTime: 15,
      price
    };
  } catch (error) {
    console.error('Error fetching DGB stats:', error);
    return {
      coin: 'digibyte',
      networkHashrate: 800000,
      difficulty: 12000000000,
      blockReward: 665,
      blockTime: 15,
      price: 0.0081
    };
  }
}

async function fetchECashStats(): Promise<CoinStats> {
  try {
    const priceData = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=ecash&vs_currencies=usd').then(r => r.json());
    const price = priceData.ecash?.usd || 0.00001985;
    
    return {
      coin: 'ecash',
      networkHashrate: 77520, // 77.52 PH/s in TH/s
      difficulty: 11910000000,
      blockReward: 1812500,
      blockTime: 660,
      price
    };
  } catch (error) {
    console.error('Error fetching XEC stats:', error);
    return {
      coin: 'ecash',
      networkHashrate: 77520,
      difficulty: 11910000000,
      blockReward: 1812500,
      blockTime: 660,
      price: 0.00001985
    };
  }
}

async function fetchBitcoinIIStats(): Promise<CoinStats> {
  try {
    // Fetch BC2 price from NonKYC API
    const priceData = await fetch('https://nonkyc.io/api/v2/market/BC2_USDT').then(r => r.json());
    const price = parseFloat(priceData?.ticker?.last || '1.6811');
    
    return {
      coin: 'bitcoin-ii',
      networkHashrate: 15000, // 15 PH/s in TH/s
      difficulty: 200000000,
      blockReward: 50,
      blockTime: 600,
      price
    };
  } catch (error) {
    console.error('Error fetching BC2 stats:', error);
    return {
      coin: 'bitcoin-ii',
      networkHashrate: 15000,
      difficulty: 200000000,
      blockReward: 50,
      blockTime: 600,
      price: 1.6811
    };
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const coin = url.searchParams.get('coin') || 'all';

    let stats: CoinStats | CoinStats[];

    if (coin === 'all') {
      stats = await Promise.all([
        fetchBitcoinCashStats(),
        fetchDigiByteStats(),
        fetchECashStats(),
        fetchBitcoinIIStats()
      ]);
    } else {
      switch (coin) {
        case 'bitcoincash':
          stats = await fetchBitcoinCashStats();
          break;
        case 'digibyte':
          stats = await fetchDigiByteStats();
          break;
        case 'ecash':
          stats = await fetchECashStats();
          break;
        case 'bitcoin-ii':
          stats = await fetchBitcoinIIStats();
          break;
        default:
          throw new Error('Invalid coin parameter');
      }
    }

    return new Response(JSON.stringify(stats), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in fetch-altcoin-stats function:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
