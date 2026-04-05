-- Make miners table work without authentication
-- Remove user_id requirement and make RLS policies public

-- Drop existing RLS policies for miners
DROP POLICY IF EXISTS "Users can manage their own miners" ON public.miners;

-- Create new public policy for miners
CREATE POLICY "Miners are publicly accessible" 
ON public.miners 
FOR ALL 
USING (true);

-- Drop existing RLS policies for miner_stats
DROP POLICY IF EXISTS "Users can manage their own miner stats" ON public.miner_stats;

-- Create new public policy for miner_stats
CREATE POLICY "Miner stats are publicly accessible" 
ON public.miner_stats 
FOR ALL 
USING (true);

-- Make user_id nullable in miners table (it might already be)
ALTER TABLE public.miners ALTER COLUMN user_id DROP NOT NULL;

-- Make user_id nullable in miner_stats table (it might already be)
ALTER TABLE public.miner_stats ALTER COLUMN user_id DROP NOT NULL;