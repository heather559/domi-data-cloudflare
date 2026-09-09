CREATE OR REPLACE FUNCTION public.canonical_bed_label(raw text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN raw IS NULL THEN NULL
    WHEN lower(btrim(raw)) IN ('studio','studios','0br','0-bed','0 bed','0 bedroom','studio apartment') THEN 'Studio'
    WHEN regexp_replace(lower(btrim(raw)), '[^0-9+]', '', 'g') IN ('1') THEN '1-Bed'
    WHEN regexp_replace(lower(btrim(raw)), '[^0-9+]', '', 'g') IN ('2') THEN '2-Bed'
    WHEN regexp_replace(lower(btrim(raw)), '[^0-9+]', '', 'g') IN ('3') THEN '3-Bed'
    WHEN regexp_replace(lower(btrim(raw)), '[^0-9+]', '', 'g') IN ('4','4+','+4') THEN '4+ Beds'
    WHEN lower(btrim(raw)) LIKE 'one%' THEN '1-Bed'
    WHEN lower(btrim(raw)) LIKE 'two%' THEN '2-Bed'
    WHEN lower(btrim(raw)) LIKE 'three%' THEN '3-Bed'
    WHEN lower(btrim(raw)) LIKE 'four%' THEN '4+ Beds'
    ELSE btrim(raw)
  END
$$;

CREATE OR REPLACE FUNCTION public.bed_label_sort_index(label text)
RETURNS int
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE public.canonical_bed_label(label)
    WHEN 'Studio'  THEN 0
    WHEN '1-Bed'   THEN 1
    WHEN '2-Bed'   THEN 2
    WHEN '3-Bed'   THEN 3
    WHEN '4+ Beds' THEN 4
    ELSE 5
  END
$$;

CREATE OR REPLACE FUNCTION public.normalize_bed_series(series jsonb)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN series IS NULL OR jsonb_typeof(series) <> 'array' THEN series
    ELSE COALESCE(
      (
        SELECT jsonb_agg(
                 e || jsonb_build_object('label', public.canonical_bed_label(e->>'label'))
                 ORDER BY public.bed_label_sort_index(e->>'label'),
                          public.canonical_bed_label(e->>'label')
               )
        FROM jsonb_array_elements(series) e
        WHERE jsonb_typeof(e) = 'object'
      ),
      series
    )
  END
$$;

CREATE OR REPLACE FUNCTION public.normalize_report_bed_labels(payload jsonb)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN payload IS NULL
      OR jsonb_typeof(payload) <> 'object'
      OR jsonb_typeof(COALESCE(payload->'bedroomMix', 'null'::jsonb)) <> 'object'
    THEN payload
    ELSE jsonb_set(
      payload,
      '{bedroomMix}',
      (payload->'bedroomMix')
        || jsonb_build_object('volumeData', public.normalize_bed_series(payload->'bedroomMix'->'volumeData'))
        || jsonb_build_object('countData',  public.normalize_bed_series(payload->'bedroomMix'->'countData'))
    )
  END
$$;

UPDATE public.neighborhood_monthly_report
SET payload = public.normalize_report_bed_labels(payload)
WHERE payload IS NOT NULL
  AND payload ? 'bedroomMix'
  AND payload <> public.normalize_report_bed_labels(payload);

CREATE OR REPLACE FUNCTION public.tg_normalize_report_bed_labels()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.payload := public.normalize_report_bed_labels(NEW.payload);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS normalize_bed_labels ON public.neighborhood_monthly_report;
CREATE TRIGGER normalize_bed_labels
BEFORE INSERT OR UPDATE ON public.neighborhood_monthly_report
FOR EACH ROW EXECUTE FUNCTION public.tg_normalize_report_bed_labels();