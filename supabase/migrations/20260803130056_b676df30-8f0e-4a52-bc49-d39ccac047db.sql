CREATE TABLE public.weekly_reconciliation_flags (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  week_start DATE NOT NULL,
  check_name TEXT NOT NULL,
  hero_value NUMERIC,
  table_value NUMERIC,
  delta NUMERIC,
  severity TEXT NOT NULL DEFAULT 'warning',
  detail JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'open',
  resolved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (week_start, check_name)
);

GRANT SELECT, UPDATE ON public.weekly_reconciliation_flags TO authenticated;
GRANT ALL ON public.weekly_reconciliation_flags TO service_role;

ALTER TABLE public.weekly_reconciliation_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view reconciliation flags"
  ON public.weekly_reconciliation_flags FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update reconciliation flags"
  ON public.weekly_reconciliation_flags FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_weekly_reconciliation_flags_updated_at
  BEFORE UPDATE ON public.weekly_reconciliation_flags
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();