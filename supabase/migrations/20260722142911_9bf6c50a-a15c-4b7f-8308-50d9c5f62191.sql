
ALTER TABLE public.agent_sessions
  ADD COLUMN IF NOT EXISTS token_total bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS idle_closed_at timestamptz NULL;

CREATE TABLE IF NOT EXISTS public.agent_lead_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_session_id uuid NOT NULL,
  ip text,
  tier text NOT NULL CHECK (tier IN ('soft','hard')),
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz NULL,
  lead_submission_id uuid NULL
);

GRANT ALL ON public.agent_lead_requests TO service_role;
ALTER TABLE public.agent_lead_requests ENABLE ROW LEVEL SECURITY;
