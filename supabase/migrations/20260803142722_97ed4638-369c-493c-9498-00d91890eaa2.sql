-- Explicit, admin-only access control on the private "exports" bucket.
-- Backend export jobs use the service role (bypasses RLS) and hand out
-- short-lived signed URLs, so these policies do not affect them.

DROP POLICY IF EXISTS "Admins can read export files" ON storage.objects;
DROP POLICY IF EXISTS "Admins can upload export files" ON storage.objects;
DROP POLICY IF EXISTS "Admins can update export files" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete export files" ON storage.objects;

CREATE POLICY "Admins can read export files"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'exports' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can upload export files"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'exports' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update export files"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'exports' AND public.has_role(auth.uid(), 'admin'))
  WITH CHECK (bucket_id = 'exports' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete export files"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'exports' AND public.has_role(auth.uid(), 'admin'));