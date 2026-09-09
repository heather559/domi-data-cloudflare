INSERT INTO public.monthly_report_archive (month_start, month_end, payload, archived_at)
SELECT month_start, month_end, payload, now()
FROM public.monthly_report
ORDER BY month_start DESC
LIMIT 1
ON CONFLICT (month_start) DO UPDATE
SET month_end = EXCLUDED.month_end,
    payload = EXCLUDED.payload,
    archived_at = now();