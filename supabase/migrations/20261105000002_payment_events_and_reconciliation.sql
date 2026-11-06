-- Migração 20261105000002_payment_events_and_reconciliation.sql
-- 1. Controle de visibilidade de produtos (oculto / ativo)
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS oculto BOOLEAN NOT NULL DEFAULT false;

-- Oculta produto teste existente sem apagá-lo
UPDATE public.products
SET oculto = true
WHERE slug = 'teste' OR nome ILIKE '%teste%';

-- 2. Tabela de auditoria de eventos de pagamento (payment_events)
CREATE TABLE IF NOT EXISTS public.payment_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id TEXT NOT NULL,
  order_id UUID REFERENCES public.store_orders(id) ON DELETE SET NULL,
  topic TEXT,
  action TEXT,
  status TEXT NOT NULL,
  payload JSONB DEFAULT '{}'::JSONB,
  is_orphan BOOLEAN NOT NULL DEFAULT FALSE,
  is_divergent BOOLEAN NOT NULL DEFAULT FALSE,
  processed BOOLEAN NOT NULL DEFAULT FALSE,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS payment_events_payment_id_idx ON public.payment_events(payment_id);
CREATE INDEX IF NOT EXISTS payment_events_order_id_idx ON public.payment_events(order_id);
CREATE INDEX IF NOT EXISTS payment_events_created_at_idx ON public.payment_events(created_at DESC);
CREATE INDEX IF NOT EXISTS payment_events_orphan_idx ON public.payment_events(is_orphan) WHERE is_orphan = true;
CREATE INDEX IF NOT EXISTS payment_events_divergent_idx ON public.payment_events(is_divergent) WHERE is_divergent = true;

ALTER TABLE public.payment_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.payment_events FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.payment_events TO service_role;

-- 3. Atualização das constraints de status de pedidos para aceitar divergências e recusas
ALTER TABLE public.store_orders
  DROP CONSTRAINT IF EXISTS store_orders_status_check;

ALTER TABLE public.store_orders
  ADD CONSTRAINT store_orders_status_check
  CHECK (status IN (
    'pending', 'pago', 'enviado', 'approved', 'rejected',
    'cancelled', 'refunded', 'divergencia_pagamento',
    'pagamento_recusado', 'reembolsado', 'contestado', 'expirado'
  ));

ALTER TABLE public.store_orders
  DROP CONSTRAINT IF EXISTS store_orders_operational_status_check;

ALTER TABLE public.store_orders
  ADD CONSTRAINT store_orders_operational_status_check
  CHECK (operational_status IN (
    'aguardando_pagamento', 'pagamento_aprovado', 'aguardando_fornecedor',
    'pedido_realizado', 'em_preparacao', 'enviado', 'cancelado',
    'divergencia_pagamento', 'expirado'
  ));

