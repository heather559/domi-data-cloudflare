CREATE TABLE public.export_job_token (
  id boolean PRIMARY KEY DEFAULT true,
  label text NOT NULL DEFAULT 'weekly-export',
  token text NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT export_job_token_singleton CHECK (id)
);

GRANT ALL ON public.export_job_token TO service_role;

ALTER TABLE public.export_job_token ENABLE ROW LEVEL SECURITY;

INSERT INTO public.export_job_token (id) VALUES (true) ON CONFLICT (id) DO NOTHING;