ALTER TABLE public.quarterly_brief_publish_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.quarterly_brief_publish_log FROM anon, authenticated;
GRANT ALL ON public.quarterly_brief_publish_log TO service_role;