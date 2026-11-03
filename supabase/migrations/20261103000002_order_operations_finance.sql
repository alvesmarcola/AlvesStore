ALTER TABLE public.store_orders
  ADD COLUMN IF NOT EXISTS operational_status TEXT,
  ADD COLUMN IF NOT EXISTS supplier_name TEXT,
  ADD COLUMN IF NOT EXISTS supplier_status TEXT,
  ADD COLUMN IF NOT EXISTS supplier_ordered_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS supplier_cost_cents INTEGER,
  ADD COLUMN IF NOT EXISTS shipping_cost_cents INTEGER,
  ADD COLUMN IF NOT EXISTS other_expenses_cents INTEGER,
  ADD COLUMN IF NOT EXISTS internal_notes TEXT,
  ADD COLUMN IF NOT EXISTS tracking_url TEXT,
  ADD COLUMN IF NOT EXISTS shipped_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS payment_method_id TEXT,
  ADD COLUMN IF NOT EXISTS payment_type_id TEXT;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.store_orders'::regclass AND conname = 'store_orders_operational_status_check') THEN
    ALTER TABLE public.store_orders
      ADD CONSTRAINT store_orders_operational_status_check
      CHECK (operational_status IS NULL OR operational_status IN (
        'aguardando_pagamento', 'pagamento_aprovado', 'aguardando_fornecedor',
        'pedido_realizado', 'em_preparacao', 'enviado', 'cancelado'
      ));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.store_orders'::regclass AND conname = 'store_orders_supplier_status_check') THEN
    ALTER TABLE public.store_orders
      ADD CONSTRAINT store_orders_supplier_status_check
      CHECK (supplier_status IS NULL OR supplier_status IN (
        'nao_solicitado', 'solicitado', 'confirmado', 'em_preparacao', 'recebido', 'cancelado'
      ));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.store_orders'::regclass AND conname = 'store_orders_supplier_cost_cents_check') THEN
    ALTER TABLE public.store_orders
      ADD CONSTRAINT store_orders_supplier_cost_cents_check
      CHECK (supplier_cost_cents IS NULL OR supplier_cost_cents >= 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.store_orders'::regclass AND conname = 'store_orders_shipping_cost_cents_check') THEN
    ALTER TABLE public.store_orders
      ADD CONSTRAINT store_orders_shipping_cost_cents_check
      CHECK (shipping_cost_cents IS NULL OR shipping_cost_cents >= 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.store_orders'::regclass AND conname = 'store_orders_other_expenses_cents_check') THEN
    ALTER TABLE public.store_orders
      ADD CONSTRAINT store_orders_other_expenses_cents_check
      CHECK (other_expenses_cents IS NULL OR other_expenses_cents >= 0);
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS store_orders_operational_status_idx
  ON public.store_orders (operational_status, created_at DESC);
CREATE INDEX IF NOT EXISTS store_orders_supplier_name_idx
  ON public.store_orders (supplier_name)
  WHERE supplier_name IS NOT NULL;

CREATE OR REPLACE FUNCTION public.find_store_order_tracking_details(p_prefix TEXT, p_email TEXT, p_cpf TEXT)
RETURNS TABLE(
  id UUID,
  status TEXT,
  operational_status TEXT,
  tracking_code TEXT,
  tracking_url TEXT,
  shipping JSONB,
  created_at TIMESTAMPTZ
)
LANGUAGE SQL
SET search_path = pg_catalog, public
AS $$
  SELECT orders.id, orders.status, orders.operational_status, orders.tracking_code,
    orders.tracking_url, orders.shipping, orders.created_at
  FROM public.store_orders AS orders
  WHERE orders.id::TEXT LIKE lower(p_prefix) || '%'
    AND (
      lower(orders.customer ->> 'email') = lower(p_email)
      OR regexp_replace(orders.customer ->> 'cpf', '[^0-9]', '', 'g') = p_cpf
    )
  LIMIT 2;
$$;

REVOKE ALL ON FUNCTION public.find_store_order_tracking_details(TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.find_store_order_tracking_details(TEXT, TEXT, TEXT) TO service_role;

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS brand TEXT NOT NULL DEFAULT '';

CREATE TABLE IF NOT EXISTS public.admin_product_supplier_details (
  product_id TEXT PRIMARY KEY REFERENCES public.products(id) ON DELETE CASCADE,
  supplier_name TEXT NOT NULL DEFAULT '',
  supplier_cost NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (supplier_cost >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_product_supplier_details ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.admin_product_supplier_details FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.admin_product_supplier_details TO service_role;
CREATE INDEX IF NOT EXISTS admin_product_supplier_details_name_idx
  ON public.admin_product_supplier_details (supplier_name)
  WHERE supplier_name <> '';

CREATE OR REPLACE VIEW public.store_order_admin_metrics
WITH (security_invoker = true)
AS
SELECT
  COUNT(*)::BIGINT AS order_count,
  COUNT(*) FILTER (WHERE status IN ('pago', 'enviado', 'approved') OR mercado_pago_status = 'approved')::BIGINT AS paid_order_count,
  COUNT(*) FILTER (
    WHERE operational_status = 'aguardando_fornecedor'
      OR (operational_status IS NULL AND (status IN ('pago', 'approved') OR mercado_pago_status = 'approved'))
  )::BIGINT AS awaiting_supplier_count,
  COUNT(*) FILTER (WHERE operational_status = 'enviado' OR status = 'enviado')::BIGINT AS shipped_order_count,
  COALESCE(SUM(total_cents) FILTER (WHERE status IN ('pago', 'enviado', 'approved') OR mercado_pago_status = 'approved'), 0)::BIGINT AS revenue_cents,
  COALESCE(SUM(supplier_cost_cents) FILTER (WHERE status IN ('pago', 'enviado', 'approved') OR mercado_pago_status = 'approved'), 0)::BIGINT AS supplier_cost_cents,
  COALESCE(SUM(shipping_cost_cents) FILTER (WHERE status IN ('pago', 'enviado', 'approved') OR mercado_pago_status = 'approved'), 0)::BIGINT AS shipping_cost_cents,
  COALESCE(SUM(other_expenses_cents) FILTER (WHERE status IN ('pago', 'enviado', 'approved') OR mercado_pago_status = 'approved'), 0)::BIGINT AS other_expenses_cents
FROM public.store_orders;

REVOKE ALL ON public.store_order_admin_metrics FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.store_order_admin_metrics TO service_role;

NOTIFY pgrst, 'reload schema';
