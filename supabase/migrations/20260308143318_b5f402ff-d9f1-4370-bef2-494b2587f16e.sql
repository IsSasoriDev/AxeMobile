-- Add image_url column to announcements
ALTER TABLE public.announcements ADD COLUMN image_url text;

-- Create storage bucket for announcement images
INSERT INTO storage.buckets (id, name, public) VALUES ('announcement-images', 'announcement-images', true);

-- Allow anyone to read announcement images
CREATE POLICY "Anyone can view announcement images"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'announcement-images');

-- Only admins can upload announcement images
CREATE POLICY "Admins can upload announcement images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'announcement-images'
  AND (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
);

-- Only admins can delete announcement images
CREATE POLICY "Admins can delete announcement images"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'announcement-images'
  AND (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
);