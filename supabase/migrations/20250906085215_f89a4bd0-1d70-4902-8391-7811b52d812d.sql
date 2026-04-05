-- Create table for Bitcoin network statistics
CREATE TABLE public.bitcoin_network_stats (
  id TEXT PRIMARY KEY DEFAULT 'current',
  difficulty NUMERIC NOT NULL,
  hashrate NUMERIC NOT NULL, -- in EH/s
  block_reward NUMERIC NOT NULL DEFAULT 3.125,
  price_usd NUMERIC NOT NULL DEFAULT 0,
  market_cap_usd NUMERIC NOT NULL DEFAULT 0,  
  next_difficulty_adjustment INTEGER NOT NULL DEFAULT 0,
  mempool_count INTEGER NOT NULL DEFAULT 0,
  mempool_vsize BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.bitcoin_network_stats ENABLE ROW LEVEL SECURITY;

-- Create policy for public read access
CREATE POLICY "Bitcoin network stats are publicly readable" 
ON public.bitcoin_network_stats 
FOR SELECT 
USING (true);

-- Create policy for service role write access
CREATE POLICY "Service role can update bitcoin network stats" 
ON public.bitcoin_network_stats 
FOR ALL
USING (auth.role() = 'service_role');

-- Add trigger for automatic timestamp updates
CREATE TRIGGER update_bitcoin_network_stats_updated_at
BEFORE UPDATE ON public.bitcoin_network_stats
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for live updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.bitcoin_network_stats;