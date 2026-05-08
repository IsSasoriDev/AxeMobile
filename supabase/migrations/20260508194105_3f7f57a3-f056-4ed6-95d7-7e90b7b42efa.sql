
-- Restrict blog-images bucket to admins for write/delete
DROP POLICY IF EXISTS "Allow authenticated uploads" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete blog images" ON storage.objects;
DROP POLICY IF EXISTS "Admins can upload blog images" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete blog images" ON storage.objects;
DROP POLICY IF EXISTS "Admins can update blog images" ON storage.objects;

CREATE POLICY "Admins can upload blog images"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'blog-images'
  AND ((auth.jwt() -> 'app_metadata') ->> 'role') = 'admin'
);

CREATE POLICY "Admins can update blog images"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'blog-images'
  AND ((auth.jwt() -> 'app_metadata') ->> 'role') = 'admin'
)
WITH CHECK (
  bucket_id = 'blog-images'
  AND ((auth.jwt() -> 'app_metadata') ->> 'role') = 'admin'
);

CREATE POLICY "Admins can delete blog images"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'blog-images'
  AND ((auth.jwt() -> 'app_metadata') ->> 'role') = 'admin'
);

-- Restrict reading unpublished blog posts to admins only
DROP POLICY IF EXISTS "Authenticated users can read all blog posts" ON public.blog_posts;

CREATE POLICY "Admins can read all blog posts"
ON public.blog_posts FOR SELECT TO authenticated
USING (((auth.jwt() -> 'app_metadata') ->> 'role') = 'admin');
