CREATE TABLE public.monthly_report_archive (
  month_start date NOT NULL PRIMARY KEY,
  month_end date NOT NULL,
  payload jsonb NOT NULL,
  archived_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT ON public.monthly_report_archive TO authenticated;
GRANT ALL ON public.monthly_report_archive TO service_role;

ALTER TABLE public.monthly_report_archive ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read the monthly archive"
  ON public.monthly_report_archive FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));