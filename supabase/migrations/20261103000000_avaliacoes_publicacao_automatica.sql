-- Avaliações de clientes: publicação automática.
-- Rode uma vez no SQL Editor do Supabase. Pode ser repetido sem problema.
--
-- O que muda:
--   * Avaliação nova já entra publicada (`aprovado` passa a ter padrão true). A coluna continua existindo
--     como "botão de esconder": para tirar uma avaliação do site, marque aprovado = false na linha.
--   * Qualquer visitante só LÊ avaliações com aprovado = true e só INSERE avaliações válidas
--     (nota 1 a 5, nome/cidade até 80 caracteres, comentário até 500). Ninguém altera nem apaga pelo site.
--   * `avaliacoes_resumo()` devolve total e média de todas as avaliações publicadas, para o site mostrar a
--     nota certa sem baixar todas as linhas.

-- 1) Tabela (só é criada se ainda não existir; se já existe, nada é alterado aqui).
CREATE TABLE IF NOT EXISTS public.avaliacoes (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  nome       TEXT NOT NULL,
  cidade     TEXT NOT NULL,
  nota       INTEGER NOT NULL,
  comentario TEXT NOT NULL,
  aprovado   BOOLEAN NOT NULL DEFAULT true
);

-- 2) Novas avaliações entram publicadas.
ALTER TABLE public.avaliacoes ALTER COLUMN aprovado SET DEFAULT true;
UPDATE public.avaliacoes SET aprovado = true WHERE aprovado IS NULL;

-- Opcional: publicar também as que ficaram "em análise" até hoje. Tire o "--" da linha abaixo se quiser.
-- UPDATE public.avaliacoes SET aprovado = true WHERE aprovado = false;

-- 3) Limites de conteúdo (NOT VALID: vale para as novas, não reprova linhas antigas).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'avaliacoes_conteudo_check' AND conrelid = 'public.avaliacoes'::regclass
  ) THEN
    ALTER TABLE public.avaliacoes ADD CONSTRAINT avaliacoes_conteudo_check CHECK (
      nota BETWEEN 1 AND 5
      AND char_length(btrim(nome)) BETWEEN 1 AND 80
      AND char_length(btrim(cidade)) BETWEEN 1 AND 80
      AND char_length(btrim(comentario)) BETWEEN 1 AND 500
    ) NOT VALID;
  END IF;
END $$;

-- 4) Índice para "as 6 mais recentes publicadas".
CREATE INDEX IF NOT EXISTS avaliacoes_aprovado_created_idx
  ON public.avaliacoes (aprovado, created_at DESC);

-- 5) Permissões (RLS): troca qualquer política antiga, que podia exigir aprovação manual, por estas duas.
ALTER TABLE public.avaliacoes ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE pol RECORD;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'avaliacoes' LOOP
    EXECUTE format('DROP POLICY %I ON public.avaliacoes', pol.policyname);
  END LOOP;
END $$;

CREATE POLICY avaliacoes_leitura_publica ON public.avaliacoes
  FOR SELECT TO anon, authenticated
  USING (aprovado = true);

CREATE POLICY avaliacoes_envio_publico ON public.avaliacoes
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    aprovado = true
    AND nota BETWEEN 1 AND 5
    AND char_length(btrim(nome)) BETWEEN 1 AND 80
    AND char_length(btrim(cidade)) BETWEEN 1 AND 80
    AND char_length(btrim(comentario)) BETWEEN 1 AND 500
  );

GRANT SELECT, INSERT ON public.avaliacoes TO anon, authenticated;
REVOKE UPDATE, DELETE ON public.avaliacoes FROM anon, authenticated;

-- 6) Total e média das publicadas, sem trazer as linhas.
CREATE OR REPLACE FUNCTION public.avaliacoes_resumo()
RETURNS TABLE (total BIGINT, media NUMERIC)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT count(*)::bigint, COALESCE(round(avg(nota)::numeric, 1), 0)
  FROM public.avaliacoes
  WHERE aprovado = true;
$$;

REVOKE ALL ON FUNCTION public.avaliacoes_resumo() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.avaliacoes_resumo() TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
