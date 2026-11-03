ALTER TABLE public.avaliacoes
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS moderated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS moderated_by TEXT,
  ADD COLUMN IF NOT EXISTS produto TEXT NOT NULL DEFAULT 'Avaliação geral';

UPDATE public.avaliacoes
SET status = CASE WHEN aprovado IS TRUE THEN 'approved' ELSE 'pending' END
WHERE status = 'pending';

ALTER TABLE public.avaliacoes
  DROP CONSTRAINT IF EXISTS avaliacoes_status_check;
ALTER TABLE public.avaliacoes
  ADD CONSTRAINT avaliacoes_status_check
  CHECK (status IN ('pending', 'approved', 'rejected'));

ALTER TABLE public.avaliacoes ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE policy_name TEXT;
BEGIN
  FOR policy_name IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'avaliacoes'
      AND cmd IN ('SELECT', 'ALL')
      AND roles && ARRAY['public', 'anon', 'authenticated']::name[]
  LOOP
    EXECUTE format('DROP POLICY %I ON public.avaliacoes', policy_name);
  END LOOP;
END;
$$;
CREATE POLICY "Public can read approved reviews"
  ON public.avaliacoes
  FOR SELECT
  TO anon, authenticated
  USING (status = 'approved');

REVOKE INSERT, UPDATE, DELETE ON public.avaliacoes FROM anon, authenticated;
GRANT SELECT ON public.avaliacoes TO anon, authenticated;
GRANT ALL ON public.avaliacoes TO service_role;

CREATE OR REPLACE VIEW public.approved_review_summary
WITH (security_invoker = true)
AS
SELECT COUNT(*)::BIGINT AS review_count, COALESCE(AVG(nota), 0)::NUMERIC(3,2) AS average_rating
FROM public.avaliacoes
WHERE status = 'approved';

REVOKE ALL ON public.approved_review_summary FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.approved_review_summary TO service_role;

CREATE INDEX IF NOT EXISTS avaliacoes_status_created_at_idx
  ON public.avaliacoes (status, created_at DESC);

NOTIFY pgrst, 'reload schema';
