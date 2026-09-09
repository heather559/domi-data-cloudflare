CREATE TABLE public.service_audit_log (
  id BIGSERIAL PRIMARY KEY,
  ts TIMESTAMPTZ NOT NULL DEFAULT now(),
  actor TEXT NOT NULL,
  action TEXT NOT NULL,
  target_table TEXT,
  session_id TEXT,
  lead_id UUID,
  row_count INTEGER,
  outcome TEXT NOT NULL DEFAULT 'ok',
  error_code TEXT,
  error_message TEXT,
  ip_hash TEXT,
  meta JSONB
);

GRANT ALL ON public.service_audit_log TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.service_audit_log_id_seq TO service_role;

ALTER TABLE public.service_audit_log ENABLE ROW LEVEL SECURITY;

-- Intentionally no policies: fail-closed. Only the service role (server-side) reads/writes.

CREATE INDEX service_audit_log_ts_idx ON public.service_audit_log (ts DESC);
CREATE INDEX service_audit_log_actor_ts_idx ON public.service_audit_log (actor, ts DESC);
CREATE INDEX service_audit_log_session_idx ON public.service_audit_log (session_id) WHERE session_id IS NOT NULL;