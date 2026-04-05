import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    // Check if any InfluxDB setup exists (public use)
    const { data: existingSetup, error: fetchError } = await supabaseClient
      .from('influx_instances')
      .select('*')
      .limit(1)
      .maybeSingle();

    if (existingSetup && !fetchError) {
      return new Response(
        JSON.stringify(existingSetup),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200 
        }
      );
    }

    // Create new InfluxDB instance configuration
    const instanceId = crypto.randomUUID();
    const token = generateInfluxToken();
    const bucket = `miner_${instanceId.split('-')[0]}`;
    const org = `public_${instanceId.split('-')[0]}`;
    
    // For demo purposes, use a shared InfluxDB URL
    // In production, this could spawn actual Docker containers or use InfluxDB Cloud API
    const influxUrl = `https://influx-proxy.axemobile.app/${instanceId}`;

    const newInstance = {
      id: instanceId,
      user_id: null,
      influx_url: influxUrl,
      token: token,
      bucket: bucket,
      org: org,
      measurement: 'mainnet_stats',
      status: 'active',
      created_at: new Date().toISOString(),
    };

    const { data, error } = await supabaseClient
      .from('influx_instances')
      .insert(newInstance)
      .select()
      .single();

    if (error) throw error;

    return new Response(
      JSON.stringify(data),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 201 
      }
    );

  } catch (error) {
    console.error('Error setting up InfluxDB:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});

function generateInfluxToken(): string {
  // Generate a secure random token
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 64; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}