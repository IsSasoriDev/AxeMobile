-- Create miners table
CREATE TABLE IF NOT EXISTS public.miners (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  ip_address TEXT NOT NULL,
  model TEXT NOT NULL CHECK (model IN ('bitaxe', 'nerdaxe')),
  status TEXT NOT NULL DEFAULT 'offline' CHECK (status IN ('online', 'offline', 'checking')),
  last_seen TIMESTAMP WITH TIME ZONE,
  firmware_version TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create miner_stats table
CREATE TABLE IF NOT EXISTS public.miner_stats (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  miner_id UUID NOT NULL REFERENCES public.miners(id) ON DELETE CASCADE,
  hashrate DECIMAL,
  temperature DECIMAL,
  voltage DECIMAL,
  power DECIMAL,
  shares_accepted INTEGER DEFAULT 0,
  shares_rejected INTEGER DEFAULT 0,
  uptime_seconds INTEGER DEFAULT 0,
  recorded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.miners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.miner_stats ENABLE ROW LEVEL SECURITY;

-- Create policies to allow public access (since this is a miner dashboard)
CREATE POLICY "Allow all access to miners" ON public.miners FOR ALL USING (true);
CREATE POLICY "Allow all access to miner_stats" ON public.miner_stats FOR ALL USING (true);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_miners_status ON public.miners(status);
CREATE INDEX IF NOT EXISTS idx_miners_last_seen ON public.miners(last_seen);
CREATE INDEX IF NOT EXISTS idx_miner_stats_miner_id ON public.miner_stats(miner_id);
CREATE INDEX IF NOT EXISTS idx_miner_stats_recorded_at ON public.miner_stats(recorded_at);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger for automatic timestamp updates
DROP TRIGGER IF EXISTS update_miners_updated_at ON public.miners;
CREATE TRIGGER update_miners_updated_at
  BEFORE UPDATE ON public.miners
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();