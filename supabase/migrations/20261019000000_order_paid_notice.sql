-- Marca quando o aviso de "pagamento aprovado" (e-mail ao cliente e WhatsApp à loja) já foi disparado.
-- Assim, se o Mercado Pago repetir a notificação, o aviso sai uma única vez e nunca se perde.
ALTER TABLE public.store_orders
  ADD COLUMN IF NOT EXISTS paid_notified_at TIMESTAMPTZ;

-- Pedidos já aprovados antes desta migração não devem receber o aviso de novo.
UPDATE public.store_orders
SET paid_notified_at = updated_at
WHERE status = 'approved' AND paid_notified_at IS NULL;

NOTIFY pgrst, 'reload schema';
