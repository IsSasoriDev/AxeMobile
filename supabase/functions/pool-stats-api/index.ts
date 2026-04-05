import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const path = url.pathname.replace(/^\/pool-stats-api/, "");

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    // Health check
    if (path === "/api/health" || path === "/health" || path === "/") {
      return json({ status: "ok", timestamp: Date.now() });
    }

    // GET pool stats
    if (path === "/api/pool/stats" && req.method === "GET") {
      // Get config
      const { data: configData } = await supabase
        .from("pool_config")
        .select("*")
        .limit(1)
        .single();

      // Get active miners (seen in last 2 min)
      const twoMinAgo = new Date(Date.now() - 120000).toISOString();
      const { data: miners } = await supabase
        .from("pool_miners")
        .select("*")
        .gte("last_seen", twoMinAgo);

      const activeMiners = miners || [];
      const totalHashrate = activeMiners.reduce(
        (sum: number, m: any) => sum + Number(m.hashrate || 0),
        0
      );
      const totalShares = activeMiners.reduce(
        (sum: number, m: any) => sum + Number(m.shares || 0),
        0
      );

      // Get blocks count
      const { count: blocksFound } = await supabase
        .from("pool_blocks")
        .select("*", { count: "exact", head: true });

      // Get last block
      const { data: lastBlock } = await supabase
        .from("pool_blocks")
        .select("found_at")
        .order("found_at", { ascending: false })
        .limit(1)
        .single();

      const uptime = configData
        ? Math.floor(
            (Date.now() - new Date(configData.started_at).getTime()) / 1000
          )
        : 0;

      return json({
        pool: {
          name: configData?.pool_name || "AxePool",
          version: "1.0.0",
          uptime,
          stratumPort: configData?.stratum_port || 3333,
        },
        stats: {
          totalHashrate,
          activeMiners: activeMiners.length,
          totalShares,
          blocksFound: blocksFound || 0,
          lastBlockTime: lastBlock?.found_at || null,
          difficulty: Number(configData?.difficulty || 1),
        },
        miners: activeMiners.map((m: any) => ({
          id: m.id,
          address: m.address,
          name: m.worker_name,
          hashrate: Number(m.hashrate),
          shares: Number(m.shares),
          lastSeen: m.last_seen,
          active: true,
        })),
      });
    }

    // GET hashrate history
    if (path === "/api/pool/hashrate" && req.method === "GET") {
      const { data } = await supabase
        .from("pool_history")
        .select("recorded_at, total_hashrate, accepted_shares")
        .order("recorded_at", { ascending: true })
        .limit(360);

      const history = (data || []).map((h: any) => ({
        time: new Date(h.recorded_at).toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
        }),
        hashrate: Number(h.total_hashrate),
        shares: Number(h.accepted_shares),
      }));

      return json({ history });
    }

    // GET shares history
    if (path === "/api/pool/shares" && req.method === "GET") {
      const { data } = await supabase
        .from("pool_history")
        .select("recorded_at, accepted_shares, rejected_shares")
        .order("recorded_at", { ascending: true })
        .limit(360);

      const history = (data || []).map((h: any) => ({
        time: new Date(h.recorded_at).toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
        }),
        accepted: Number(h.accepted_shares),
        rejected: Number(h.rejected_shares),
      }));

      return json({ history });
    }

    // GET blocks
    if (path === "/api/pool/blocks" && req.method === "GET") {
      const { data } = await supabase
        .from("pool_blocks")
        .select("*")
        .order("found_at", { ascending: false })
        .limit(100);

      const blocks = (data || []).map((b: any) => ({
        height: b.height,
        hash: b.hash,
        reward: Number(b.reward),
        finder: b.finder,
        time: b.found_at,
      }));

      return json({ blocks });
    }

    // GET miners
    if (path === "/api/pool/miners" && req.method === "GET") {
      const { data } = await supabase
        .from("pool_miners")
        .select("*")
        .order("last_seen", { ascending: false });

      const miners = (data || []).map((m: any) => ({
        id: m.id,
        address: m.address,
        name: m.worker_name,
        hashrate: Number(m.hashrate),
        shares: Number(m.shares),
        lastShare: m.last_seen,
        active: m.active,
      }));

      return json({ miners });
    }

    // POST share submission (from stratum server or miner reporter)
    if (path === "/api/pool/share" && req.method === "POST") {
      const { workername, address, diff, result } = await req.json();

      if (result === "accepted" && workername) {
        // Upsert miner
        const { data: existing } = await supabase
          .from("pool_miners")
          .select("id, shares")
          .eq("worker_name", workername)
          .limit(1)
          .single();

        if (existing) {
          await supabase
            .from("pool_miners")
            .update({
              shares: Number(existing.shares) + 1,
              last_seen: new Date().toISOString(),
              active: true,
              hashrate: diff ? Number(diff) / 1e9 : 0,
            })
            .eq("id", existing.id);
        } else {
          await supabase.from("pool_miners").insert({
            worker_name: workername,
            address: address || "",
            shares: 1,
            last_seen: new Date().toISOString(),
            active: true,
            hashrate: diff ? Number(diff) / 1e9 : 0,
          });
        }
      }

      return json({ ok: true });
    }

    // POST block found
    if (path === "/api/pool/block" && req.method === "POST") {
      const { height, hash, reward, finder } = await req.json();

      await supabase.from("pool_blocks").insert({
        height,
        hash: hash || "",
        reward: reward || 0,
        finder: finder || "",
        found_at: new Date().toISOString(),
      });

      return json({ ok: true });
    }

    // POST record history snapshot (called periodically)
    if (path === "/api/pool/snapshot" && req.method === "POST") {
      const twoMinAgo = new Date(Date.now() - 120000).toISOString();
      const { data: miners } = await supabase
        .from("pool_miners")
        .select("hashrate, shares")
        .gte("last_seen", twoMinAgo);

      const activeMiners = miners || [];
      const totalHashrate = activeMiners.reduce(
        (sum: number, m: any) => sum + Number(m.hashrate || 0),
        0
      );
      const totalShares = activeMiners.reduce(
        (sum: number, m: any) => sum + Number(m.shares || 0),
        0
      );

      await supabase.from("pool_history").insert({
        total_hashrate: totalHashrate,
        active_miners: activeMiners.length,
        accepted_shares: totalShares,
        rejected_shares: 0,
      });

      // Mark stale miners inactive
      await supabase
        .from("pool_miners")
        .update({ active: false })
        .lt("last_seen", twoMinAgo);

      return json({ ok: true });
    }

    return json({ error: "Not found" }, 404);
  } catch (e) {
    console.error("Pool stats API error:", e);
    return json({ error: "Internal server error" }, 500);
  }
});
