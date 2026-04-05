-- Create influx_instances table for InfluxDB configuration
CREATE TABLE public.influx_instances (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID,
  influx_url TEXT NOT NULL,
  token TEXT NOT NULL,
  bucket TEXT NOT NULL,
  org TEXT NOT NULL,
  measurement TEXT NOT NULL DEFAULT 'mainnet_stats',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.influx_instances ENABLE ROW LEVEL SECURITY;

-- Create public policy for influx_instances (since we removed auth)
CREATE POLICY "InfluxDB instances are publicly accessible" 
ON public.influx_instances 
FOR ALL 
USING (true);

-- Add update trigger
CREATE TRIGGER update_influx_instances_updated_at
BEFORE UPDATE ON public.influx_instances
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();