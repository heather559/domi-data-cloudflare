
CREATE TABLE public.lead_submissions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  intent text NOT NULL,
  name text NOT NULL,
  email text NOT NULL,
  phone text,
  neighborhoods text[] NOT NULL DEFAULT '{}',
  price_range text,
  timeline text,
  reason text,
  message text,
  source_path text,
  user_agent text,
  referrer text
);

GRANT INSERT ON public.lead_submissions TO anon;
GRANT INSERT ON public.lead_submissions TO authenticated;
GRANT ALL ON public.lead_submissions TO service_role;

ALTER TABLE public.lead_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can submit a lead"
  ON public.lead_submissions
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    length(name) > 0 AND length(name) <= 200
    AND length(email) > 0 AND length(email) <= 320
    AND (message IS NULL OR length(message) <= 4000)
  );
