-- relatorios/verificar-migracoes.sql
-- APENAS CONSULTAS DE LEITURA. Cole no SQL Editor do Supabase.
-- Nenhum comando de escrita (INSERT/UPDATE/DELETE/ALTER/CREATE/DROP) esta presente.

-- 1) Historico de migracoes registrado pelo Supabase (se a tabela existir)
SELECT version, name, inserted_at
FROM supabase_migrations.schema_migrations
ORDER BY version;

-- 2) Tabelas novas criadas pelas migracoes
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('store_orders','store_order_payments','admin_product_supplier_details','store_order_notification_outbox','payment_events','admin_audit_log','avaliacoes','products')
ORDER BY table_name;

-- 3) Colunas novas criadas pelas migracoes
SELECT table_name, column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND (
    (table_name = 'products' AND column_name IN ('description','stock_by_size','brand','tem_variacao_uniforme','oculto')) OR
    (table_name = 'store_orders' AND column_name IN ('mercado_pago_status','mercado_pago_id','paid_notified_at','operational_status','supplier_name','supplier_status','supplier_ordered_at','supplier_cost_cents','shipping_cost_cents','other_expenses_cents','internal_notes','tracking_url','shipped_at','payment_method_id','payment_type_id','payment_reconciliation_attempts','payment_reconciliation_after','promo','valor_desconto')) OR
    (table_name = 'avaliacoes' AND column_name IN ('status','moderated_at','moderated_by','produto'))
  )
ORDER BY table_name, column_name;

-- 4) Constraints CHECK de status em store_orders (confirma versao aplicada)
SELECT conname, pg_get_constraintdef(oid) AS definicao
FROM pg_constraint
WHERE conrelid = 'public.store_orders'::regclass
  AND contype = 'c'
ORDER BY conname;

-- 5) Constraints de products
SELECT conname, pg_get_constraintdef(oid) AS definicao
FROM pg_constraint
WHERE conrelid = 'public.products'::regclass
  AND contype = 'c'
ORDER BY conname;

-- 6) Funcoes (RPC) relevantes e suas assinaturas
SELECT p.proname AS funcao,
       pg_get_function_identity_arguments(p.oid) AS argumentos,
       pg_get_function_result(p.oid) AS retorno
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN (
    'prepare_store_order','apply_store_payment','find_store_order_for_tracking',
    'find_store_order_tracking_details','claim_store_order_notifications',
    'complete_store_order_notification','claim_store_orders_for_payment_reconciliation',
    'count_product_orders'
  )
ORDER BY p.proname;

-- 7) Politicas RLS das tabelas principais
SELECT schemaname, tablename, policyname, cmd, roles, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('store_orders','store_order_payments','products','admin_product_supplier_details','payment_events','admin_audit_log','avaliacoes','store_order_notification_outbox')
ORDER BY tablename, policyname;

-- 8) Views expostas
SELECT table_name AS view_name
FROM information_schema.views
WHERE table_schema = 'public'
  AND table_name IN ('store_order_admin_metrics','approved_review_summary')
ORDER BY table_name;
