CREATE TABLE public.sowhat_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  neighborhood_slug text NOT NULL,
  block_key text NOT NULL,
  block_label text,
  sentence_snapshot text,
  note text NOT NULL,
  correction text,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','fixed','wontfix')),
  author text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.sowhat_notes TO service_role;

ALTER TABLE public.sowhat_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "No direct API access to sowhat_notes"
  ON public.sowhat_notes FOR SELECT USING (false);

CREATE INDEX sowhat_notes_slug_block_idx ON public.sowhat_notes (neighborhood_slug, block_key);
CREATE INDEX sowhat_notes_created_idx ON public.sowhat_notes (created_at DESC);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$
LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_sowhat_notes_updated_at
  BEFORE UPDATE ON public.sowhat_notes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();