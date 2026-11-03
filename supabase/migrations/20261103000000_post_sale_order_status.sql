ALTER TABLE public.store_orders
  DROP CONSTRAINT IF EXISTS store_orders_status_check;

ALTER TABLE public.store_orders
  ADD CONSTRAINT store_orders_status_check
  CHECK (status IN ('pending', 'pago', 'enviado', 'approved', 'rejected', 'cancelled', 'refunded'));

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

  RETURN QUERY SELECT TRUE, previous_order_status, current_order.status, current_order.customer,
    current_order.item_lines, current_order.shipping_cents, current_order.total_cents;
END;
$$;

REVOKE ALL ON FUNCTION public.apply_store_payment(TEXT, UUID, TEXT, INTEGER, TEXT, BOOLEAN) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_store_payment(TEXT, UUID, TEXT, INTEGER, TEXT, BOOLEAN) TO service_role;

NOTIFY pgrst, 'reload schema';
