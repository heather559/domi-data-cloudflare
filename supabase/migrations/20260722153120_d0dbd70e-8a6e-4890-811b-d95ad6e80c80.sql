ALTER TABLE public.lead_submissions
  ADD COLUMN IF NOT EXISTS transcript jsonb,
  ADD COLUMN IF NOT EXISTS client_session_id uuid,
  ADD COLUMN IF NOT EXISTS tier text;