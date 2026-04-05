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

    // Fetch latest releases from GitHub
    const [bitaxeReleases, nerdaxeReleases, appReleases] = await Promise.all([
      fetchGitHubReleases('bitaxeorg', 'ESP-Miner'),
      fetchGitHubReleases('shufps', 'ESP-Miner-NerdQAxePlus'),
      fetchGitHubReleases('IsSasoriDev', 'AxeMobile'),
    ]);

    // Update firmware releases in database
    if (bitaxeReleases.length > 0) {
      await updateFirmwareReleases(supabaseClient, 'bitaxe', bitaxeReleases[0]);
    }
    
    if (nerdaxeReleases.length > 0) {
      await updateFirmwareReleases(supabaseClient, 'nerdaxe', nerdaxeReleases[0]);
    }

    // Update app releases
    if (appReleases.length > 0) {
      await updateAppReleases(supabaseClient, appReleases[0]);
    }

    return new Response(
      JSON.stringify({
        bitaxe: bitaxeReleases[0] || null,
        nerdaxe: nerdaxeReleases[0] || null,
        app: appReleases[0] || null,
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      },
    );
  } catch (error) {
    console.error('Error checking updates:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      },
    );
  }
});

async function fetchGitHubReleases(owner: string, repo: string) {
  try {
    const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/releases?per_page=5`);
    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status}`);
    }
    const releases = await response.json();
    return releases.map((release: any) => ({
      version: release.tag_name,
      name: release.name,
      body: release.body,
      downloadUrl: release.assets?.[0]?.browser_download_url || release.zipball_url,
      htmlUrl: release.html_url,
      publishedAt: release.published_at,
    }));
  } catch (error) {
    console.error(`Error fetching releases for ${owner}/${repo}:`, error);
    return [];
  }
}

async function updateFirmwareReleases(supabaseClient: any, model: string, release: any) {
  // Mark all existing releases as not latest
  await supabaseClient
    .from('firmware_releases')
    .update({ is_latest: false })
    .eq('model', model);

  // Insert or update the latest release
  await supabaseClient
    .from('firmware_releases')
    .upsert({
      model,
      version: release.version,
      release_url: release.htmlUrl,
      download_url: release.downloadUrl,
      release_notes: release.body,
      is_latest: true,
    });
}

async function updateAppReleases(supabaseClient: any, release: any) {
  // Mark all existing releases as not latest
  await supabaseClient
    .from('app_updates')
    .update({ is_latest: false });

  // Insert or update the latest release
  await supabaseClient
    .from('app_updates')
    .upsert({
      version: release.version,
      release_notes: release.body,
      download_url: release.downloadUrl,
      is_latest: true,
    });
}