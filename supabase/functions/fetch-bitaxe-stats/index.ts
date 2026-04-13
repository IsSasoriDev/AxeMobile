import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function isPrivateIP(ip: string): boolean {
  // Remove port if present
  const host = ip.split(':')[0];
  const parts = host.split('.');
  if (parts.length !== 4 || parts.some(p => isNaN(Number(p)) || Number(p) < 0 || Number(p) > 255)) {
    return true; // Invalid IP format, reject
  }
  const [a, b] = parts.map(Number);
  if (a === 10) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 0) return true;
  return false;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    );

    const { minerId, ipAddress } = await req.json();

    if (!ipAddress || typeof ipAddress !== 'string') {
      return new Response(JSON.stringify({ error: 'Valid IP address is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (isPrivateIP(ipAddress)) {
      return new Response(JSON.stringify({ error: 'Private/reserved IP addresses are not allowed' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Fetching stats for miner ${minerId} at ${ipAddress}`);
    
    const stats = await fetchBitaxeStats(ipAddress);
    
    if (minerId && stats) {
      const { error: insertError } = await supabaseClient
        .from('miner_stats')
        .insert({
          miner_id: minerId,
          user_id: null,
          hashrate: stats.hashrate,
          temperature: stats.temperature,
          voltage: stats.voltage,
          power: stats.power,
          shares_accepted: stats.shares.accepted,
          shares_rejected: stats.shares.rejected,
          uptime_seconds: stats.uptime
        });

      if (insertError) {
        console.error('Error inserting miner stats:', insertError);
      }
    }

    return new Response(JSON.stringify(stats), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in fetch-bitaxe-stats function:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function fetchBitaxeStats(ipAddress: string) {
  const endpoints = [
    `http://${ipAddress}/api/system/info`,
    `http://${ipAddress}/api/v1/system/info`,
    `http://${ipAddress}/system/info`
  ];

  let data;

  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(10000)
      });

      if (response.ok) {
        data = await response.json();
        break;
      }
    } catch (err) {
      continue;
    }
  }

  if (!data) {
    throw new Error(`Unable to connect to any Bitaxe API endpoint for ${ipAddress}`);
  }

  return parseBitaxeData(data);
}

function parseBitaxeData(data: any) {
  return {
    hashrate: data.hashRate || data.hashrate || data['Hash Rate'] || 0,
    temperature: data.temp || data.temperature || data['Temperature'] || 0,
    voltage: data.voltage || data['Voltage'] || 0,
    power: data.power || data['Power'] || 0,
    shares: {
      accepted: data.accepted || data.sharesAccepted || data['Shares Accepted'] || 0,
      rejected: data.rejected || data.sharesRejected || data['Shares Rejected'] || 0
    },
    uptime: data.uptime || data['Uptime'] || 0
  };
}
