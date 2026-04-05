import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { miners, firmwareUrl, model } = await req.json();

    if (!miners || !Array.isArray(miners) || miners.length === 0) {
      throw new Error('Miners array is required');
    }

    if (!firmwareUrl) {
      throw new Error('Firmware URL is required');
    }

    const results = [];

    for (const miner of miners) {
      try {
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
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      },
    );
  } catch (error) {
    console.error('Error updating firmware:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      },
    );
  }
});

async function updateMinerFirmware(ipAddress: string, firmwareUrl: string, model: string) {
  try {
    // Download firmware file
    const firmwareResponse = await fetch(firmwareUrl);
    if (!firmwareResponse.ok) {
      throw new Error(`Failed to download firmware: ${firmwareResponse.status}`);
    }
    
    const firmwareData = await firmwareResponse.arrayBuffer();
    
    // Check if miner is reachable
    const statusCheck = await fetch(`http://${ipAddress}/api/system/info`, {
      signal: AbortSignal.timeout(5000)
    });
    
    if (!statusCheck.ok) {
      throw new Error('Miner is not reachable');
    }

    // Create multipart form data for firmware upload
    const formData = new FormData();
    formData.append('firmware', new Blob([firmwareData]), 'firmware.bin');
    
    // Upload firmware to miner
    const uploadResponse = await fetch(`http://${ipAddress}/api/system/OTA`, {
      method: 'POST',
      body: formData,
      signal: AbortSignal.timeout(120000), // 2 minute timeout
    });

    if (!uploadResponse.ok) {
      throw new Error(`Firmware upload failed: ${uploadResponse.status}`);
    }

    // Wait for miner to reboot and verify update
    await new Promise(resolve => setTimeout(resolve, 30000)); // Wait 30 seconds

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
    } catch (verifyError) {
      // Miner might still be rebooting
      return {
        message: 'Firmware upload completed. Miner is rebooting...',
      };
    }

    return {
      message: 'Firmware update initiated successfully',
    };
  } catch (error) {
    console.error(`Error updating firmware for ${ipAddress}:`, error);
    throw error;
  }
}