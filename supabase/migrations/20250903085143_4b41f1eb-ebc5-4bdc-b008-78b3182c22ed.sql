-- Fix RLS policies to require authentication instead of allowing public access

-- Update miners table RLS policy
DROP POLICY IF EXISTS "Allow all access to miners" ON public.miners;

CREATE POLICY "Users can manage their own miners" ON public.miners
FOR ALL USING (auth.uid() IS NOT NULL);

-- Update miner_stats table RLS policy  
DROP POLICY IF EXISTS "Allow all access to miner_stats" ON public.miner_stats;

CREATE POLICY "Users can manage their own miner stats" ON public.miner_stats
FOR ALL USING (auth.uid() IS NOT NULL);

-- Create tables for firmware updates functionality
CREATE TABLE IF NOT EXISTS public.firmware_releases (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  model TEXT NOT NULL,
  version TEXT NOT NULL,
  release_url TEXT,
  download_url TEXT,
  release_notes TEXT,
  is_latest BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.app_updates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  version TEXT NOT NULL,
  release_notes TEXT,
  download_url TEXT,
  is_latest BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on new tables
ALTER TABLE public.firmware_releases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_updates ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for new tables (public readable for firmware info)
CREATE POLICY "Firmware releases are publicly readable" ON public.firmware_releases
FOR SELECT USING (true);

CREATE POLICY "App updates are publicly readable" ON public.app_updates  
FOR SELECT USING (true);

-- Create update triggers
CREATE TRIGGER update_firmware_releases_updated_at
BEFORE UPDATE ON public.firmware_releases
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_app_updates_updated_at
BEFORE UPDATE ON public.app_updates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();