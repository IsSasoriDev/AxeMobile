
-- Fix blog_posts: restrict writes to admin role only
DROP POLICY "Authenticated users can insert blog posts" ON public.blog_posts;
DROP POLICY "Authenticated users can update blog posts" ON public.blog_posts;
DROP POLICY "Authenticated users can delete blog posts" ON public.blog_posts;

CREATE POLICY "Admins can insert blog posts" ON public.blog_posts
  FOR INSERT TO authenticated
  WITH CHECK (((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text);

CREATE POLICY "Admins can update blog posts" ON public.blog_posts
  FOR UPDATE TO authenticated
  USING (((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text)
  WITH CHECK (((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text);

CREATE POLICY "Admins can delete blog posts" ON public.blog_posts
  FOR DELETE TO authenticated
  USING (((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text);

-- Fix pool_config: restrict update to admin only
DROP POLICY "Service can update pool config" ON public.pool_config;

CREATE POLICY "Admins can update pool config" ON public.pool_config
  FOR UPDATE TO authenticated
  USING (((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text)
  WITH CHECK (((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text);

-- Fix pool_history: restrict insert to service_role (remove public insert)
DROP POLICY "Service can insert pool history" ON public.pool_history;

CREATE POLICY "Service can insert pool history" ON public.pool_history
  FOR INSERT TO service_role
  WITH CHECK (true);

-- Fix pool_blocks: restrict insert to service_role
DROP POLICY "Service can insert pool blocks" ON public.pool_blocks;

CREATE POLICY "Service can insert pool blocks" ON public.pool_blocks
  FOR INSERT TO service_role
  WITH CHECK (true);

-- Fix pool_miners: restrict insert/update to service_role
DROP POLICY "Service can insert pool miners" ON public.pool_miners;
DROP POLICY "Service can update pool miners" ON public.pool_miners;

CREATE POLICY "Service can insert pool miners" ON public.pool_miners
  FOR INSERT TO service_role
  WITH CHECK (true);

CREATE POLICY "Service can update pool miners" ON public.pool_miners
  FOR UPDATE TO service_role
  USING (true);
