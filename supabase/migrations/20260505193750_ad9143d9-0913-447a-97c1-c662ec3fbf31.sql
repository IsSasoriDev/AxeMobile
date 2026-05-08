CREATE OR REPLACE FUNCTION public.get_best_diff_leaderboard(_username text DEFAULT NULL, _limit integer DEFAULT 100)
RETURNS TABLE (
  rank bigint,
  username text,
  miner_name text,
  best_difficulty numeric,
  time_to_find_seconds bigint,
  achieved_at timestamp with time zone,
  prize_cave_btc numeric,
  is_current_user boolean
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  WITH best_per_user AS (
    SELECT DISTINCT ON (lower(e.username))
      e.username,
      e.miner_name,
      e.best_difficulty,
      e.time_to_find_seconds,
      e.achieved_at
    FROM public.leaderboard_entries e
    ORDER BY lower(e.username), e.best_difficulty DESC, e.achieved_at ASC
  ),
  ranked AS (
    SELECT
      rank() OVER (ORDER BY b.best_difficulty DESC, b.achieved_at ASC) AS rank,
      b.username,
      b.miner_name,
      b.best_difficulty,
      b.time_to_find_seconds,
      b.achieved_at
    FROM best_per_user b
  )
  SELECT
    r.rank,
    r.username,
    r.miner_name,
    r.best_difficulty,
    r.time_to_find_seconds,
    r.achieved_at,
    CASE
      WHEN r.rank = 1 THEN 100000::numeric
      WHEN r.rank = 2 THEN 50000::numeric
      WHEN r.rank = 3 THEN 25000::numeric
      ELSE 5000::numeric
    END AS prize_cave_btc,
    (_username IS NOT NULL AND lower(r.username) = lower(_username)) AS is_current_user
  FROM ranked r
  WHERE r.rank <= LEAST(GREATEST(_limit, 1), 100)
     OR (_username IS NOT NULL AND lower(r.username) = lower(_username))
  ORDER BY r.rank ASC, r.username ASC;
$$;

CREATE OR REPLACE FUNCTION public.get_cave_btc_leaderboard(_username text DEFAULT NULL, _limit integer DEFAULT 100)
RETURNS TABLE (
  rank bigint,
  username text,
  cave_btc numeric,
  achieved_at timestamp with time zone,
  prize_cave_btc numeric,
  is_current_user boolean
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  WITH best_per_user AS (
    SELECT DISTINCT ON (lower(e.username))
      e.username,
      e.cave_btc,
      e.achieved_at
    FROM public.leaderboard_cave_entries e
    ORDER BY lower(e.username), e.cave_btc DESC, e.achieved_at ASC
  ),
  ranked AS (
    SELECT
      rank() OVER (ORDER BY b.cave_btc DESC, b.achieved_at ASC) AS rank,
      b.username,
      b.cave_btc,
      b.achieved_at
    FROM best_per_user b
  )
  SELECT
    r.rank,
    r.username,
    r.cave_btc,
    r.achieved_at,
    CASE
      WHEN r.rank = 1 THEN 100000::numeric
      WHEN r.rank = 2 THEN 50000::numeric
      WHEN r.rank = 3 THEN 25000::numeric
      ELSE 5000::numeric
    END AS prize_cave_btc,
    (_username IS NOT NULL AND lower(r.username) = lower(_username)) AS is_current_user
  FROM ranked r
  WHERE r.rank <= LEAST(GREATEST(_limit, 1), 100)
     OR (_username IS NOT NULL AND lower(r.username) = lower(_username))
  ORDER BY r.rank ASC, r.username ASC;
$$;