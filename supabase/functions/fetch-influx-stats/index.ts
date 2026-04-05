import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { influxUrl, token, bucket, org, measurement = "mainnet_stats" } = await req.json();

    if (!influxUrl || !token || !bucket || !org) {
      return new Response(
        JSON.stringify({ error: 'Missing required InfluxDB configuration' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400 
        }
      );
    }

    // InfluxDB query to get latest stats
    const query = `
      from(bucket: "${bucket}")
        |> range(start: -5m)
        |> filter(fn: (r) => r._measurement == "${measurement}")
        |> last()
    `;

    console.log('Querying InfluxDB:', { influxUrl, bucket, org, query });

    const response = await fetch(`${influxUrl}/api/v2/query?org=${org}`, {
      method: 'POST',
      headers: {
        'Authorization': `Token ${token}`,
        'Content-Type': 'application/vnd.flux',
        'Accept': 'application/csv',
      },
      body: query,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('InfluxDB error:', errorText);
      return new Response(
        JSON.stringify({ error: `InfluxDB error: ${response.status}` }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500 
        }
      );
    }

    const csvData = await response.text();
    console.log('InfluxDB response:', csvData);

    // Parse CSV response
    const stats = parseInfluxCSV(csvData);

    return new Response(
      JSON.stringify({ stats }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('Error fetching InfluxDB stats:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});

function parseInfluxCSV(csv: string) {
  const lines = csv.split('\n');
  const stats: Record<string, any> = {};
  
  // Skip header lines and parse data
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line && !line.startsWith('#') && !line.startsWith('_result')) {
      const fields = line.split(',');
      if (fields.length >= 6) {
        // Extract field name and value from CSV
        const field = fields[5]?.replace(/"/g, ''); // _field column
        const value = fields[6]?.replace(/"/g, ''); // _value column
        
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

  // Set defaults if no data found
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