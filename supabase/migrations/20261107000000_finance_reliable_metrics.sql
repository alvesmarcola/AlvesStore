-- ==============================================================================
-- Migração: 20261107000000_finance_reliable_metrics.sql
-- Propósito: Adicionar suporte a pedidos de teste, taxas reais do Mercado Pago,
--            reembolsos/estornos parciais e recálculo confiável do Financeiro.
-- Idempotência: Todas as alterações utilizam IF NOT EXISTS / OR REPLACE.
--
-- INSTRUÇÕES DE ROLLBACK:
--   DROP VIEW IF EXISTS public.store_order_admin_metrics;
--   -- (Recriar a view conforme 20261105000000_black_friday_nba.sql se necessário)
--   ALTER TABLE public.store_orders DROP COLUMN IF EXISTS is_test;
--   ALTER TABLE public.store_orders DROP COLUMN IF EXISTS payment_fee_cents;
--   ALTER TABLE public.store_orders DROP COLUMN IF EXISTS refunded_cents;
--   DROP INDEX IF EXISTS public.store_orders_is_test_idx;
--   NOTIFY pgrst, 'reload schema';
-- ==============================================================================

-- 1. Colunas adicionais em store_orders para controle financeiro e testes
ALTER TABLE public.store_orders
  ADD COLUMN IF NOT EXISTS is_test BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS payment_fee_cents INTEGER DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS refunded_cents INTEGER NOT NULL DEFAULT 0;

-- 2. Índice para consultas rápidas excluindo pedidos de teste
CREATE INDEX IF NOT EXISTS store_orders_is_test_idx
  ON public.store_orders (is_test, created_at DESC);

-- 3. Marcar o pedido de teste de R$ 1,50 (21CF6548) como teste retroativo
UPDATE public.store_orders
SET is_test = TRUE
WHERE id::TEXT ILIKE '%21cf6548%';

-- 4. Atualizar a View de Métricas Administrativas
--    - Exclui pedidos de teste (is_test = FALSE)
--    - Desconta reembolsos (refunded_cents) da receita líquida
--    - Inclui soma das taxas reais do provedor (payment_fee_cents)
CREATE OR REPLACE VIEW public.store_order_admin_metrics
WITH (security_invoker = true)
AS
SELECT
  COUNT(*)::BIGINT AS order_count,
  COUNT(*) FILTER (
    WHERE (status IN ('pago', 'enviado', 'approved') OR mercado_pago_status = 'approved')
      AND status NOT IN ('refunded', 'reembolsado', 'charged_back')
      AND mercado_pago_status NOT IN ('refunded', 'charged_back')
  )::BIGINT AS paid_order_count,
  COUNT(*) FILTER (
    WHERE operational_status = 'aguardando_fornecedor'
      OR (operational_status IS NULL AND (status IN ('pago', 'approved') OR mercado_pago_status = 'approved'))
  )::BIGINT AS awaiting_supplier_count,
  COUNT(*) FILTER (WHERE operational_status = 'enviado' OR status = 'enviado')::BIGINT AS shipped_order_count,
  COALESCE(SUM(GREATEST(0, total_cents - COALESCE(refunded_cents, 0))) FILTER (
    WHERE (status IN ('pago', 'enviado', 'approved') OR mercado_pago_status = 'approved')
      AND status NOT IN ('refunded', 'reembolsado', 'charged_back')
      AND mercado_pago_status NOT IN ('refunded', 'charged_back')
  ), 0)::BIGINT AS revenue_cents,
  COALESCE(SUM(supplier_cost_cents) FILTER (
    WHERE (status IN ('pago', 'enviado', 'approved') OR mercado_pago_status = 'approved')
      AND status NOT IN ('refunded', 'reembolsado', 'charged_back')
      AND mercado_pago_status NOT IN ('refunded', 'charged_back')
  ), 0)::BIGINT AS supplier_cost_cents,
  COALESCE(SUM(shipping_cost_cents) FILTER (
    WHERE (status IN ('pago', 'enviado', 'approved') OR mercado_pago_status = 'approved')
      AND status NOT IN ('refunded', 'reembolsado', 'charged_back')
      AND mercado_pago_status NOT IN ('refunded', 'charged_back')
  ), 0)::BIGINT AS shipping_cost_cents,
  COALESCE(SUM(other_expenses_cents) FILTER (
    WHERE (status IN ('pago', 'enviado', 'approved') OR mercado_pago_status = 'approved')
      AND status NOT IN ('refunded', 'reembolsado', 'charged_back')
      AND mercado_pago_status NOT IN ('refunded', 'charged_back')
  ), 0)::BIGINT AS other_expenses_cents,
  COALESCE(SUM(payment_fee_cents) FILTER (
    WHERE (status IN ('pago', 'enviado', 'approved') OR mercado_pago_status = 'approved')
      AND status NOT IN ('refunded', 'reembolsado', 'charged_back')
      AND mercado_pago_status NOT IN ('refunded', 'charged_back')
  ), 0)::BIGINT AS payment_fee_cents,
  COUNT(*) FILTER (WHERE promo = 'BF-NBA-2026')::BIGINT AS promo_order_count,
  COALESCE(ROUND(SUM(valor_desconto) FILTER (WHERE promo = 'BF-NBA-2026') * 100), 0)::BIGINT AS promo_discount_cents,
  COALESCE(SUM(GREATEST(0, total_cents - COALESCE(refunded_cents, 0))) FILTER (
    WHERE promo = 'BF-NBA-2026'
      AND (status IN ('pago', 'enviado', 'approved') OR mercado_pago_status = 'approved')
      AND status NOT IN ('refunded', 'reembolsado', 'charged_back')
      AND mercado_pago_status NOT IN ('refunded', 'charged_back')
  ), 0)::BIGINT AS promo_revenue_cents
FROM public.store_orders
WHERE is_test = FALSE;

REVOKE ALL ON public.store_order_admin_metrics FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.store_order_admin_metrics TO service_role;

NOTIFY pgrst, 'reload schema';
