ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS tem_variacao_uniforme BOOLEAN NOT NULL DEFAULT false;

NOTIFY pgrst, 'reload schema';

