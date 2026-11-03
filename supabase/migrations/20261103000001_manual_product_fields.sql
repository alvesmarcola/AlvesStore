ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS description TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS stock_by_size JSONB NOT NULL DEFAULT '{}'::JSONB;

ALTER TABLE public.products
  DROP CONSTRAINT IF EXISTS products_tipo_check;

ALTER TABLE public.products
  ADD CONSTRAINT products_tipo_check
  CHECK (tipo IN ('torcedor', 'jogador', 'goleiro', 'retro', 'treino', 'cropped', 'regata', 'inverno', 'vestido', 'f1', 'revisar'));

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.products'::regclass
      AND conname = 'products_stock_by_size_object_check'
  ) THEN
    ALTER TABLE public.products
      ADD CONSTRAINT products_stock_by_size_object_check
      CHECK (jsonb_typeof(stock_by_size) = 'object');
  END IF;
END;
$$;

NOTIFY pgrst, 'reload schema';
