SELECT cron.schedule(
  'weekly-signed-contract-reconciliation',
  '20 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://domidata.heatherdomi.com/api/public/weekly-reconciliation?weeks=8',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-export-secret', (SELECT token FROM public.export_job_token WHERE id = true)
    ),
    body := '{}'::jsonb
  );
  $$
);