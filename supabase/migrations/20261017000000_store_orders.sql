CREATE TABLE IF NOT EXISTS public.store_orders (
  id UUID PRIMARY KEY,
  idempotency_key UUID NOT NULL UNIQUE,
  request_hash CHAR(64) NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled', 'refunded')),
  preference_id TEXT UNIQUE,
  checkout_url TEXT,
  item_lines JSONB NOT NULL,
  customer JSONB NOT NULL,
  shipping JSONB NOT NULL,
  shirt_quantity INTEGER NOT NULL CHECK (shirt_quantity BETWEEN 1 AND 30),
  shirts_cents INTEGER NOT NULL CHECK (shirts_cents >= 0),
  customization_cents INTEGER NOT NULL CHECK (customization_cents >= 0),
  patches_cents INTEGER NOT NULL DEFAULT 0 CHECK (patches_cents >= 0),
  shipping_cents INTEGER NOT NULL CHECK (shipping_cents >= 0),
  total_cents INTEGER NOT NULL CHECK (total_cents >= 0),
  tracking_code TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.store_order_payments (
  payment_id TEXT PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES public.store_orders(id),
  status TEXT NOT NULL CHECK (status IN ('approved', 'pending', 'rejected', 'cancelled', 'refunded')),
  amount_cents INTEGER NOT NULL CHECK (amount_cents >= 0),
  currency TEXT NOT NULL,
  live_mode BOOLEAN NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS store_orders_created_at_idx ON public.store_orders (created_at DESC);
CREATE INDEX IF NOT EXISTS store_order_payments_order_id_idx ON public.store_order_payments (order_id);

ALTER TABLE public.store_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_order_payments ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.store_orders, public.store_order_payments FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.store_orders, public.store_order_payments TO service_role;

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
    shirt_quantity, shirts_cents, customization_cents, patches_cents, shipping_cents, total_cents
  ) VALUES (
    p_id, p_idempotency_key, p_request_hash, p_item_lines, p_customer, p_shipping,
    p_shirt_quantity, p_shirts_cents, p_customization_cents, p_patches_cents, p_shipping_cents, p_total_cents
  );

  RETURN QUERY SELECT p_id, p_request_hash, NULL::TEXT, 'pending'::TEXT, TRUE;
END;
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
  SELECT * INTO current_order FROM public.store_orders AS orders WHERE orders.id = p_order_id FOR UPDATE;
  IF NOT FOUND OR current_order.total_cents <> p_amount_cents THEN
    RETURN QUERY SELECT FALSE, NULL::TEXT, NULL::TEXT, NULL::JSONB, NULL::JSONB, NULL::INTEGER, NULL::INTEGER;
    RETURN;
  END IF;
  previous_order_status := current_order.status;

  INSERT INTO public.store_order_payments AS existing_payment (payment_id, order_id, status, amount_cents, currency, live_mode)
  VALUES (p_payment_id, p_order_id, p_status, p_amount_cents, p_currency, p_live_mode)
  ON CONFLICT (payment_id) DO UPDATE
    SET status = EXCLUDED.status, amount_cents = EXCLUDED.amount_cents,
        currency = EXCLUDED.currency, live_mode = EXCLUDED.live_mode, updated_at = NOW()
    WHERE existing_payment.order_id = EXCLUDED.order_id;
  GET DIAGNOSTICS affected_rows = ROW_COUNT;
  IF affected_rows <> 1 THEN
    RETURN QUERY SELECT FALSE, NULL::TEXT, NULL::TEXT, NULL::JSONB, NULL::JSONB, NULL::INTEGER, NULL::INTEGER;
    RETURN;
  END IF;

  UPDATE public.store_orders AS orders
  SET status = CASE
      WHEN EXISTS (SELECT 1 FROM public.store_order_payments AS payments WHERE payments.order_id = p_order_id AND payments.status = 'approved') THEN 'approved'
      WHEN EXISTS (SELECT 1 FROM public.store_order_payments AS payments WHERE payments.order_id = p_order_id AND payments.status = 'pending') THEN 'pending'
      WHEN EXISTS (SELECT 1 FROM public.store_order_payments AS payments WHERE payments.order_id = p_order_id AND payments.status = 'refunded') THEN 'refunded'
      WHEN EXISTS (SELECT 1 FROM public.store_order_payments AS payments WHERE payments.order_id = p_order_id AND payments.status = 'rejected') THEN 'rejected'
      ELSE 'cancelled'
    END,
    updated_at = NOW()
  WHERE orders.id = p_order_id
  RETURNING * INTO current_order;

  RETURN QUERY SELECT TRUE, previous_order_status, current_order.status, current_order.customer, current_order.item_lines, current_order.shipping_cents, current_order.total_cents;
END;
$$;

CREATE OR REPLACE FUNCTION public.find_store_order_for_tracking(p_prefix TEXT, p_email TEXT, p_cpf TEXT)
RETURNS TABLE(id UUID, status TEXT, tracking_code TEXT, shipping JSONB, created_at TIMESTAMPTZ)
LANGUAGE SQL
SET search_path = pg_catalog, public
AS $$
  SELECT orders.id, orders.status, orders.tracking_code, orders.shipping, orders.created_at
  FROM public.store_orders AS orders
  WHERE orders.id::TEXT LIKE lower(p_prefix) || '%'
    AND (
      lower(orders.customer ->> 'email') = lower(p_email)
      OR regexp_replace(orders.customer ->> 'cpf', '[^0-9]', '', 'g') = p_cpf
    )
  LIMIT 2;
$$;

REVOKE ALL ON FUNCTION public.prepare_store_order(UUID, UUID, CHAR, JSONB, JSONB, JSONB, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.apply_store_payment(TEXT, UUID, TEXT, INTEGER, TEXT, BOOLEAN) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.find_store_order_for_tracking(TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.prepare_store_order(UUID, UUID, CHAR, JSONB, JSONB, JSONB, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.apply_store_payment(TEXT, UUID, TEXT, INTEGER, TEXT, BOOLEAN) TO service_role;
GRANT EXECUTE ON FUNCTION public.find_store_order_for_tracking(TEXT, TEXT, TEXT) TO service_role;
