UPDATE public.weekly_report
SET payload = jsonb_set(
  jsonb_set(
    jsonb_set(
      payload,
      '{weekly_activity_leaderboard}',
      '[
        {"rank":1,"name":"flatiron","wk_contracts":2,"wk_volume":31945000,"largest_rank":null,"concentrated_rank":5},
        {"rank":2,"name":"lenox hill","wk_contracts":2,"wk_volume":17450000,"largest_rank":5,"concentrated_rank":null},
        {"rank":3,"name":"soho","wk_contracts":2,"wk_volume":15270000,"largest_rank":9,"concentrated_rank":2},
        {"rank":4,"name":"upper west side","wk_contracts":1,"wk_volume":9950000,"largest_rank":4,"concentrated_rank":null},
        {"rank":5,"name":"nomad","wk_contracts":1,"wk_volume":9200000,"largest_rank":null,"concentrated_rank":6},
        {"rank":6,"name":"chelsea","wk_contracts":1,"wk_volume":8595000,"largest_rank":null,"concentrated_rank":null},
        {"rank":7,"name":"carnegie hill","wk_contracts":1,"wk_volume":5850000,"largest_rank":null,"concentrated_rank":8},
        {"rank":8,"name":"lincoln square","wk_contracts":1,"wk_volume":5500000,"largest_rank":6,"concentrated_rank":null},
        {"rank":9,"name":"tribeca","wk_contracts":1,"wk_volume":5095000,"largest_rank":7,"concentrated_rank":1}
      ]'::jsonb
    ),
    '{hero}',
    (payload->'hero')
      || jsonb_build_object(
        'luxury_volume', 108855000,
        'prime_volume', 87135000,
        'median_price', 8547500,
        'luxury_volume_wow_pct', -47.3215,
        'luxury_volume_vs_lastweek_pct', -44.5307,
        'luxury_volume_yoy_pct', -23.5005
      )
  ),
  '{tier_series}',
  (
    SELECT jsonb_agg(
      CASE WHEN e->>'week_start' = '2026-08-10'
        THEN jsonb_set(jsonb_set(e, '{luxury,volume}', '21.72'::jsonb), '{prime,volume}', '63.185'::jsonb)
        ELSE e END
      ORDER BY ord
    )
    FROM jsonb_array_elements(payload->'tier_series') WITH ORDINALITY AS t(e, ord)
  )
)
WHERE week_start = '2026-08-10';