ALTER TABLE public.store_orders
  ADD COLUMN IF NOT EXISTS promo TEXT,
  ADD COLUMN IF NOT EXISTS valor_desconto NUMERIC(10, 2) NOT NULL DEFAULT 0;

ALTER TABLE public.store_orders
  DROP CONSTRAINT IF EXISTS store_orders_valor_desconto_check;

ALTER TABLE public.store_orders
  ADD CONSTRAINT store_orders_valor_desconto_check CHECK (valor_desconto >= 0);

CREATE INDEX IF NOT EXISTS store_orders_promo_idx
  ON public.store_orders (promo, created_at DESC)
  WHERE promo IS NOT NULL;

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
  COALESCE(SUM(other_expenses_cents) FILTER (WHERE status IN ('pago', 'enviado', 'approved') OR mercado_pago_status = 'approved'), 0)::BIGINT AS other_expenses_cents,
  COUNT(*) FILTER (WHERE promo = 'BF-NBA-2026')::BIGINT AS promo_order_count,
  COALESCE(ROUND(SUM(valor_desconto) FILTER (WHERE promo = 'BF-NBA-2026') * 100), 0)::BIGINT AS promo_discount_cents,
  COALESCE(SUM(total_cents) FILTER (
    WHERE promo = 'BF-NBA-2026'
      AND (status IN ('pago', 'enviado', 'approved') OR mercado_pago_status = 'approved')
  ), 0)::BIGINT AS promo_revenue_cents
FROM public.store_orders;

NOTIFY pgrst, 'reload schema';
