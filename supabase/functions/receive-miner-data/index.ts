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

    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 405 
        }
      );
    }

    const body = await req.json();
    console.log('Received miner data:', body);

    // Extract miner data - this would come from axeOS/NerdAxe firmware
    const {
      miner_id,
      hashrate,
      temperature,
      voltage,
      power,
      shares_accepted,
      shares_rejected,
      uptime_seconds
    } = body;

    if (!miner_id) {
      return new Response(
        JSON.stringify({ error: 'miner_id is required' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400 
        }
      );
    }

    // Insert miner stats into database
    const { data, error } = await supabaseClient
      .from('miner_stats')
      .insert({
        miner_id,
        hashrate: hashrate || 0,
        temperature: temperature || 0,
        voltage: voltage || 0,
        power: power || 0,
        shares_accepted: shares_accepted || 0,
        shares_rejected: shares_rejected || 0,
        uptime_seconds: uptime_seconds || 0,
        recorded_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      console.error('Error inserting miner stats:', error);
      return new Response(
        JSON.stringify({ error: 'Failed to save miner data' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500 
        }
      );
    }

    // Also update the miner's last_seen timestamp
    await supabaseClient
      .from('miners')
      .update({ 
        last_seen: new Date().toISOString(),
        status: 'online'
      })
      .eq('id', miner_id);

    console.log('Successfully saved miner data:', data);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Miner data received and saved',
        data 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('Error in receive-miner-data function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});