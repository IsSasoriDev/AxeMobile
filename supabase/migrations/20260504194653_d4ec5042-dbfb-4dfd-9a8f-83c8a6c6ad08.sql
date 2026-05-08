
CREATE TABLE IF NOT EXISTS public.leaderboard_bans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username text NOT NULL UNIQUE,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.leaderboard_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username text NOT NULL,
  miner_name text NOT NULL DEFAULT '',
  best_difficulty numeric NOT NULL DEFAULT 0,
  time_to_find_seconds bigint NOT NULL DEFAULT 0,
  achieved_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_leaderboard_entries_diff ON public.leaderboard_entries (best_difficulty DESC);
CREATE INDEX IF NOT EXISTS idx_leaderboard_entries_username ON public.leaderboard_entries (username);

ALTER TABLE public.leaderboard_bans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leaderboard_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read bans" ON public.leaderboard_bans;
DROP POLICY IF EXISTS "Admins can insert bans" ON public.leaderboard_bans;
DROP POLICY IF EXISTS "Admins can delete bans" ON public.leaderboard_bans;
DROP POLICY IF EXISTS "Admins can update bans" ON public.leaderboard_bans;
DROP POLICY IF EXISTS "Anyone can read entries" ON public.leaderboard_entries;
DROP POLICY IF EXISTS "Anyone can insert entries" ON public.leaderboard_entries;
DROP POLICY IF EXISTS "Admins can update entries" ON public.leaderboard_entries;
DROP POLICY IF EXISTS "Admins can delete entries" ON public.leaderboard_entries;

CREATE POLICY "Anyone can read bans" ON public.leaderboard_bans FOR SELECT USING (true);
CREATE POLICY "Admins can insert bans" ON public.leaderboard_bans FOR INSERT TO authenticated
  WITH CHECK (((auth.jwt() -> 'app_metadata') ->> 'role') = 'admin');
CREATE POLICY "Admins can delete bans" ON public.leaderboard_bans FOR DELETE TO authenticated
  USING (((auth.jwt() -> 'app_metadata') ->> 'role') = 'admin');
CREATE POLICY "Admins can update bans" ON public.leaderboard_bans FOR UPDATE TO authenticated
  USING (((auth.jwt() -> 'app_metadata') ->> 'role') = 'admin')
  WITH CHECK (((auth.jwt() -> 'app_metadata') ->> 'role') = 'admin');

CREATE POLICY "Anyone can read entries" ON public.leaderboard_entries FOR SELECT USING (true);
CREATE POLICY "Anyone can insert entries" ON public.leaderboard_entries FOR INSERT
  WITH CHECK (
    length(trim(username)) > 0
    AND length(username) <= 32
    AND best_difficulty >= 0
    AND NOT EXISTS (SELECT 1 FROM public.leaderboard_bans b WHERE lower(b.username) = lower(leaderboard_entries.username))
  );
CREATE POLICY "Admins can update entries" ON public.leaderboard_entries FOR UPDATE TO authenticated
  USING (((auth.jwt() -> 'app_metadata') ->> 'role') = 'admin')
  WITH CHECK (((auth.jwt() -> 'app_metadata') ->> 'role') = 'admin');
CREATE POLICY "Admins can delete entries" ON public.leaderboard_entries FOR DELETE TO authenticated
  USING (((auth.jwt() -> 'app_metadata') ->> 'role') = 'admin');

CREATE OR REPLACE FUNCTION public.block_banned_leaderboard_users()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.leaderboard_bans WHERE lower(username) = lower(NEW.username)) THEN
    RAISE EXCEPTION 'Username is banned from the leaderboard';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_block_banned_leaderboard_users ON public.leaderboard_entries;
CREATE TRIGGER trg_block_banned_leaderboard_users
BEFORE INSERT OR UPDATE ON public.leaderboard_entries
FOR EACH ROW EXECUTE FUNCTION public.block_banned_leaderboard_users();
