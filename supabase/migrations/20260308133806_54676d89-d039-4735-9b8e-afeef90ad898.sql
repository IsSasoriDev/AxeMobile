-- Allow authenticated users to insert announcements
CREATE POLICY "Authenticated users can create announcements"
ON public.announcements
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Allow authenticated users to update announcements
CREATE POLICY "Authenticated users can update announcements"
ON public.announcements
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- Allow authenticated users to delete announcements
CREATE POLICY "Authenticated users can delete announcements"
ON public.announcements
FOR DELETE
TO authenticated
USING (true);

-- Also allow authenticated users to read ALL announcements (not just active ones)
CREATE POLICY "Authenticated users can read all announcements"
ON public.announcements
FOR SELECT
TO authenticated
USING (true);