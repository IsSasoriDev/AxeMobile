
-- Pool miners tracking
CREATE TABLE public.pool_miners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_name text NOT NULL,
  address text NOT NULL DEFAULT '',
  hashrate numeric NOT NULL DEFAULT 0,
  shares bigint NOT NULL DEFAULT 0,
  last_seen timestamptz NOT NULL DEFAULT now(),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Pool blocks found
CREATE TABLE public.pool_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  height bigint NOT NULL,
  hash text NOT NULL DEFAULT '',
  reward numeric NOT NULL DEFAULT 0,
  finder text NOT NULL DEFAULT '',
  found_at timestamptz NOT NULL DEFAULT now()
);

-- Pool hashrate/shares history (time-series)
CREATE TABLE public.pool_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recorded_at timestamptz NOT NULL DEFAULT now(),
  total_hashrate numeric NOT NULL DEFAULT 0,
  active_miners int NOT NULL DEFAULT 0,
  accepted_shares bigint NOT NULL DEFAULT 0,
  rejected_shares bigint NOT NULL DEFAULT 0
);

-- Pool config (single row for pool metadata)
CREATE TABLE public.pool_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pool_name text NOT NULL DEFAULT 'AxePool',
  stratum_port int NOT NULL DEFAULT 3333,
  difficulty numeric NOT NULL DEFAULT 1,
  started_at timestamptz NOT NULL DEFAULT now()
);

-- Insert default pool config
INSERT INTO public.pool_config (pool_name, stratum_port, difficulty)
VALUES ('AxePool', 3333, 1);

-- Enable RLS
ALTER TABLE public.pool_miners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pool_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pool_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pool_config ENABLE ROW LEVEL SECURITY;

-- Public read access for all pool tables
CREATE POLICY "Anyone can read pool miners" ON public.pool_miners FOR SELECT USING (true);
CREATE POLICY "Anyone can read pool blocks" ON public.pool_blocks FOR SELECT USING (true);
CREATE POLICY "Anyone can read pool history" ON public.pool_history FOR SELECT USING (true);
CREATE POLICY "Anyone can read pool config" ON public.pool_config FOR SELECT USING (true);

-- Insert/update for authenticated or service role
CREATE POLICY "Service can insert pool miners" ON public.pool_miners FOR INSERT WITH CHECK (true);
CREATE POLICY "Service can update pool miners" ON public.pool_miners FOR UPDATE USING (true);
CREATE POLICY "Service can insert pool blocks" ON public.pool_blocks FOR INSERT WITH CHECK (true);
CREATE POLICY "Service can insert pool history" ON public.pool_history FOR INSERT WITH CHECK (true);
CREATE POLICY "Service can update pool config" ON public.pool_config FOR UPDATE USING (true);

-- Enable realtime for live dashboard
ALTER PUBLICATION supabase_realtime ADD TABLE public.pool_miners;
ALTER PUBLICATION supabase_realtime ADD TABLE public.pool_history;
