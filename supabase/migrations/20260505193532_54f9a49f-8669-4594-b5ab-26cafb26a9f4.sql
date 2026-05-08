-- Cave BTC leaderboard entries
CREATE TABLE IF NOT EXISTS public.leaderboard_cave_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username text NOT NULL,
  cave_btc numeric NOT NULL DEFAULT 0,
  achieved_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.leaderboard_cave_entries ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_leaderboard_cave_entries_cave_btc
ON public.leaderboard_cave_entries (cave_btc DESC);

CREATE INDEX IF NOT EXISTS idx_leaderboard_cave_entries_username
ON public.leaderboard_cave_entries (lower(username));

-- Replace policies idempotently
DROP POLICY IF EXISTS "Anyone can read cave entries" ON public.leaderboard_cave_entries;
DROP POLICY IF EXISTS "Anyone can insert cave entries" ON public.leaderboard_cave_entries;
DROP POLICY IF EXISTS "Admins can update cave entries" ON public.leaderboard_cave_entries;
DROP POLICY IF EXISTS "Admins can delete cave entries" ON public.leaderboard_cave_entries;

CREATE POLICY "Anyone can read cave entries"
ON public.leaderboard_cave_entries
FOR SELECT
USING (true);

CREATE POLICY "Anyone can insert cave entries"
ON public.leaderboard_cave_entries
FOR INSERT
WITH CHECK (
  length(trim(username)) > 0
  AND length(username) <= 32
  AND cave_btc >= 0
  AND NOT EXISTS (
    SELECT 1 FROM public.leaderboard_bans b
    WHERE lower(b.username) = lower(leaderboard_cave_entries.username)
  )
);

CREATE POLICY "Admins can update cave entries"
ON public.leaderboard_cave_entries
FOR UPDATE
TO authenticated
USING (((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text)
WITH CHECK (((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text);

CREATE POLICY "Admins can delete cave entries"
ON public.leaderboard_cave_entries
FOR DELETE
TO authenticated
USING (((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text);

-- Enforce bans at write time for both leaderboard tables.
DROP TRIGGER IF EXISTS block_banned_leaderboard_entries ON public.leaderboard_entries;
CREATE TRIGGER block_banned_leaderboard_entries
BEFORE INSERT OR UPDATE ON public.leaderboard_entries
FOR EACH ROW
EXECUTE FUNCTION public.block_banned_leaderboard_users();

DROP TRIGGER IF EXISTS block_banned_leaderboard_cave_entries ON public.leaderboard_cave_entries;
CREATE TRIGGER block_banned_leaderboard_cave_entries
BEFORE INSERT OR UPDATE ON public.leaderboard_cave_entries
FOR EACH ROW
EXECUTE FUNCTION public.block_banned_leaderboard_users();