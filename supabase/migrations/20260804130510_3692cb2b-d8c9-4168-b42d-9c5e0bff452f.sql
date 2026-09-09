CREATE OR REPLACE FUNCTION public.canonical_bed_label(raw text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN raw IS NULL THEN NULL
    WHEN lower(btrim(raw)) LIKE 'studio%' THEN 'Studio'
    WHEN lower(btrim(raw)) IN ('studios','0br','0-bed','0 bed','0 bedroom') THEN 'Studio'
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

DELETE FROM public.bedroom_label_anomalies
WHERE public.canonical_bed_label(raw_label) IN ('Studio','1-Bed','2-Bed','3-Bed','4+ Beds');

UPDATE public.sowhat_notes SET status = 'fixed'
WHERE status = 'open'
  AND ((neighborhood_slug = 'lincoln-square' AND block_key = 'rank')
    OR (neighborhood_slug = 'tribeca' AND block_key = 'unitMix'));