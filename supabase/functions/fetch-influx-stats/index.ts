import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function isPrivateHost(urlStr: string): boolean {
  try {
    const url = new URL(urlStr);
    const host = url.hostname;
    // Check for IP-based hosts
    const parts = host.split('.');
    if (parts.length === 4 && parts.every(p => !isNaN(Number(p)))) {
      const [a, b] = parts.map(Number);
      if (a === 10) return true;
      if (a === 172 && b >= 16 && b <= 31) return true;
      if (a === 192 && b === 168) return true;
      if (a === 127) return true;
      if (a === 169 && b === 254) return true;
      if (a === 0) return true;
    }
    // Block localhost variants
    if (host === 'localhost' || host === '[::1]') return true;
    // Block metadata endpoints
    if (host === '169.254.169.254') return true;
    return false;
  } catch {
    return true; // Invalid URL, reject
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { influxUrl, token, bucket, org, measurement = "mainnet_stats" } = await req.json();

    if (!influxUrl || !token || !bucket || !org) {
      return new Response(
        JSON.stringify({ error: 'Missing required InfluxDB configuration' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    if (typeof influxUrl !== 'string' || isPrivateHost(influxUrl)) {
      return new Response(
        JSON.stringify({ error: 'Invalid or private InfluxDB URL' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Sanitize bucket and measurement to prevent Flux injection
    const safeBucket = bucket.replace(/[^a-zA-Z0-9_\-]/g, '');
    const safeMeasurement = measurement.replace(/[^a-zA-Z0-9_\-]/g, '');

    const query = `
      from(bucket: "${safeBucket}")
        |> range(start: -5m)
        |> filter(fn: (r) => r._measurement == "${safeMeasurement}")
        |> last()
    `;

    const response = await fetch(`${influxUrl}/api/v2/query?org=${encodeURIComponent(org)}`, {
      method: 'POST',
      headers: {
        'Authorization': `Token ${token}`,
        'Content-Type': 'application/vnd.flux',
        'Accept': 'application/csv',
      },
      body: query,
    });

    if (!response.ok) {
      return new Response(
        JSON.stringify({ error: `InfluxDB error: ${response.status}` }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    const csvData = await response.text();
    const stats = parseInfluxCSV(csvData);

    return new Response(
      JSON.stringify({ stats }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error) {
    console.error('Error fetching InfluxDB stats:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});

function parseInfluxCSV(csv: string) {
  const lines = csv.split('\n');
  const stats: Record<string, any> = {};
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line && !line.startsWith('#') && !line.startsWith('_result')) {
      const fields = line.split(',');
      if (fields.length >= 6) {
        const field = fields[5]?.replace(/"/g, '');
        const value = fields[6]?.replace(/"/g, '');
        
        if (field && value) {
          switch (field) {
            case 'hashrate':
              stats.hashrate = parseFloat(value) || 0;
              break;
            case 'temperature':
              stats.temperature = parseFloat(value) || 0;
              break;
            case 'voltage':
              stats.voltage = parseFloat(value) || 0;
              break;
            case 'power':
              stats.power = parseFloat(value) || 0;
              break;
            case 'shares_accepted':
              stats.shares = stats.shares || {};
              stats.shares.accepted = parseInt(value) || 0;
              break;
            case 'shares_rejected':
              stats.shares = stats.shares || {};
              stats.shares.rejected = parseInt(value) || 0;
              break;
            case 'uptime':
              stats.uptime = parseInt(value) || 0;
              break;
          }
        }
      }
    }
  }

  return {
    hashrate: stats.hashrate || 0,
    temperature: stats.temperature || 0,
    voltage: stats.voltage || 0,
    power: stats.power || 0,
    shares: {
      accepted: stats.shares?.accepted || 0,
      rejected: stats.shares?.rejected || 0,
    },
    uptime: stats.uptime || 0,
  };
}
