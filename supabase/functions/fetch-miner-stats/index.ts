import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    );

    const { minerId, ipAddress } = await req.json();

    if (!ipAddress) {
      throw new Error('IP address is required');
    }

    // Fetch stats from miner API
    const stats = await fetchMinerStats(ipAddress);
    
    if (minerId && stats) {
      // Store stats in database
      await supabaseClient
        .from('miner_stats')
        .insert({
          miner_id: minerId,
          hashrate: stats.hashrate,
          temperature: stats.temperature,
          voltage: stats.voltage,
          power: stats.power,
          shares_accepted: stats.shares?.accepted || 0,
          shares_rejected: stats.shares?.rejected || 0,
          uptime_seconds: stats.uptime || 0,
        });
    }

    return new Response(
      JSON.stringify(stats),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      },
    );
  } catch (error) {
    console.error('Error fetching miner stats:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      },
    );
  }
});

async function fetchMinerStats(ipAddress: string) {
  try {
    // Official NerdAxe/BitAxe API endpoint
    const endpoint = `http://${ipAddress}/api/system/info`;
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    const response = await fetch(endpoint, {
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
      }
    });
    
    clearTimeout(timeoutId);
    
    if (response.ok) {
      const data = await response.json();
      return parseStatsData(data);
    }
    
    throw new Error('Unable to connect to miner API');
  } catch (error) {
    console.error('Error fetching stats:', error);
    throw error;
  }
}

function parseStatsData(data: any) {
  // Parse data from NerdAxe/BitAxe API format (official endpoints)
  // Reference: https://github.com/shufps/ESP-Miner-NerdQAxePlus
  return {
    hashrate: data.hashRate || data.hashRate_10m || data.hashrate || 0,
    temperature: data.temp || data.temperature || data.asicTemp || 0,
    voltage: data.voltage || data.coreVoltage || data.coreVoltageActual || 0,
    power: data.power || data.powerConsumption || 0,
    shares: {
      accepted: data.sharesAccepted || data.shares?.accepted || 0,
      rejected: data.sharesRejected || data.shares?.rejected || 0,
    },
    uptime: data.uptimeSeconds || data.uptime || 0,
    version: data.version || 'Unknown',
  };
}