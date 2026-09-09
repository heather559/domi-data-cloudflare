UPDATE weekly_report
SET payload = jsonb_set(
  payload,
  '{top_deals}',
  (SELECT jsonb_agg(
     CASE WHEN d->>'address' LIKE '73 Wooster%'
          THEN (d - 'mls_id' - 'url_slug' - 'idx_url')
          ELSE d END)
   FROM jsonb_array_elements(payload->'top_deals') d)
)
WHERE week_start='2026-07-13';