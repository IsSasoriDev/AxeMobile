-- Enable public access to influx_instances table
-- Create public policy for influx_instances
CREATE POLICY "InfluxDB instances are publicly accessible" 
ON public.influx_instances 
FOR ALL 
USING (true);