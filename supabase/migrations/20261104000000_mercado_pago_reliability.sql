ALTER TABLE public.store_orders
  ADD COLUMN IF NOT EXISTS payment_reconciliation_attempts INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payment_reconciliation_after TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE INDEX IF NOT EXISTS store_orders_payment_reconciliation_idx
  ON public.store_orders (payment_reconciliation_after, created_at)
  WHERE status = 'pending';

CREATE TABLE IF NOT EXISTS public.store_order_notification_outbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.store_orders(id) ON DELETE CASCADE,
  event_name TEXT NOT NULL CHECK (event_name = 'order_paid'),
  channel TEXT NOT NULL CHECK (channel IN ('email', 'whatsapp')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'sent')),
  attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  available_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  lease_until TIMESTAMPTZ,
  last_error TEXT,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (order_id, event_name, channel)
);

CREATE INDEX IF NOT EXISTS store_order_notification_outbox_ready_idx
  ON public.store_order_notification_outbox (available_at, created_at)
  WHERE status IN ('pending', 'processing');

ALTER TABLE public.store_order_notification_outbox ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.store_order_notification_outbox FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.store_order_notification_outbox TO service_role;

CREATE OR REPLACE FUNCTION public.prepare_store_order(
  p_id UUID,
  p_idempotency_key UUID,
  p_request_hash CHAR(64),
  p_item_lines JSONB,
  p_customer JSONB,
  p_shipping JSONB,
  p_shirt_quantity INTEGER,
  p_shirts_cents INTEGER,
  p_customization_cents INTEGER,
  p_patches_cents INTEGER,
  p_shipping_cents INTEGER,
  p_total_cents INTEGER
)
RETURNS TABLE(order_id UUID, saved_request_hash CHAR(64), checkout_url TEXT, order_status TEXT, is_new BOOLEAN)
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
  existing_order public.store_orders%ROWTYPE;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(p_idempotency_key::TEXT, 0));
  SELECT * INTO existing_order
  FROM public.store_orders AS orders
  WHERE orders.idempotency_key = p_idempotency_key
  FOR UPDATE;

  IF FOUND THEN
    RETURN QUERY SELECT existing_order.id, existing_order.request_hash, existing_order.checkout_url, existing_order.status, FALSE;
    RETURN;
  END IF;

  INSERT INTO public.store_orders (
    id, idempotency_key, request_hash, item_lines, customer, shipping,
    shirt_quantity, shirts_cents, customization_cents, patches_cents, shipping_cents, total_cents,
    operational_status
  ) VALUES (
    p_id, p_idempotency_key, p_request_hash, p_item_lines, p_customer, p_shipping,
    p_shirt_quantity, p_shirts_cents, p_customization_cents, p_patches_cents, p_shipping_cents, p_total_cents,
    'aguardando_pagamento'
  );

  RETURN QUERY SELECT p_id, p_request_hash, NULL::TEXT, 'pending'::TEXT, TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION public.claim_store_order_notifications(
  p_limit INTEGER DEFAULT 20,
  p_order_id UUID DEFAULT NULL
)
RETURNS TABLE(notification_id UUID, order_id UUID, event_name TEXT, channel TEXT, attempt_count INTEGER)
LANGUAGE SQL
SET search_path = pg_catalog, public
AS $$
  WITH candidates AS (
    SELECT outbox.id
    FROM public.store_order_notification_outbox AS outbox
    WHERE (
      (outbox.status = 'pending' AND outbox.available_at <= NOW())
      OR (outbox.status = 'processing' AND outbox.lease_until <= NOW())
    )
      AND (p_order_id IS NULL OR outbox.order_id = p_order_id)
    ORDER BY outbox.available_at, outbox.created_at
    LIMIT LEAST(GREATEST(COALESCE(p_limit, 20), 1), 50)
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.store_order_notification_outbox AS outbox
  SET status = 'processing',
      attempt_count = outbox.attempt_count + 1,
      lease_until = NOW() + INTERVAL '2 minutes',
      updated_at = NOW()
  FROM candidates
  WHERE outbox.id = candidates.id
  RETURNING outbox.id, outbox.order_id, outbox.event_name, outbox.channel, outbox.attempt_count;
$$;

CREATE OR REPLACE FUNCTION public.complete_store_order_notification(
  p_notification_id UUID,
  p_succeeded BOOLEAN,
  p_error TEXT DEFAULT NULL,
  p_retry_seconds INTEGER DEFAULT 300
)
RETURNS BOOLEAN
LANGUAGE SQL
SET search_path = pg_catalog, public
AS $$
  WITH completed AS (
    UPDATE public.store_order_notification_outbox
    SET status = CASE WHEN p_succeeded THEN 'sent' ELSE 'pending' END,
        available_at = CASE
          WHEN p_succeeded THEN available_at
          ELSE NOW() + MAKE_INTERVAL(secs => LEAST(GREATEST(COALESCE(p_retry_seconds, 300), 60), 21600))
        END,
        lease_until = NULL,
        last_error = CASE WHEN p_succeeded THEN NULL ELSE LEFT(COALESCE(p_error, 'Delivery failed'), 500) END,
        sent_at = CASE WHEN p_succeeded THEN NOW() ELSE sent_at END,
        updated_at = NOW()
    WHERE id = p_notification_id AND status = 'processing'
    RETURNING 1
  )
  SELECT EXISTS (SELECT 1 FROM completed);
$$;

CREATE OR REPLACE FUNCTION public.claim_store_orders_for_payment_reconciliation(p_limit INTEGER DEFAULT 10)
RETURNS TABLE(order_id UUID, attempt_count INTEGER)
LANGUAGE SQL
SET search_path = pg_catalog, public
AS $$
  WITH candidates AS (
    SELECT orders.id
    FROM public.store_orders AS orders
    WHERE orders.status = 'pending'
      AND orders.payment_reconciliation_after <= NOW()
    ORDER BY orders.payment_reconciliation_after, orders.created_at
    LIMIT LEAST(GREATEST(COALESCE(p_limit, 10), 1), 25)
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.store_orders AS orders
  SET payment_reconciliation_attempts = orders.payment_reconciliation_attempts + 1,
      payment_reconciliation_after = NOW() + MAKE_INTERVAL(secs =>
        CASE
          WHEN orders.payment_reconciliation_attempts = 0 THEN 300
          WHEN orders.payment_reconciliation_attempts = 1 THEN 600
          WHEN orders.payment_reconciliation_attempts = 2 THEN 1200
          WHEN orders.payment_reconciliation_attempts = 3 THEN 2400
          ELSE 21600
        END
      ),
      updated_at = NOW()
  FROM candidates
  WHERE orders.id = candidates.id
  RETURNING orders.id, orders.payment_reconciliation_attempts;
$$;

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
  total_cents INTEGER
)
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
  current_order public.store_orders%ROWTYPE;
  affected_rows INTEGER;
  previous_order_status TEXT;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(p_order_id::TEXT, 0));
  SELECT * INTO current_order
  FROM public.store_orders AS orders
  WHERE orders.id = p_order_id
  FOR UPDATE;

  IF NOT FOUND OR current_order.total_cents <> p_amount_cents THEN
    RETURN QUERY SELECT FALSE, NULL::TEXT, NULL::TEXT, NULL::JSONB, NULL::JSONB, NULL::INTEGER, NULL::INTEGER;
    RETURN;
  END IF;
  previous_order_status := current_order.status;

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
    RETURN QUERY SELECT FALSE, NULL::TEXT, NULL::TEXT, NULL::JSONB, NULL::JSONB, NULL::INTEGER, NULL::INTEGER;
    RETURN;
  END IF;

  UPDATE public.store_orders AS orders
  SET status = CASE
      WHEN EXISTS (
        SELECT 1 FROM public.store_order_payments AS payments
        WHERE payments.order_id = p_order_id AND payments.status = 'approved'
      ) THEN CASE
        WHEN current_order.status IN ('enviado', 'approved') THEN current_order.status
        ELSE 'pago'
      END
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

  IF p_status = 'approved' THEN
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
    current_order.item_lines, current_order.shipping_cents, current_order.total_cents;
END;
$$;

REVOKE ALL ON FUNCTION public.prepare_store_order(UUID, UUID, CHAR, JSONB, JSONB, JSONB, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.apply_store_payment(TEXT, UUID, TEXT, INTEGER, TEXT, BOOLEAN) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.claim_store_order_notifications(INTEGER, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.complete_store_order_notification(UUID, BOOLEAN, TEXT, INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.claim_store_orders_for_payment_reconciliation(INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.prepare_store_order(UUID, UUID, CHAR, JSONB, JSONB, JSONB, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.apply_store_payment(TEXT, UUID, TEXT, INTEGER, TEXT, BOOLEAN) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_store_order_notifications(INTEGER, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.complete_store_order_notification(UUID, BOOLEAN, TEXT, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_store_orders_for_payment_reconciliation(INTEGER) TO service_role;

NOTIFY pgrst, 'reload schema';
