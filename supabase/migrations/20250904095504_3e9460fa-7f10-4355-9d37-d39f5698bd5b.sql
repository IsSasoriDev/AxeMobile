-- Add user_id column to miners table and update RLS policies
ALTER TABLE public.miners ADD COLUMN user_id UUID REFERENCES auth.users(id);

-- Update the existing RLS policy to check user_id properly
DROP POLICY IF EXISTS "Users can manage their own miners" ON public.miners;

CREATE POLICY "Users can manage their own miners" 
ON public.miners 
FOR ALL 
USING (auth.uid() = user_id);

-- Also add user_id to miner_stats if not already present
ALTER TABLE public.miner_stats ADD COLUMN IF NOT EXISTS user_id UUID;

-- Update miner_stats RLS policy to use user_id from miners table or direct user_id
DROP POLICY IF EXISTS "Users can manage their own miner stats" ON public.miner_stats;

CREATE POLICY "Users can manage their own miner stats" 
ON public.miner_stats 
FOR ALL 
USING (
  auth.uid() = user_id OR 
  EXISTS (
    SELECT 1 FROM public.miners 
    WHERE miners.id = miner_stats.miner_id 
    AND miners.user_id = auth.uid()
  )
);