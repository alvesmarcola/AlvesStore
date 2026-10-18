ALTER TABLE public.store_orders
  ADD COLUMN IF NOT EXISTS mercado_pago_status TEXT,
  ADD COLUMN IF NOT EXISTS mercado_pago_id TEXT;

CREATE INDEX IF NOT EXISTS store_orders_mercado_pago_id_idx
  ON public.store_orders (mercado_pago_id)
  WHERE mercado_pago_id IS NOT NULL;

NOTIFY pgrst, 'reload schema';