-- 4. Função atualizada de aplicação de pagamento com suporte a divergência e auditoria
CREATE OR REPLACE FUNCTION public.apply_store_payment(
  p_payment_id TEXT,
  p_order_id UUID,
  p_status TEXT,
  p_amount_cents INTEGER,
  p_currency TEXT,
  p_live_mode BOOLEAN
)
RETURNS TABLE(
  applied BOOLEAN,
  previous_status TEXT,
  order_status TEXT,
  customer JSONB,
  item_lines JSONB,
  shipping_cents INTEGER,
  total_cents INTEGER,
  is_divergent BOOLEAN
)
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
  current_order public.store_orders%ROWTYPE;
  affected_rows INTEGER;
  previous_order_status TEXT;
  has_divergence BOOLEAN := FALSE;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(p_order_id::TEXT, 0));
  SELECT * INTO current_order
  FROM public.store_orders AS orders
  WHERE orders.id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, NULL::TEXT, NULL::TEXT, NULL::JSONB, NULL::JSONB, NULL::INTEGER, NULL::INTEGER, FALSE;
    RETURN;
  END IF;

  previous_order_status := current_order.status;

  -- Se o valor pago divergir do total registrado no pedido
  IF current_order.total_cents <> p_amount_cents THEN
    has_divergence := TRUE;

    UPDATE public.store_orders AS orders
    SET operational_status = 'divergencia_pagamento',
        status = 'divergencia_pagamento',
        updated_at = NOW()
    WHERE orders.id = p_order_id
    RETURNING * INTO current_order;

    INSERT INTO public.store_order_payments AS existing_payment (
      payment_id, order_id, status, amount_cents, currency, live_mode
    ) VALUES (
      p_payment_id, p_order_id, 'divergent', p_amount_cents, p_currency, p_live_mode
    )
    ON CONFLICT (payment_id) DO UPDATE
      SET status = EXCLUDED.status,
          amount_cents = EXCLUDED.amount_cents,
          currency = EXCLUDED.currency,
          live_mode = EXCLUDED.live_mode,
          updated_at = NOW()
      WHERE existing_payment.order_id = EXCLUDED.order_id;

    RETURN QUERY SELECT FALSE, previous_order_status, current_order.status, current_order.customer,
      current_order.item_lines, current_order.shipping_cents, current_order.total_cents, TRUE;
    RETURN;
  END IF;

  -- Grava/atualiza o pagamento na tabela store_order_payments
  INSERT INTO public.store_order_payments AS existing_payment (
    payment_id, order_id, status, amount_cents, currency, live_mode
  ) VALUES (
    p_payment_id, p_order_id, p_status, p_amount_cents, p_currency, p_live_mode
  )
  ON CONFLICT (payment_id) DO UPDATE
    SET status = EXCLUDED.status,
        amount_cents = EXCLUDED.amount_cents,
        currency = EXCLUDED.currency,
        live_mode = EXCLUDED.live_mode,
        updated_at = NOW()
    WHERE existing_payment.order_id = EXCLUDED.order_id;
  GET DIAGNOSTICS affected_rows = ROW_COUNT;
  IF affected_rows <> 1 THEN
    RETURN QUERY SELECT FALSE, NULL::TEXT, NULL::TEXT, NULL::JSONB, NULL::JSONB, NULL::INTEGER, NULL::INTEGER, FALSE;
    RETURN;
  END IF;

  -- Atualiza o pedido garantindo não-regressão de pedidos já pagos/enviados
  UPDATE public.store_orders AS orders
  SET status = CASE
      WHEN current_order.status IN ('enviado', 'pago', 'approved') THEN current_order.status
      WHEN EXISTS (
        SELECT 1 FROM public.store_order_payments AS payments
        WHERE payments.order_id = p_order_id AND payments.status = 'approved'
      ) THEN 'pago'
      WHEN EXISTS (
        SELECT 1 FROM public.store_order_payments AS payments
        WHERE payments.order_id = p_order_id AND payments.status = 'pending'
      ) THEN 'pending'
      WHEN EXISTS (
        SELECT 1 FROM public.store_order_payments AS payments
        WHERE payments.order_id = p_order_id AND payments.status = 'refunded'
      ) THEN 'refunded'
      WHEN EXISTS (
        SELECT 1 FROM public.store_order_payments AS payments
        WHERE payments.order_id = p_order_id AND payments.status = 'rejected'
      ) THEN 'rejected'
      ELSE 'cancelled'
    END,
    updated_at = NOW()
  WHERE orders.id = p_order_id
  RETURNING * INTO current_order;

  -- Enfileira notificação de pedido pago apenas quando for aprovado pela primeira vez
  IF p_status = 'approved' AND previous_order_status NOT IN ('pago', 'enviado', 'approved') THEN
    INSERT INTO public.store_order_notification_outbox (order_id, event_name, channel)
    SELECT p_order_id, 'order_paid', 'email'
    WHERE NULLIF(BTRIM(current_order.customer ->> 'email'), '') IS NOT NULL
    UNION ALL
    SELECT p_order_id, 'order_paid', 'whatsapp'
    WHERE current_order.customer ->> 'whatsappUpdates' = 'true'
      AND LENGTH(REGEXP_REPLACE(COALESCE(current_order.customer ->> 'phone', ''), '[^0-9]', '', 'g')) >= 10
    ON CONFLICT (order_id, event_name, channel) DO NOTHING;
  END IF;

  RETURN QUERY SELECT TRUE, previous_order_status, current_order.status, current_order.customer,
    current_order.item_lines, current_order.shipping_cents, current_order.total_cents, FALSE;
END;
$$;

REVOKE ALL ON FUNCTION public.apply_store_payment(TEXT, UUID, TEXT, INTEGER, TEXT, BOOLEAN) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_store_payment(TEXT, UUID, TEXT, INTEGER, TEXT, BOOLEAN) TO service_role;

NOTIFY pgrst, 'reload schema';

