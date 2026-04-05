
-- Drop restrictive policies
DROP POLICY IF EXISTS "Allow all operations for authenticated requests" ON public.blog_posts;
DROP POLICY IF EXISTS "Anyone can read published blog posts" ON public.blog_posts;

-- Create permissive policies
CREATE POLICY "Anyone can read published blog posts"
ON public.blog_posts FOR SELECT
USING (published = true);

CREATE POLICY "Authenticated users can insert blog posts"
ON public.blog_posts FOR INSERT TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update blog posts"
ON public.blog_posts FOR UPDATE TO authenticated
USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can delete blog posts"
ON public.blog_posts FOR DELETE TO authenticated
USING (true);

-- Fix storage: ensure RLS policies allow authenticated uploads
DROP POLICY IF EXISTS "Allow authenticated uploads" ON storage.objects;
CREATE POLICY "Allow authenticated uploads"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'blog-images');

DROP POLICY IF EXISTS "Allow public read blog images" ON storage.objects;
CREATE POLICY "Allow public read blog images"
ON storage.objects FOR SELECT
USING (bucket_id = 'blog-images');
