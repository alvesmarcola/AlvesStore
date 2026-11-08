-- Migration: 20261107000001_review_photos_storage.sql
-- Objetivo: Suporte a 1 foto opcional em avaliações com bucket privado no Supabase Storage.
-- Nenhuma coluna existente é removida e nenhum dado é apagado.
--
-- ============================================================================
-- INSTRUÇÕES DE ROLLBACK:
-- ============================================================================
-- Para reverter esta migração sem perder as avaliações existentes:
-- 1. DROP POLICY IF EXISTS "Service role access on avaliacoes bucket" ON storage.objects;
-- 2. DELETE FROM storage.buckets WHERE id = 'avaliacoes';
-- 3. ALTER TABLE public.avaliacoes DROP COLUMN IF EXISTS imagem_path;
-- 4. NOTIFY pgrst, 'reload schema';
-- ============================================================================

-- 1. Adicionar coluna imagem_path na tabela public.avaliacoes (nula por padrão)
ALTER TABLE public.avaliacoes
  ADD COLUMN IF NOT EXISTS imagem_path TEXT DEFAULT NULL;

-- 2. Garantir que a coluna produto existe (retrocompatibilidade segura)
ALTER TABLE public.avaliacoes
  ADD COLUMN IF NOT EXISTS produto TEXT NOT NULL DEFAULT 'Avaliação geral';

-- 3. Criar ou atualizar o bucket de Storage 'avaliacoes' (privado, limite 512KB, tipos JPEG, PNG, WEBP)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avaliacoes',
  'avaliacoes',
  false,
  524288, -- 512 KB
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = 524288,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp'];

-- 4. Políticas de RLS para storage.objects no bucket 'avaliacoes'
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'storage' AND tablename = 'objects') THEN
    ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
  END IF;
END;
$$;

-- 5. Atualizar view pública de resumo para continuar íntegra
CREATE OR REPLACE VIEW public.approved_review_summary
WITH (security_invoker = true)
AS
SELECT COUNT(*)::BIGINT AS review_count, COALESCE(AVG(nota), 0)::NUMERIC(3,2) AS average_rating
FROM public.avaliacoes
WHERE status = 'approved';

REVOKE ALL ON public.approved_review_summary FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.approved_review_summary TO service_role;

-- 6. Recarregar esquema do PostgREST
NOTIFY pgrst, 'reload schema';
