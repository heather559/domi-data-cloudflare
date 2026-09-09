UPDATE public.weekly_report_archive a
SET payload = w.payload,
    week_end = w.week_end,
    archived_at = now()
FROM public.weekly_report w
WHERE w.week_start = a.week_start
  AND a.week_start = '2026-07-20';