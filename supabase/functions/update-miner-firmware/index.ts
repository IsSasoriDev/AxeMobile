import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function isPrivateIP(ip: string): boolean {
  const host = ip.split(':')[0];
  const parts = host.split('.');
  if (parts.length !== 4 || parts.some(p => isNaN(Number(p)) || Number(p) < 0 || Number(p) > 255)) {
    return true;
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

const ALLOWED_FIRMWARE_HOSTS = [
  'github.com',
  'objects.githubusercontent.com',
  'github-releases.githubusercontent.com',
  'raw.githubusercontent.com',
];

function isAllowedFirmwareUrl(urlStr: string): boolean {
  try {
    const url = new URL(urlStr);
    if (url.protocol !== 'https:') return false;
    return ALLOWED_FIRMWARE_HOSTS.some(h => url.hostname === h || url.hostname.endsWith('.' + h));
  } catch {
    return false;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { miners, firmwareUrl, model } = await req.json();

    if (!miners || !Array.isArray(miners) || miners.length === 0) {
      throw new Error('Miners array is required');
    }

    if (!firmwareUrl || typeof firmwareUrl !== 'string') {
      throw new Error('Firmware URL is required');
    }

    if (!isAllowedFirmwareUrl(firmwareUrl)) {
      return new Response(
        JSON.stringify({ error: 'Firmware URL must be an HTTPS GitHub release URL' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const results = [];

    for (const miner of miners) {
      try {
        if (!miner.ipAddress || isPrivateIP(miner.ipAddress)) {
          results.push({
            miner: miner.name,
            ipAddress: miner.ipAddress,
            success: false,
            error: 'Invalid or private IP address',
          });
          continue;
        }

        const result = await updateMinerFirmware(miner.ipAddress, firmwareUrl, model);
        results.push({
          miner: miner.name,
          ipAddress: miner.ipAddress,
          success: true,
          message: result.message,
        });
      } catch (error) {
        results.push({
          miner: miner.name,
          ipAddress: miner.ipAddress,
          success: false,
          error: error.message,
        });
      }
    }

    return new Response(
      JSON.stringify({ results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 },
    );
  } catch (error) {
    console.error('Error updating firmware:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});

async function updateMinerFirmware(ipAddress: string, firmwareUrl: string, model: string) {
  const firmwareResponse = await fetch(firmwareUrl);
  if (!firmwareResponse.ok) {
    throw new Error(`Failed to download firmware: ${firmwareResponse.status}`);
  }
  
  const firmwareData = await firmwareResponse.arrayBuffer();
  
  const statusCheck = await fetch(`http://${ipAddress}/api/system/info`, {
    signal: AbortSignal.timeout(5000)
  });
  
  if (!statusCheck.ok) {
    throw new Error('Miner is not reachable');
  }

  const formData = new FormData();
  formData.append('firmware', new Blob([firmwareData]), 'firmware.bin');
  
  const uploadResponse = await fetch(`http://${ipAddress}/api/system/OTA`, {
    method: 'POST',
    body: formData,
    signal: AbortSignal.timeout(120000),
  });

  if (!uploadResponse.ok) {
    throw new Error(`Firmware upload failed: ${uploadResponse.status}`);
  }

  await new Promise(resolve => setTimeout(resolve, 30000));

  try {
    const verifyResponse = await fetch(`http://${ipAddress}/api/system/info`, {
      signal: AbortSignal.timeout(10000)
    });
    
    if (verifyResponse.ok) {
      const info = await verifyResponse.json();
      return {
        message: `Firmware updated successfully. Version: ${info.version || 'Unknown'}`,
        version: info.version,
      };
    }
  } catch {
    return { message: 'Firmware upload completed. Miner is rebooting...' };
  }

  return { message: 'Firmware update initiated successfully' };
}
