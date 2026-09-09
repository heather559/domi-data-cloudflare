CREATE TABLE IF NOT EXISTS public.export_job_state (
  job text PRIMARY KEY,
  last_weekly_period text,
  last_weekly_sent_at timestamptz,
  last_weekly_path text,
  last_monthly_period text,
  last_monthly_sent_at timestamptz,
  last_monthly_path text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.export_job_state TO service_role;

ALTER TABLE public.export_job_state ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "No client access to export job state" ON public.export_job_state;
CREATE POLICY "No client access to export job state"
  ON public.export_job_state FOR ALL TO authenticated, anon
  USING (false) WITH CHECK (false);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$
LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS update_export_job_state_updated_at ON public.export_job_state;
CREATE TRIGGER update_export_job_state_updated_at
  BEFORE UPDATE ON public.export_job_state
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

SELECT cron.unschedule('monthly-tracker-export')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'monthly-tracker-export');

SELECT cron.schedule(
  'monthly-tracker-export',
  '15 11 * * 1',
  $job$
  SELECT net.http_post(
    url := 'https://domidata.heatherdomi.com/api/public/monthly-export',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-export-secret', (SELECT token FROM public.export_job_token WHERE id = true)
    ),
    body := '{}'::jsonb
  );
  $job$
);