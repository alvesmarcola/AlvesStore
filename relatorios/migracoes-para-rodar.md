# Migrações pendentes para rodar no Supabase

Gerado em 2026-11-06. Baseado em leitura remota (somente GET) via `scripts/consulta/verificar-banco-remoto.ts`.

## Estado atual (resumo)

- Aplicadas (por evidência de colunas/tabelas/funções): 20261018, 20261019, 20261103 (todas), 20261104, 20261105000000, 20261105000001.
- Parcialmente aplicada: 20261017000000 (tabelas e funções principais existem, mas `find_store_order_for_tracking` não aparece; a versão mais nova `find_store_order_tracking_details` existe, então é compatível).
- NÃO aplicadas: 20261105000002 e 20261105000003.

## Ordem exata para rodar (uma por vez no SQL Editor)

1. `supabase/migrations/20261105000002_payment_events_and_reconciliation.sql`
2. `supabase/migrations/20261105000003_admin_product_deletion_and_audit.sql`

## Migração 1: 20261105000002_payment_events_and_reconciliation.sql

- O que faz (linguagem simples): adiciona a coluna `oculto` em `products` (controle de visibilidade), cria a tabela `payment_events` (auditoria de eventos do Mercado Pago), amplia as constraints de status de pedidos para aceitar divergências/recusas e reescreve a função `apply_store_payment` com suporte a divergência e retorno `is_divergent`. Também marca como oculto o produto com slug/nome "teste".
- Obrigatória para a exclusão? Não. A exclusão funciona sem ela (botão "Ocultar" fica indisponível com mensagem clara).
- Outras funções dependentes: webhook do Mercado Pago (divergência de pagamento), produtos ocultos na vitrine, promoções/Black Friday não dependem.
- Riscos: reescreve `apply_store_payment` (mudança de assinatura de retorno: adiciona `is_divergent`). Faz `UPDATE products SET oculto = true WHERE slug = 'teste' OR nome ILIKE '%teste%'`. Altera constraints de `store_orders` (status e operational_status).
- Idempotente? Parcialmente: usa `ADD COLUMN IF NOT EXISTS`, `CREATE TABLE IF NOT EXISTS`, `DROP CONSTRAINT IF EXISTS` + `ADD CONSTRAINT`. O `UPDATE` não é idempotente em efeito (repetir mantém oculto=true, sem dano). `CREATE OR REPLACE FUNCTION` é idempotente.
- Compatível com código em produção ANTES do deploy? A função nova retorna coluna extra `is_divergent`; código antigo que chama `apply_store_payment` e lê colunas por nome continua funcionando. A constraint mais ampla aceita todos os status antigos. O `UPDATE` do produto "teste" apenas o oculta; não apaga. Seguro.

## Migração 2: 20261105000003_admin_product_deletion_and_audit.sql

- O que faz: cria `admin_audit_log` (log administrativo) e a função `count_product_orders` (conta pedidos vinculados a um produto).
- Obrigatória para a exclusão? Não. O código faz fallback: conta pedidos direto em `store_orders` e, se `admin_audit_log` não existir, registra apenas aviso no log do servidor.
- Riscos: nenhum destrutivo. Apenas cria tabela/função. Não altera dados.
- Idempotente? Sim: `CREATE TABLE IF NOT EXISTS`, `CREATE OR REPLACE FUNCTION`.
- Compatível com código em produção ANTES do deploy? Sim. Apenas adiciona objetos; não muda assinaturas existentes.

## Risco de ordem

- As duas migrações pendentes têm prefixos de data distintos (20261105000002 e 20261105000003), sem colisão. Rodar fora de ordem (003 antes de 002) não quebra, mas siga a ordem numérica.
- A migração 002 deve vir antes da 003 se quiser o produto "teste" oculto antes da auditoria; não é bloqueante.

## Instruções seguras

1. Faça backup: no painel do Supabase, exporte as tabelas `products` e `store_orders` em CSV.
2. Abra o SQL Editor do Supabase.
3. Cole o conteúdo de UM arquivo por vez, na ordem acima.
4. Clique em "Run".
5. Se der erro, pare e me envie a mensagem exata. Não rode o próximo arquivo.
6. Após cada migração, rode o SELECT de verificação correspondente (abaixo).

## SELECT de verificação por migração

Migração 002:
```sql
SELECT column_name FROM information_schema.columns WHERE table_name='products' AND column_name='oculto';
SELECT to_regclass('public.payment_events');
SELECT conname FROM pg_constraint WHERE conrelid='public.store_orders'::regclass AND conname='store_orders_status_check';
```
Esperado: 1 linha para `oculto`, `payment_events` não nulo, constraint presente.

Migração 003:
```sql
SELECT to_regclass('public.admin_audit_log');
SELECT proname FROM pg_proc WHERE proname='count_product_orders';
```
Esperado: ambos não nulos.

## Se der erro

- "column already exists" / "relation already exists": a migração é parcialmente aplicada; rode apenas as partes faltantes ou ignore (IF NOT EXISTS protege a maioria).
- Erro em `apply_store_payment`: não rode manualmente; envie a mensagem. A função pode estar em uso por webhooks simultâneos.
- Qualquer erro de permissão: confirme que está usando o SQL Editor com a conta owner do projeto.
