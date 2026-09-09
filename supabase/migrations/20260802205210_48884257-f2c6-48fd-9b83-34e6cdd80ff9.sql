CREATE TABLE public.bedroom_label_anomalies (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  source_table text NOT NULL DEFAULT 'neighborhood_monthly_report',
  neighborhood_slug text,
  period text,
  series text NOT NULL,
  raw_label text NOT NULL,
  occurrences integer NOT NULL DEFAULT 1,
  first_seen_at timestamp with time zone NOT NULL DEFAULT now(),
  last_seen_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (source_table, neighborhood_slug, period, series, raw_label)
);

GRANT ALL ON public.bedroom_label_anomalies TO service_role;

ALTER TABLE public.bedroom_label_anomalies ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_canonical_bed_label(raw text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT public.canonical_bed_label(raw) IN ('Studio','1-Bed','2-Bed','3-Bed','4+ Beds')
$$;

CREATE OR REPLACE FUNCTION public.tg_normalize_report_bed_labels()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  s text;
  elem jsonb;
BEGIN
  IF NEW.payload IS NOT NULL AND jsonb_typeof(COALESCE(NEW.payload->'bedroomMix','null'::jsonb)) = 'object' THEN
    FOREACH s IN ARRAY ARRAY['volumeData','countData'] LOOP
      IF jsonb_typeof(COALESCE(NEW.payload->'bedroomMix'->s,'null'::jsonb)) = 'array' THEN
        FOR elem IN SELECT * FROM jsonb_array_elements(NEW.payload->'bedroomMix'->s) LOOP
          IF jsonb_typeof(elem) = 'object'
             AND elem->>'label' IS NOT NULL
             AND NOT public.is_canonical_bed_label(elem->>'label') THEN
            INSERT INTO public.bedroom_label_anomalies
              (source_table, neighborhood_slug, period, series, raw_label)
            VALUES
              ('neighborhood_monthly_report', NEW.neighborhood_slug, NEW.period, s, elem->>'label')
            ON CONFLICT (source_table, neighborhood_slug, period, series, raw_label)
            DO UPDATE SET occurrences = public.bedroom_label_anomalies.occurrences + 1,
                          last_seen_at = now();
          END IF;
        END LOOP;
      END IF;
    END LOOP;
  END IF;

  NEW.payload := public.normalize_report_bed_labels(NEW.payload);
  RETURN NEW;
END;
$$;

INSERT INTO public.bedroom_label_anomalies
  (source_table, neighborhood_slug, period, series, raw_label)
SELECT 'neighborhood_monthly_report', r.neighborhood_slug, r.period, s.series, e->>'label'
FROM public.neighborhood_monthly_report r
CROSS JOIN LATERAL (VALUES ('volumeData'),('countData')) AS s(series)
CROSS JOIN LATERAL jsonb_array_elements(
  CASE WHEN jsonb_typeof(COALESCE(r.payload->'bedroomMix'->s.series,'null'::jsonb)) = 'array'
       THEN r.payload->'bedroomMix'->s.series ELSE '[]'::jsonb END
) e
WHERE jsonb_typeof(e) = 'object'
  AND e->>'label' IS NOT NULL
  AND NOT public.is_canonical_bed_label(e->>'label')
ON CONFLICT (source_table, neighborhood_slug, period, series, raw_label) DO NOTHING;