CREATE TABLE IF NOT EXISTS public.pipeline_alert_state (
  alert_key text PRIMARY KEY,
  agent_name text NOT NULL,
  week_start date,
  started_at timestamptz,
  kind text NOT NULL,
  notified_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.pipeline_alert_state TO service_role;

ALTER TABLE public.pipeline_alert_state ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "No client access to pipeline alert state" ON public.pipeline_alert_state;
CREATE POLICY "No client access to pipeline alert state"
  ON public.pipeline_alert_state FOR ALL TO authenticated, anon
  USING (false) WITH CHECK (false);

CREATE INDEX IF NOT EXISTS pipeline_alert_state_notified_at_idx
  ON public.pipeline_alert_state (notified_at DESC);

SELECT cron.unschedule('pipeline-run-alerts')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'pipeline-run-alerts');

SELECT cron.schedule(
  'pipeline-run-alerts',
  '*/15 * * * *',
  $job$
  SELECT net.http_post(
    url := 'https://domidata.heatherdomi.com/api/public/pipeline-alerts',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-export-secret', (SELECT token FROM public.export_job_token WHERE id = true)
    ),
    body := '{}'::jsonb
  );
  $job$
);