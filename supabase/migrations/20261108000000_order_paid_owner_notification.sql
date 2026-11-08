-- ==============================================================================
-- MIGRAÇÃO: 20261108000000_order_paid_owner_notification.sql
-- DESCRIÇÃO:
-- 1. Amplia CHECK de event_name para aceitar 'order_paid_owner'
-- 2. Amplia CHECK de status para aceitar 'failed' (interrupção de retentativas automáticas)
-- 3. Mantém a constraint de unicidade existente: UNIQUE (order_id, event_name, channel)
-- 4. Substitui complete_store_order_notification por versão única com p_max_attempts,
--    garantindo colunas reais (sent_at, lease_until, last_error, attempt_count),
--    reset de lease_until, filtro WHERE status = 'processing' e segurança service_role.
-- ==============================================================================

-- 1. Ampliar CHECK constraint de event_name para aceitar 'order_paid_owner'
ALTER TABLE public.store_order_notification_outbox
  DROP CONSTRAINT IF EXISTS store_order_notification_outbox_event_name_check;

ALTER TABLE public.store_order_notification_outbox
  ADD CONSTRAINT store_order_notification_outbox_event_name_check
  CHECK (event_name IN ('order_paid', 'order_paid_owner'));

-- 2. Ampliar CHECK constraint de status para aceitar 'failed'
ALTER TABLE public.store_order_notification_outbox
  DROP CONSTRAINT IF EXISTS store_order_notification_outbox_status_check;

ALTER TABLE public.store_order_notification_outbox
  ADD CONSTRAINT store_order_notification_outbox_status_check
  CHECK (status IN ('pending', 'processing', 'sent', 'failed'));

-- 3. Substituir a função existente sem criar sobrecargas (garante assinatura única)
DROP FUNCTION IF EXISTS public.complete_store_order_notification(UUID, BOOLEAN, TEXT, INTEGER);
DROP FUNCTION IF EXISTS public.complete_store_order_notification(UUID, BOOLEAN, TEXT, INTEGER, INTEGER);

CREATE OR REPLACE FUNCTION public.complete_store_order_notification(
  p_notification_id UUID,
  p_succeeded BOOLEAN,
  p_error TEXT DEFAULT NULL,
  p_retry_seconds INTEGER DEFAULT 300,
  p_max_attempts INTEGER DEFAULT 5
)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  WITH completed AS (
    UPDATE public.store_order_notification_outbox
    SET status = CASE
          WHEN p_succeeded THEN 'sent'
          WHEN attempt_count >= p_max_attempts THEN 'failed'
          ELSE 'pending'
        END,
        available_at = CASE
          WHEN p_succeeded THEN available_at
          WHEN attempt_count >= p_max_attempts THEN available_at
          ELSE NOW() + MAKE_INTERVAL(secs => LEAST(GREATEST(COALESCE(p_retry_seconds, 300), 60), 21600))
        END,
        lease_until = NULL,
        last_error = CASE
          WHEN p_succeeded THEN NULL
          ELSE LEFT(COALESCE(p_error, 'Delivery failed'), 500)
        END,
        sent_at = CASE
          WHEN p_succeeded THEN NOW()
          ELSE sent_at
        END,
        updated_at = NOW()
    WHERE id = p_notification_id AND status = 'processing'
    RETURNING 1
  )
  SELECT EXISTS (SELECT 1 FROM completed);
$$;

-- 4. Permissões estritas: revoga acesso de anon/authenticated e concede apenas a service_role
REVOKE ALL ON FUNCTION public.complete_store_order_notification(UUID, BOOLEAN, TEXT, INTEGER, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_store_order_notification(UUID, BOOLEAN, TEXT, INTEGER, INTEGER) TO service_role;

-- 5. Notificar PostgREST para recarregar o schema
NOTIFY pgrst, 'reload schema';

-- ==============================================================================
-- INSTRUÇÕES DE ROLLBACK:
-- Execute o bloco abaixo caso deseje reverter a migração para o estado anterior:
--
-- ALTER TABLE public.store_order_notification_outbox
--   DROP CONSTRAINT IF EXISTS store_order_notification_outbox_event_name_check;
--
-- ALTER TABLE public.store_order_notification_outbox
--   ADD CONSTRAINT store_order_notification_outbox_event_name_check
--   CHECK (event_name = 'order_paid');
--
-- ALTER TABLE public.store_order_notification_outbox
--   DROP CONSTRAINT IF EXISTS store_order_notification_outbox_status_check;
--
-- ALTER TABLE public.store_order_notification_outbox
--   ADD CONSTRAINT store_order_notification_outbox_status_check
--   CHECK (status IN ('pending', 'processing', 'sent'));
--
-- DROP FUNCTION IF EXISTS public.complete_store_order_notification(UUID, BOOLEAN, TEXT, INTEGER, INTEGER);
--
-- CREATE OR REPLACE FUNCTION public.complete_store_order_notification(
--   p_notification_id UUID,
--   p_succeeded BOOLEAN,
--   p_error TEXT DEFAULT NULL,
--   p_retry_seconds INTEGER DEFAULT 300
-- )
-- RETURNS BOOLEAN
-- LANGUAGE sql
-- SECURITY DEFINER
-- SET search_path = pg_catalog, public
-- AS $$
--   WITH completed AS (
--     UPDATE public.store_order_notification_outbox
--     SET status = CASE WHEN p_succeeded THEN 'sent' ELSE 'pending' END,
--         available_at = CASE
--           WHEN p_succeeded THEN available_at
--           ELSE NOW() + MAKE_INTERVAL(secs => LEAST(GREATEST(COALESCE(p_retry_seconds, 300), 60), 21600))
--         END,
--         lease_until = NULL,
--         last_error = CASE WHEN p_succeeded THEN NULL ELSE LEFT(COALESCE(p_error, 'Delivery failed'), 500) END,
--         sent_at = CASE WHEN p_succeeded THEN NOW() ELSE sent_at END,
--         updated_at = NOW()
--     WHERE id = p_notification_id AND status = 'processing'
--     RETURNING 1
--   )
--   SELECT EXISTS (SELECT 1 FROM completed);
-- $$;
--
-- REVOKE ALL ON FUNCTION public.complete_store_order_notification(UUID, BOOLEAN, TEXT, INTEGER) FROM PUBLIC, anon, authenticated;
-- GRANT EXECUTE ON FUNCTION public.complete_store_order_notification(UUID, BOOLEAN, TEXT, INTEGER) TO service_role;
--
-- NOTIFY pgrst, 'reload schema';
-- ==============================================================================
