-- Migração 20261105000003_admin_product_deletion_and_audit.sql
-- 1. Tabela de log de auditoria administrativa
CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  acao TEXT NOT NULL,
  entidade TEXT NOT NULL,
  entidade_id TEXT NOT NULL,
  resumo JSONB DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS admin_audit_log_entidade_idx ON public.admin_audit_log (entidade, entidade_id);
CREATE INDEX IF NOT EXISTS admin_audit_log_created_at_idx ON public.admin_audit_log (created_at DESC);

ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.admin_audit_log FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.admin_audit_log TO service_role;

-- 2. Função segura para verificar se um produto possui pedidos associados
CREATE OR REPLACE FUNCTION public.count_product_orders(p_product_id TEXT, p_slug TEXT)
RETURNS INTEGER
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT COUNT(DISTINCT orders.id)::INTEGER
  FROM public.store_orders AS orders,
       jsonb_array_elements(orders.item_lines) AS item
  WHERE item->>'productId' = p_product_id
     OR item->>'slug' = p_slug;
$$;

REVOKE ALL ON FUNCTION public.count_product_orders(TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.count_product_orders(TEXT, TEXT) TO service_role;

NOTIFY pgrst, 'reload schema';

