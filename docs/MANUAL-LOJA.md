# Manual Completo de Operação, Manutenção e Reconstrução — Imports Alves

> **Aviso de Confidencialidade e Segurança:** Este documento não contém chaves de API, senhas, tokens, telefones ou e-mails pessoais reais. Todos os exemplos utilizam dados puramente fictícios. Onde valores forem necessários, utilize o gerenciador de senhas seguro da empresa.

---

## 1. Visão Geral

### O que é o site e como funciona
A **Imports Alves** é um e-commerce especializado em camisas de futebol (clubes e seleções), regatas da NBA e camisas polo de Fórmula 1. A plataforma opera no modelo de catálogo híbrido (catálogo estático otimizado em JSON com extensão dinâmica em banco de dados Supabase), com checkout integrado via Mercado Pago (Checkout Pro e PIX transparente), controle operacional pós-venda, painel administrativo financeiro/logístico e disparo automatizado de notificações transacionais via E-mail (Resend) e WhatsApp (Webhook para automação).

### Diagrama de Conexões em Texto
```text
                   +-------------------------------------------------------+
                   |                 CLIENTE / NAVEGADOR                   |
                   +-------------------------------------------------------+
                                |                             ^
       1. Navega / Adiciona     |                             | 8. Recebe aviso
          ao Carrinho           |                             |    (WhatsApp/Email)
                                v                             |
                   +-------------------------------------------------------+
                   |           SITE IMPORTS ALVES (Next.js na Vercel)      |
                   +-------------------------------------------------------+
                        |                 |                 ^          ^
       2. Cria Pedido   |  3. Gera Link   |    5. Webhook   |          | 7. Cron Reconciliação
       (RPC idempotente)|     Checkout    |       Pagamento |          |    (vercel.json diário)
                        v                 v                 |          |
      +--------------------+   +----------------------+     |          |
      | BANCO SUPABASE     |   | MERCADO PAGO         |-----+          |
      | - store_orders     |   | - Processa Cartão/PIX|                |
      | - outbox (avisos)  |   | - Confirma Pagamento |----------------+
      | - avaliacoes       |   +----------------------+
      +--------------------+
           |          ^
           |          | 6. Consome outbox e dispara avisos
           v          v
      +--------------------------------------------------------+
      | SERVIÇO DE NOTIFICAÇÕES (Servidor Next.js / Cron)     |
      +--------------------------------------------------------+
              |                                         |
              | 6a. POST Webhook HTTPS                  | 6b. API HTTPS
              v                                         v
   +-----------------------+                +-----------------------+
   | AUTOMAÇÃO WHATSAPP    |                | RESEND (E-MAILS)      |
   | (n8n / Make / Z-API)  |                | pedidos@dominio       |
   +-----------------------+                +-----------------------+
              |                                         |
              +-------------------+---------------------+
                                  |
                                  v
                      +-----------------------+
                      | - Celular do Cliente  |
                      | - Celular/Email Dono  |
                      +-----------------------+
```

---

## 2. Inventário de Contas e Serviços

| Serviço | Para que serve | Plano / Limites [VERIFICAR no painel] | Como acessar | Titular / E-mail | 2FA Ativo? |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **GitHub** | Hospedagem do código-fonte e controle de versões (repositório `AlvesStore`) | Free (repositório privado) | `https://github.com/login` | *[preencher no gerenciador]* | *[preencher]* |
| **Vercel** | Hospedagem do site, geração de páginas estáticas (SSG), rotas de API e agendamento de cron jobs | Hobby (Free) — 1 execução de cron diária; limite de funções serverless e armazenamento de deploys | `https://vercel.com/login` | *[preencher no gerenciador]* | *[preencher]* |
| **Supabase** | Banco de dados PostgreSQL gerenciado, autenticação de serviço e Storage de fotos de avaliações | Free Tier — pausa após inatividade prolongada; sem backups automáticos | `https://supabase.com/dashboard` | *[preencher no gerenciador]* | *[preencher]* |
| **Mercado Pago** | Gateway de pagamento (PIX, Boleto e Cartão de Crédito via Checkout Pro) | Taxas por transação aprovada [VERIFICAR no painel] | `https://www.mercadopago.com.br` | *[preencher no gerenciador]* | *[preencher]* |
| **Resend** | Envio de e-mails transacionais (confirmação de pagamento para cliente e dono) | Free — 3.000 e-mails/mês (100/dia) [VERIFICAR no painel] | `https://resend.com/login` | *[preencher no gerenciador]* | *[preencher]* |
| **Registro de Domínio / DNS** | Gerenciamento do domínio `importsalves.com.br` e registros DNS (A, CNAME, TXT, MX) | Anuidade do domínio | *[VERIFICAR no painel: Registro.br, Hostinger ou Cloudflare]* | *[preencher no gerenciador]* | *[preencher]* |
| **Meta / Instagram** | Exibição de feed social e identificação da marca no Instagram | Gratuito | `https://business.facebook.com` | *[preencher no gerenciador]* | *[preencher]* |
| **Serviço de WhatsApp** | Roteamento do webhook transacional para envio de mensagens via WhatsApp | Variável conforme provedor (n8n auto-hospedado, Make ou gateway Z-API/Evolution) | Painel da ferramenta escolhida | *[preencher no gerenciador]* | *[preencher]* |

---

## 3. Tecnologias e Estrutura do Código

### Stack Tecnológica
- **Next.js 15 (App Router)** com React 19 e TypeScript 5.
- **Tailwind CSS** para estilização utilitária.
- **Supabase JS Client** para comunicação com PostgreSQL e Storage.
- **Mercado Pago Node SDK** para geração de preferências e conferência de pagamentos.
- **Resend SDK / Fetch** para envio de e-mails transacionais em HTML e texto puro.
- **Node Test Runner (`node:test`) + TSX** para testes unitários e de integração rápidos.

### Pastas Principais
- `app/`: Rotas do Next.js (App Router). Contém páginas públicas (`/`, `/produto/[slug]`, `/carrinho`, `/checkout`, `/rastreio`), rotas de API (`/api/mercado-pago/webhook`, `/api/admin/...`, `/api/reviews/...`, `/api/cron/...`) e painel administrativo (`/app/admin`).
- `components/`: Componentes visuais reutilizáveis (carrinho, cards de produto, formulário de avaliação, modais de imagem, banners).
- `data/`: Arquivos de dados estáticos do catálogo (`products.json`, `f1-products.json`, `leagues.json`, `categories.json`, `splits.json`, cache de sincronização).
- `lib/`: Regras de negócio compartilhadas entre cliente e servidor (cálculo de descontos, validação de carrinho, formatação de moeda).
  - `lib/server/`: Funções executadas **exclusivamente no servidor** (autenticação do admin, comunicação com Supabase com chave de serviço, envio de e-mails e enfileiramento na outbox).
- `supabase/migrations/`: Arquivos de migração SQL numerados cronologicamente para criação e evolução do banco de dados.
- `scripts/`: Scripts utilitários de manutenção do catálogo, higienização de imagens, verificação de consistência e diagnóstico de banco.
- `tests/`: Suíte de testes automatizados cobrindo regras de desconto, validação de checkout, idempotência de webhooks, métricas financeiras e isolamento de permissões.
- `yupooBot/`: Scripts em Python para raspagem, auditoria e importação de produtos de fornecedores (álbuns Yupoo).

### Arquivos-Chave do Sistema
1. **Catálogo:** `lib/server/supabase-catalog.ts` — Mescla o catálogo estático local com os produtos cadastrados no Supabase, aplicando regras de visibilidade (`oculto`), fallbacks e cache resiliente.
2. **Criação de Pedido:** `app/api/checkout/route.ts` — Valida o carrinho contra o catálogo oficial do servidor, gera o hash de integridade e invoca a RPC `prepare_store_order`.
3. **Webhook do Mercado Pago:** `app/api/mercado-pago/webhook/route.ts` — Valida a assinatura de segurança HMAC do Mercado Pago, consulta o pagamento aprovado e chama `apply_store_payment`.
4. **Outbox de Notificações:** `lib/server/order-notification-outbox.ts` — Gerencia o enfileiramento transacional, reserva com lock (`SKIP LOCKED`), envio via WhatsApp/E-mail, limite de 5 tentativas e carimbo de `paid_notified_at`.
5. **Autenticação e Permissões do Admin:** `lib/server/admin-auth.ts` — Valida tokens com comparação de tempo constante (`timingSafeEqual`), gera cookies de sessão assinados (HMAC) com validade de 8 horas (`ADMIN_SESSION_MAX_AGE_SECONDS = 8 * 60 * 60`, linha 14) e distingue papéis `admin` (completo via `ADMIN_ORDERS_TOKEN`) e `partner` (sócio, via `ADMIN_PARTNER_TOKEN`, linha 68).

---

## 4. Como Rodar Localmente do Zero

### Pré-requisitos
- **Node.js**: versão 20 LTS ou 22 LTS instalada.
- **Git**: instalado e configurado.
- *(Opcional)* **Python 3.10+**: caso deseje executar os robôs da pasta `yupooBot`.

### Passo a Passo

1. **Clonar o Repositório:**
   ```bash
   git clone https://github.com/alvesmarcola/AlvesStore.git
   cd AlvesStore
   ```

2. **Instalar Dependências:**
   ```bash
   npm install
   ```

3. **Configurar as Variáveis de Ambiente:**
   Copie o modelo de variáveis:
   ```bash
   cp .env.example .env.local
   ```
   Abra o arquivo `.env.local` e preencha as variáveis conforme orientado na Seção 5 deste manual.

4. **Executar em Modo de Desenvolvimento:**
   ```bash
   npm run dev
   ```
   Acesse a loja em: `http://localhost:3000`.

### Alertas Importantes
> [!WARNING]
> **Aviso sobre o OneDrive:** Se a pasta do projeto estiver sincronizada pelo OneDrive (ex.: `C:\Users\...\OneDrive\Documentos\lojaMarco`), o OneDrive pode bloquear arquivos temporários criados pelo Node/Next.js na pasta `.next` ou travar o Git. Caso ocorram erros estranhos de permissão ou `EPERM`, pause a sincronização do OneDrive durante o desenvolvimento ou mova o clone para fora do diretório do OneDrive.

> [!CAUTION]
> **Atenção ao Banco de Produção:** Se o seu `.env.local` estiver configurado com a URL e `SUPABASE_SERVICE_ROLE_KEY` do projeto de produção, qualquer pedido ou alteração de produto feita localmente impactará **o banco de dados real**. Para testes locais de compra, utilize `is_test = true` ou configure um projeto separado no Supabase.

### Resolução de Problemas Comuns
- **Porta 3000 já em uso:**
  Se o terminal acusar que a porta 3000 está ocupada:
  ```powershell
  # No Windows PowerShell:
  Get-Process -Id (Get-NetTCPConnection -LocalPort 3000).OwningProcess | Stop-Process -Force
  # Ou simplesmente execute o Next em outra porta:
  npm run dev -- -p 3001
  ```
- **Cache corrompido (`.next`):**
  Se a página apresentar erros de estilos ausentes (404 em CSS) ou travamentos:
  ```powershell
  # No Windows (PowerShell):
  Remove-Item -Recurse -Force .next
  npm run dev
  ```

---

## 5. Variáveis de Ambiente

Todas as variáveis de ambiente utilizadas no projeto estão catalogadas na tabela abaixo.

| Variável | Obrigatória? | Onde configurar | O que faz / Onde obter | O que quebra se faltar? |
| :--- | :--- | :--- | :--- | :--- |
| `NEXT_PUBLIC_SUPABASE_URL` | **Sim** | `.env.local` e Vercel | URL base da API do Supabase (`https://<ref-do-projeto>.supabase.co`). Obtida no painel do Supabase em Project Settings > API. | O catálogo não carrega e o checkout falha. |
| `SUPABASE_SERVICE_ROLE_KEY` | **Sim** | `.env.local` e Vercel | Chave secreta de serviço com privilégios de escrita (bypassa RLS). Painel Supabase > Settings > API > service_role. | Criação de pedidos, aprovação de pagamentos, outbox e avaliações quebram (erro 500/503). |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Opcional | `.env.local` e Vercel | Chave pública anônima do Supabase. | Consultas públicas do lado do cliente que necessitem de anon key falham. |
| `ADMIN_ORDERS_TOKEN` | **Sim** | `.env.local` e Vercel | Token alfanumérico seguro para login pleno no painel `/admin`. Gerado por você (guardar no gerenciador). | Bloqueia completamente o acesso ao painel de administração (retorna 503). |
| `ADMIN_PARTNER_TOKEN` | Opcional | `.env.local` e Vercel | Token restrito para o perfil de sócio/parceiro (oculta custos, fornecedores e métricas confidenciais). | O sócio não consegue se autenticar com permissões restritas. |
| `PAYMENT_ENVIRONMENT` | **Sim** | `.env.local` e Vercel | Define o modo de pagamento: deve ser `"test"` ou `"production"`. | Se divergente das credenciais do Mercado Pago, transações de produção serão recusadas. |
| `MERCADO_PAGO_ACCESS_TOKEN` | **Sim** | `.env.local` e Vercel | Token de acesso da aplicação Mercado Pago. Painel Mercado Pago Developers. | O checkout não consegue gerar o link de pagamento. |
| `MERCADO_PAGO_WEBHOOK_SECRET` | **Sim** | `.env.local` e Vercel | Chave secreta de assinatura HMAC configurada no Webhook do Mercado Pago Developers. | Webhooks recebidos não são validados e pagamentos aprovados não atualizam o pedido automaticamente. |
| `CRON_SECRET` | **Sim** | `.env.local` e Vercel | Token seguro para autenticar chamadas da Vercel aos endpoints `/api/cron/*`. | As rotas de conciliação automática de pagamento e envio de notificações em segundo plano retornam 401. |
| `SITE_URL` | **Sim** | `.env.local` e Vercel | URL pública canônica da loja (ex.: `https://importsalves.com.br`). | Links de retorno do checkout e links de rastreio enviados por e-mail/WhatsApp ficam com URLs incorretas. |
| `RESEND_API_KEY` | Recomendada | `.env.local` e Vercel | Chave de API da plataforma Resend. Painel Resend > API Keys. | E-mails de confirmação de pedido para cliente e dono não serão disparados. |
| `ORDER_EMAIL_FROM` | Recomendada | `.env.local` e Vercel | Remetente verificado no Resend (ex.: `Imports Alves <pedidos@importsalves.com.br>`). | O Resend recusa o envio por falta de remetente com domínio validado. |
| `WHATSAPP_ORDER_WEBHOOK_URL`| Recomendada | `.env.local` e Vercel | URL HTTPS pública da automação que envia mensagens de WhatsApp (n8n, Make, Z-API). | Avisos de pedidos pagos via WhatsApp deixam de ser despachados. |
| `WHATSAPP_ORDER_WEBHOOK_TOKEN`| Opcional | `.env.local` e Vercel | Token Bearer de segurança enviado no cabeçalho `Authorization` do webhook de WhatsApp. | A automação externa não conseguirá validar a origem da requisição se exigir token. |
| `OWNER_NOTIFY_WHATSAPP` | Recomendada | `.env.local` e Vercel | Telefone celular do dono em formato internacional (ex.: `5500000000000`) para receber avisos imediatos de vendas. | O dono da loja não recebe notificação de novas vendas no WhatsApp. |
| `OWNER_NOTIFY_EMAIL` | Recomendada | `.env.local` e Vercel | E-mail do dono para receber o espelho do pedido aprovado via Resend. | O dono da loja não recebe o aviso reserva de venda por e-mail. |
| `INSTAGRAM_ACCESS_TOKEN` | Opcional | `.env.local` e Vercel | Token da Graph API do Instagram para puxar os posts mais recentes. | O site exibe os posts estáticos de fallback na página inicial. |
| `INSTAGRAM_USER_ID` | Opcional | `.env.local` e Vercel | ID numérico do perfil comercial do Instagram. | O site exibe os posts estáticos de fallback na página inicial. |

---

## 6. Banco de Dados (Supabase)

O banco de dados utiliza o PostgreSQL gerenciado no Supabase (projeto `<ref-do-projeto>`).

### Estrutura Real de Todas as Tabelas de Produção (via `information_schema`)

1. **`store_orders`**: Tabela principal de pedidos do e-commerce.
   - Colunas: `id` (uuid), `idempotency_key` (uuid), `request_hash` (character 64), `status` (text), `preference_id` (text), `checkout_url` (text), `item_lines` (jsonb), `customer` (jsonb), `shipping` (jsonb), `shirt_quantity` (integer), `shirts_cents` (integer), `customization_cents` (integer), `patches_cents` (integer), `shipping_cents` (integer), `total_cents` (integer), `tracking_code` (text), `created_at` (timestamptz), `updated_at` (timestamptz), `paid_notified_at` (timestamptz), `operational_status` (text), `supplier_name` (text), `supplier_status` (text), `supplier_ordered_at` (timestamptz), `supplier_cost_cents` (integer), `shipping_cost_cents` (integer), `other_expenses_cents` (integer), `internal_notes` (text), `tracking_url` (text), `shipped_at` (timestamptz), `payment_method_id` (text), `payment_type_id` (text), `mercado_pago_status` (text), `mercado_pago_id` (text), `payment_reconciliation_attempts` (integer), `payment_reconciliation_after` (timestamptz), `promo` (text), `valor_desconto` (numeric), `is_test` (boolean), `payment_fee_cents` (integer), `refunded_cents` (integer).

2. **`store_order_payments`**: Registro detalhado das transações recebidas do gateway.
   - Colunas: `payment_id` (text), `order_id` (uuid), `status` (text), `amount_cents` (integer), `currency` (text), `live_mode` (boolean), `updated_at` (timestamptz).

3. **`store_order_notification_outbox`**: Fila de saída transacional para avisos assíncronos.
   - Colunas: `id` (uuid), `order_id` (uuid), `event_name` (text), `channel` (text), `status` (text), `attempt_count` (integer), `available_at` (timestamptz), `lease_until` (timestamptz), `last_error` (text), `sent_at` (timestamptz), `created_at` (timestamptz), `updated_at` (timestamptz).
   - Constraints: `UNIQUE (order_id, event_name, channel)`, `CHECK (event_name IN ('order_paid', 'order_paid_owner'))`, `CHECK (status IN ('pending', 'processing', 'sent', 'failed'))`.

4. **`avaliacoes`**: Depoimentos e avaliações de clientes.
   - Colunas: `id` (uuid), `created_at` (timestamptz), `nome` (text), `cidade` (text), `nota` (integer), `comentario` (text), `aprovado` (boolean — campo legado mantido sincronizado), `status` (text — `pending`, `approved`, `rejected`), `moderated_at` (timestamptz), `moderated_by` (text), `produto` (text), `imagem_path` (text).

5. **`products`**: Extensão dinâmica de produtos cadastrados via painel.
   - Colunas: `id` (text), `yupoo_id` (text), `slug` (text), `clube` (text), `clubeSlug` (text), `liga` (text), `publico` (text), `tipo` (text), `temporada` (text), `uniforme` (text), `nome` (text), `preco` (numeric), `tamanhos` (ARRAY text), `cor` (text), `imageSeed` (text), `images` (jsonb), `created_at` (timestamptz), `updated_at` (timestamptz), `description` (text), `stock_by_size` (jsonb), `brand` (text), `tem_variacao_uniforme` (boolean), `oculto` (boolean).
   - *Nota sobre Fornecedor e Custo:* Conforme a arquitetura da aplicação, dados comerciais de fornecedor e custo de reposição para produtos dinâmicos **não ficam na tabela `products`**, mas sim na tabela vinculada `admin_product_supplier_details`.

6. **`admin_product_supplier_details`**: Detalhes operacionais de fornecedores para produtos.
   - Colunas: `product_id` (text), `supplier_name` (text), `supplier_cost` (numeric), `updated_at` (timestamptz).

7. **`payment_events`**: Auditoria forense de payloads de webhook recebidos do Mercado Pago.
   - Colunas: `id` (uuid), `payment_id` (text), `order_id` (uuid), `topic` (text), `action` (text), `status` (text), `created_at` (timestamptz).

8. **`admin_audit_log`**: Registro de ações administrativas críticas (exclusão/ocultação de produtos, alterações financeiras manuais).
   - Colunas: `id` (uuid), `acao` (text), `entidade` (text), `entidade_id` (text), `resumo` (jsonb), `created_at` (timestamptz).

9. **`orders`**: Tabela legada da versão inicial da loja (mantida para histórico anterior à migração para `store_orders`).

### Views no Banco de Dados
- **`approved_review_summary`**: Visão agregada que calcula contagem e média das avaliações aprovadas (`review_count`, `average_rating`).
- **`store_order_admin_metrics`**: Visão com consolidação rápida de faturamento e volume de pedidos para dashboards.

### Funções SQL (RPCs)
- **`prepare_store_order(...)`**: Reserva atômica do pedido com trava consultiva (`pg_advisory_xact_lock`), garantindo idempotência e prevenindo pedidos duplicados.
- **`apply_store_payment(...)`**: Registra o pagamento aprovado no pedido, cria o histórico em `store_order_payments` e enfileira na outbox.
- **`claim_store_order_notifications(p_limit, p_order_id)`**: Reserva registros pendentes da outbox utilizando `FOR UPDATE SKIP LOCKED`, garantindo que múltiplas instâncias ou cron jobs concorrentes nunca processem o mesmo aviso ao mesmo tempo.
- **`complete_store_order_notification(p_notification_id, p_succeeded, p_error, p_retry_seconds, p_max_attempts)`**: Conclui o envio da outbox. Se bem-sucedido, marca `sent` e carimba `sent_at`. Se falhar por 5 vezes, marca `failed` e libera o lease.
- **`claim_store_orders_for_payment_reconciliation(p_limit)`**: Seleciona pedidos pendentes antigos para consultar o Mercado Pago em contingência.
- **`count_product_orders(p_product_slug, p_product_id)`**: Retorna quantos pedidos estão vinculados a determinado produto para proteger contra exclusão acidental.

### Políticas de RLS e Storage
- Todas as tabelas sensíveis possuem Row Level Security (**RLS**) ativado.
- O acesso a `store_orders`, `store_order_payments` e `store_order_notification_outbox` é **totalmente revogado de `PUBLIC`, `anon` e `authenticated`**, sendo acessível unicamente pela role `service_role`.
- **Bucket de Storage `avaliacoes`**: Privado (`public: false`), com limite de 512 KB por arquivo, aceitando apenas formatos de imagem (`image/jpeg`, `image/png`, `image/webp`). Imagens só são entregues publicamente através do endpoint seguro `app/api/reviews/image/route.ts` caso a avaliação correspondente tenha sido moderada e aprovada (`status = 'approved'`).

### Ordem Cronológica das Migrações para Recriação do Banco
Para recriar o banco de dados do zero em um novo projeto Supabase, execute os arquivos da pasta `supabase/migrations/` no SQL Editor rigorosamente na seguinte ordem:

1. `20261017000000_store_orders.sql` — Estrutura inicial de pedidos e pagamentos.
2. `20261018000000_mercado_pago_order_fields.sql` — Campos do Mercado Pago.
3. `20261019000000_order_paid_notice.sql` — Coluna `paid_notified_at`.
4. `20261103000000_post_sale_order_status.sql` — Status operacionais pós-venda.
5. `20261103000001_manual_product_fields.sql` — Tabela `admin_product_supplier_details`.
6. `20261103000002_order_operations_finance.sql` — Custos operacionais e notas internas.
7. `20261103000003_review_moderation.sql` — Tabela `avaliacoes` e moderação.
8. `20261104000000_mercado_pago_reliability.sql` — RPCs de conciliação, outbox e locks.
9. `20261105000000_black_friday_nba.sql` — Campos de desconto promocional.
10. `20261105000001_product_uniform_variation.sql` — Coluna `tem_variacao_uniforme`.
11. `20261105000002_payment_events_and_reconciliation.sql` — Tabela `payment_events`, campo `oculto` e divergências.
12. `20261105000003_admin_product_deletion_and_audit.sql` — Tabela `admin_audit_log` e RPC `count_product_orders`.
13. `20261107000000_finance_reliable_metrics.sql` — Métricas confiáveis e taxas.
14. `20261107000001_review_photos_storage.sql` — Criação do bucket `avaliacoes` e políticas.
15. `20261108000000_order_paid_owner_notification.sql` — Suporte a `order_paid_owner`, status `failed` e RPC atualizada.

---

## 7. Fluxos Principais Passo a Passo

### (a) Fluxo de Compra: Carrinho -> Checkout -> Pagamento
1. O cliente escolhe produtos, seleciona tamanho, uniforme (Casa ou Fora) e personalização (nome, número e patches).
2. O carrinho calcula o frete e aplica eventuais promoções.
3. Na página de checkout, o cliente informa seus dados de contato e endereço.
4. Ao clicar em "Finalizar Pedido", a rota `/api/checkout` valida todos os itens contra o catálogo seguro no servidor, gera um hash de verificação e chama `prepare_store_order` no Supabase.
5. O servidor gera a preferência de pagamento no Mercado Pago (Checkout Pro) com `external_reference` igual ao UUID do pedido e redireciona o cliente para o pagamento seguro.

### (b) Webhook do Mercado Pago e Cron de Contingência
1. O Mercado Pago envia uma notificação `POST` para `/api/mercado-pago/webhook`.
2. O servidor valida a assinatura no cabeçalho `x-signature` utilizando `MERCADO_PAGO_WEBHOOK_SECRET`.
3. O servidor consulta o pagamento diretamente na API do Mercado Pago para obter o status real (`approved`).
4. Invoca a RPC `apply_store_payment`, que atualiza o pedido para `approved` e `aguardando_fornecedor`, grava o snapshot de custo do fornecedor e enfileira as notificações na outbox.
5. **Cron de contingência (`vercel.json`):** A Vercel executa diariamente às 15:00 UTC (12:00 Brasília) a rota `/api/cron/mercado-pago` agendada via `vercel.json` (`schedule: "0 15 * * *"`). A rota cancela pedidos pendentes com mais de 48h, consulta a RPC `claim_store_orders_for_payment_reconciliation` para verificar pedidos pendentes no Mercado Pago e dispara a outbox de notificações pendentes via `dispatchOrderNotificationOutbox({ limit: 30 })`.

### (c) Cálculo Financeiro: Custo, Taxa, Lucro e Estornos
1. Quando um pedido é pago, o sistema congela o custo atual de fornecedor em `supplier_cost_cents`.
2. A taxa da operadora é obtida de `fee_details` do Mercado Pago (ou calculada por fallback percentual).
3. **Fórmula do Lucro Líquido:**
   $$\text{Lucro} = \text{Total Pago} - \text{Custo Fornecedor} - \text{Taxa Mercado Pago} - \text{Frete Real} - \text{Outras Despesas}$$
4. Em caso de estorno no gateway, o sistema registra o valor devolvido em `store_orders.refunded_cents` e atualiza o status operacional para `reembolsado` (exibido como **"Reembolsado"** no admin), deduzindo o valor do faturamento aprovado. Pedidos de teste (`is_test = true`) são excluídos das métricas financeiras.

### (d) Avisos de Pedido (Cliente e Dono), Limite de Tentativas e Cron
1. Apenas pedidos com pagamento aprovado geram avisos. Pedidos em checkout ou abandonados nunca disparam notificações.
2. São criadas linhas independentes na outbox:
   - Cliente: evento `order_paid` (WhatsApp se opt-in ativo; E-mail se informado).
   - Dono da loja: evento `order_paid_owner` (WhatsApp para `OWNER_NOTIFY_WHATSAPP` e E-mail para `OWNER_NOTIFY_EMAIL`).
3. Se algum canal não estiver configurado no servidor, nenhuma linha inútil é gerada na outbox. Se nenhum canal estiver configurado, o pedido grava `paid_notified_at = NOW()` de imediato para não travar em "Aviso pendente".
4. A cada tentativa que falhar (erro no provedor externo), aplica-se recuo exponencial. Ao atingir **5 tentativas** (`MAX_NOTIFICATION_ATTEMPTS = 5`), a notificação transiciona para o status `failed`.
5. **Aviso Importante sobre o Cron da Vercel:** As retentativas automáticas rodam no máximo uma vez por dia, na execução do cron descrita em 7(b) (plano Hobby da Vercel). A defesa operacional é a checagem diária no admin e o botão Reenviar aviso.
6. O pedido exibe o selo **"Aviso pendente"** no painel administrativo enquanto houver alguma notificação com status `pending` ou `failed`.
7. O campo `paid_notified_at` só é gravado quando **todas** as notificações do pedido tiverem status `sent`.

### (e) Avaliações com Foto e Moderação
1. O cliente preenche o formulário na página de avaliações, podendo anexar 1 foto (máx. 512 KB).
2. A foto é salva no bucket privado `avaliacoes` no Supabase com nome seguro (`UUID.ext`).
3. O registro nasce com `status = 'pending'`.
4. No painel admin (`/admin/avaliacoes`), o administrador pode aprovar ou rejeitar. Apenas avaliações com `status = 'approved'` têm sua foto e depoimento visíveis publicamente.

### (f) Promoções: Black Friday NBA e Pacotes por Quantidade
- **Promoção Black Friday NBA (`BF-NBA-2026`):**
  - Implementada em `lib/black-friday.ts`.
  - Regra: O produto ativador do benefício é a **Regata NBA**. Para cada regata NBA presente no carrinho, uma **camisa de time comum elegível** (versão torcedor tradicional de clube/seleção, treino ou feminina) recebe **50% de desconto**.
  - Não elegíveis ao desconto: a própria regata NBA, conjuntos infantis e camisas Versão Jogador (player).
  - Data limite: Expira em `01/12/2026 23:59:59` (horário de Brasília).
- **Pacotes de Torcedor Comum (sem regata):**
  - 1 camisa: R$ 170,00 [VERIFICAR no painel/config].
  - 2 camisas: R$ 300,00 [VERIFICAR no painel/config].
  - 3 camisas: R$ 450,00 [VERIFICAR no painel/config].

### (g) Regras Reais de Frete, Seletor Casa/Fora e Personalização
- **Regras Reais de Frete:**
  - Definidas em `config.ts` (linhas 15-16) e calculadas em `lib/commerce.ts`:
  - **1 ou 2 produtos cobráveis:** Frete fixo de **R$ 20,00** (`storeConfig.shippingPrice = 20`) [VERIFICAR no painel/config].
  - **A partir de 3 produtos:** **Frete Grátis** para todo o Brasil (`storeConfig.freeShippingQuantity = 3`).
  - Produtos marcados como `isTestProduct` ou promocionais com frete grátis não somam na cobrança de frete.
- **Seletor Casa/Fora:** Produtos com `tem_variacao_uniforme = true` obrigam o cliente a selecionar entre "Uniforme 1 (Casa)" ou "Uniforme 2 (Fora)".
- **Personalização:** Nome (até 14 letras) e Número (até 2 dígitos) por R$ 39,90 adicionais. Patches oficiais da manga por R$ 10,00 cada [VERIFICAR no painel/config].

---

## 8. Painel Administrativo

- **Endereço de Acesso:** `https://importsalves.com.br/admin`
- **Como Entrar:** O login é protegido por token. Digite o token no campo de acesso (o valor está `[guardado no gerenciador de senhas]`). O sistema gera um cookie seguro assinado com validade de 8 horas (`ADMIN_SESSION_MAX_AGE_SECONDS = 8 * 60 * 60`, em `lib/server/admin-auth.ts`, linha 14).

### Perfis de Acesso
1. **Administrador Pleno (`admin`):** Autenticado via `ADMIN_ORDERS_TOKEN`. Acesso irrestrito a todas as abas, relatórios financeiros, alteração de custos, exclusão de produtos, moderação e reenvio de notificações.
2. **Sócio / Parceiro (`partner`):** Autenticado via `ADMIN_PARTNER_TOKEN` (`lib/server/admin-auth.ts`, linha 68). Visualiza pedidos e estoque, mas tem os valores de faturamento, margens de lucro, custos de fornecedor e a aba de configurações **completamente ocultos** (exibidos como `—`).

### Guia de Uso das Abas
- **Visão Geral:** Dashboard com faturamento aprovado, total de pedidos, ticket médio e alertas rápidos.
- **Pedidos:** Tabela completa de vendas. Permite filtrar por status, marcar/desmarcar pedido como "Teste" (para expurgar de relatórios fiscais), preencher código/URL de rastreio e acionar o botão **"Reenviar aviso"** quando o selo "Aviso pendente" estiver ativo.
- **Produtos e Estoque:** Lista produtos cadastrados. Permite editar preço, nome, fornecedor e clicar em "Ocultar" (retira da vitrine pública sem quebrar pedidos antigos) ou "Excluir" (bloqueado se o produto já tiver vendas associadas).
- **Fornecedores:** Gestão de nomes de fornecedores e controle de pedidos aguardando envio internacional.
- **Financeiro:** DRE com faturamento bruto, custos de mercadoria, taxas de operadora, reembolsos e exportação de relatório em CSV compatível com Excel (UTF-8 BOM).
- **Avaliações:** Fila de moderação de depoimentos. Apresenta miniatura clicável para inspecionar fotos de clientes antes de clicar em "Aprovar" ou "Rejeitar".
- **Configurações:** Localizada em `app/admin/configuracoes/page.tsx` e renderizada em `app/admin/admin-summary-client.tsx` (linha 459). Apresenta a auditoria visual de presença das variáveis de ambiente no servidor sem revelar seus valores.

---

## 9. Catálogo de Produtos e Robôs Yupoo (`yupooBot`)

### Como os Produtos são Armazenados
O catálogo é híbrido:
1. **Produtos Nativos / Base:** Arquivos locais `data/products.json` e `data/f1-products.json`. Garantem build rápido e disponibilidade estática imediata.
2. **Produtos Dinâmicos:** Tabela `products` no Supabase. Permitem inclusão de novos modelos pelo admin sem necessidade de novo deploy. Durante o build da Vercel, o script `lib/server/supabase-catalog.ts` baixa os produtos do Supabase e consolida no cache estático.

### Rotina de Pré-Build (`prebuild`)
Antes de cada build, o script `scripts/check-catalog-categories.ts` é executado automaticamente (`npm run prebuild`). Ele confere a integridade de todas as slugs, categorias e contagens de produtos. Se houver produto sem categoria ou com slug inválida, o build é abortado para evitar links quebrados em produção.

### Arquivos Reais de `yupooBot/` e Suas Funções
- **`yupooBot/yupoo_to_supabase.py`**: Robô principal de extração. Lê páginas Yupoo com BeautifulSoup, processa álbuns e insere registros na tabela `public.products` do Supabase.
- **`yupooBot/importar_nba.py`**: Importador em lote para produtos NBA. Consome os arquivos de mapeamento locais `nba-albuns.json` e `nba-nomes.json`, normaliza imagens com a biblioteca Pillow e cadastra as regatas.
- **`yupooBot/validar_nba.py`**: Validador de dados. Verifica se todos os álbuns da lista possuem imagens válidas e sem URLs quebradas antes do cadastro.
- **`yupooBot/auditar_nba.py`**: Auditoria que compara o inventário local com o que já foi publicado no banco de dados.
- **`yupooBot/nba_validation.py`**: Módulo compartilhado com rotinas de validação de títulos, slugs e padronização de franquias da NBA.
- **`yupooBot/baixar_yupoo.py.txt`**: Script utilitário em texto para download sequencial de fotos de demonstração.
- **`yupooBot/testdisc.py`**: Utilitário de teste de conexões e sockets.
- **`yupooBot/requirements-yupoo.txt`**: Lista de bibliotecas Python com versões declaradas no arquivo: `requests>=2.32,<3`, `beautifulsoup4>=4.12,<5`, `Pillow>=10,<13`, `supabase>=2,<3`.

### Higienização de Fotos da F1
- **Script:** `scripts/remover-fotos-f1.ts` — Remove fotos de fornecedor contendo marcas d'água de WhatsApp de intermediários chineses nas polos de Fórmula 1 e registra as URLs banidas no arquivo `data/yupoo-image-blacklist.json`.

---

## 10. Gateway de Pagamento: Mercado Pago

### Configuração no Painel do Mercado Pago
1. Acesse o portal [Mercado Pago Developers](https://www.mercadopago.com.br/developers/panel).
2. Em **Suas integrações**, crie ou selecione a aplicação da loja.
3. Obtenha o Access Token de Produção e configure na Vercel como `MERCADO_PAGO_ACCESS_TOKEN`.
4. Em **Notificações Webhook**:
   - URL do Webhook: `https://importsalves.com.br/api/mercado-pago/webhook`
   - Eventos selecionados: `Pagamentos` (`payment`).
   - Copie a Chave Secreta de Assinatura gerada pelo Mercado Pago e configure na Vercel como `MERCADO_PAGO_WEBHOOK_SECRET`.

### Teste vs. Produção
- Para homologar pagamentos sem dinheiro real, defina `PAYMENT_ENVIRONMENT=test` e utilize um Access Token de teste do Mercado Pago.
- Em produção, defina rigorosamente `PAYMENT_ENVIRONMENT=production` e utilize o token de produção.

### Como Conferir e Estornar Pagamentos
- No painel administrativo do Mercado Pago, localize o pagamento pelo número do pedido (gravado no campo `Referência externa` / `external_reference`).
- Se precisar estornar o cliente, realize a operação diretamente no Mercado Pago. O webhook avisará o site e o pedido mudará automaticamente para o status **"Reembolsado"** (`status = 'refunded'`, `operational_status = 'reembolsado'`), gravando o montante em `store_orders.refunded_cents` e deduzindo do DRE financeiro.

---

## 11. E-mails e WhatsApp Transacionais

### Resend (E-mails)
1. **Verificação de Domínio:** No painel do Resend em **Domains**, adicione o domínio próprio da loja. Configure as entradas DNS do tipo `TXT` (SPF), `CNAME` (DKIM) e `MX` no painel do seu registrador de domínio.
2. **Remetente:** Utilize sempre um endereço associado ao domínio verificado na variável `ORDER_EMAIL_FROM` (ex.: `Imports Alves <pedidos@importsalves.com.br>`).

### WhatsApp (Webhook para Automação)
Quando um pedido é pago, o site efetua uma chamada `POST` HTTPS para a URL configurada em `WHATSAPP_ORDER_WEBHOOK_URL`.

#### Formato do Payload Enviado
```json
{
  "event": "order_paid",
  "to": "5500000000000",
  "message": "Olá, Nome do Cliente! Seu pedido #B2C3D4E5 na Imports Alves foi confirmado com sucesso!\n\nItens:\n- Camisa Flamengo Edição Especial (tam. G × 1)\n\nTotal: R$ 359,80\nForma de Pagamento: PIX\nEntrega: Endereço Fictício, 100...",
  "order": {
    "id": "b2c3d4e5-9999-4000-8000-111122223333",
    "customer": {
      "fullName": "Nome do Cliente",
      "phone": "(00) 00000-0000",
      "email": "cliente@exemplo.com"
    },
    "total_cents": 35980
  }
}
```
*Para o dono da loja, o evento enviado é `"order_paid_owner"` e o destinatário `to` é o valor configurado em `OWNER_NOTIFY_WHATSAPP`.*

#### Montagem da Automação no n8n / Make
1. Crie um gatilho do tipo **Webhook (POST)**.
2. *(Opcional)* Valide o cabeçalho `Authorization: Bearer <seu-token>` contra o `WHATSAPP_ORDER_WEBHOOK_TOKEN`.
3. Adicione um nó de envio de mensagem de WhatsApp (ex.: Z-API, Evolution API ou Baileys), mapeando o campo `to` para o destinatário e o campo `message` para o texto da mensagem.

---

## 12. Deploy, Branches e Domínio na Vercel

### Branches do Repositório
- **Situação Atual do Git:** Hoje o repositório local está na branch `feat/admin-final`, enquanto o repositório remoto (`origin`) possui as branches `master`, `feat/admin-final`, entre outras.
- **Branch de Produção:** **[VERIFICAR em Vercel > Settings > Git > Production Branch]** para conferir se o deploy de produção está apontando para `master` ou `feat/admin-final` antes de subir alterações.
- **Gatilho de Deploy:** Cada push na branch de produção dispara automaticamente o pipeline de build na Vercel.

### Pipeline de Build na Vercel
1. A Vercel executa `npm run prebuild` (validação de integridade do catálogo).
2. Executa `next build`: compila o código TypeScript, executa o linting e gera previamente **centenas de páginas estáticas (o número exato varia conforme novos produtos são cadastrados)**.
3. Se houver qualquer erro de TypeScript ou variável `any` não tipada, o build é reprovado e a versão anterior do site permanece no ar sem interrupção.

### Como Fazer Rollback para uma Versão Anterior
1. Acesse o painel da Vercel no projeto da loja.
2. Clique na aba **Deployments**.
3. Localize o deploy anterior que estava funcionando perfeitamente.
4. Clique no ícone de três pontos `...` à direita e selecione **Instant Rollback**. Em menos de 5 segundos a Vercel redireciona o tráfego sem necessidade de recompilação.

### Configuração de DNS
O domínio próprio aponta para a infraestrutura da Vercel através dos registros:
- **Tipo A:** Host `@` apontando para o IP da Vercel: `76.76.21.21` [VERIFICAR no painel da Vercel]
- **Tipo CNAME:** Host `www` apontando para `cname.vercel-dns.com` [VERIFICAR no painel da Vercel]

---

## 13. Rotina de Manutenção Recomendada

### Checklist Diário (2 minutos)
- Entrar no admin (`/admin/pedidos`) e verificar se há algum pedido com o selo **"Aviso pendente"**. Se houver, conferir o motivo e clicar em **"Reenviar aviso"**.
- Verificar se existem pedidos pagos aguardando encaminhamento para o fornecedor.

### Checklist Semanal
- Acessar o painel do Supabase e conferir o consumo de armazenamento e requisições (garantindo que permaneça na faixa gratuita) [VERIFICAR no painel].
- Acessar a aba `/admin/avaliacoes` e moderar novos depoimentos com fotos recebidos.

### Checklist Mensal
- Exportar o relatório financeiro do mês em CSV para conciliação contábil.
- Gerar um backup manual do banco de dados no Supabase (conforme Seção 14).

---

## 14. Backup e Recuperação de Desastres

> [!IMPORTANT]
> **Atenção sobre o Plano Gratuito do Supabase:** O plano Free do Supabase **NÃO inclui backups diários automatizados**. É responsabilidade da equipe realizar cópias periódicas dos dados.

### Como Exportar os Dados Manualmente
1. **Exportação de Tabelas em CSV:**
   - No painel do Supabase, acesse **Table Editor**.
   - Selecione `store_orders` e clique em **Export > Export to CSV**.
   - Repita para `store_order_payments`, `avaliacoes` e `products`.
2. **Backup das Imagens de Avaliações:**
   - No painel do Supabase, acesse **Storage > avaliacoes**.
   - Baixe as pastas de imagens para uma pasta segura local ou Google Drive.

### Restauração em um Projeto Supabase Novo
1. Crie um novo projeto no Supabase Dashboard.
2. Abra o **SQL Editor** do novo projeto.
3. Execute ordenadamente todas as 15 migrações listadas na Seção 6.
4. Recrie o bucket `avaliacoes` conforme a migração `20261107000001_review_photos_storage.sql`.
5. No painel da Vercel, atualize `NEXT_PUBLIC_SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` com os dados do novo projeto e dispare um novo deploy.

---

## 15. Segurança Crítica e Rotação de Credenciais Expostas

> [!CAUTION]
> **ALERTA DE SEGURANÇA MÁXIMA (PENDÊNCIA Nº 1):**
> A chave secreta de serviço do Supabase (`SUPABASE_SERVICE_ROLE_KEY`) e o token de acesso do administrador (`ADMIN_ORDERS_TOKEN`) foram anteriormente manipulados e expostos em ambiente de desenvolvimento e histórico. **A rotação imediata de ambas as credenciais no painel do Supabase e na Vercel é a prioridade absoluta antes do lançamento.**

### Passo a Passo de Rotação Imediata

1. **Rotacionar a Chave Secreta do Supabase (`SUPABASE_SERVICE_ROLE_KEY`):**
   - Acesse o painel do Supabase no projeto da loja.
   - Vá em **Project Settings > API**.
   - Na seção **Project API Keys**, localize a chave de serviço (`service_role`).
   - Clique em **Rotate Secret Key** (ou gere um novo token de serviço se disponível).
   - Copie a nova chave secreta gerada.
   - Abra o painel da Vercel > **Settings > Environment Variables**.
   - Edite `SUPABASE_SERVICE_ROLE_KEY`, cole o novo valor e marque para todos os ambientes (Production, Preview, Development).
   - Atualize também o seu arquivo `.env.local` na máquina local.

2. **Rotacionar o Token do Administrador (`ADMIN_ORDERS_TOKEN`):**
   - No gerenciador de senhas, gere uma sequência aleatória segura de pelo menos 32 caracteres (letras maiúsculas, minúsculas e números).
   - No painel da Vercel (**Settings > Environment Variables**), edite `ADMIN_ORDERS_TOKEN` e cole a nova chave.
   - Se utilizar acesso de sócio, gere outro token distinto e configure em `ADMIN_PARTNER_TOKEN`.
   - Atualize o seu `.env.local`.

3. **Disparar Novo Deploy Imediato:**
   - No painel da Vercel, vá em **Deployments**.
   - No último commit da branch de produção, clique nos três pontos `...` e selecione **Redeploy**.
   - Isso garante que a aplicação em execução na nuvem passe a utilizar exclusivamente os novos segredos, invalidando imediatamente qualquer sessão de admin antiga e bloqueando qualquer acesso não autorizado.

4. **Regras Permanentes de Segurança:**
   - Nunca envie arquivos `.env` ou `.env.local` para o GitHub (mantidos no `.gitignore`).
   - Nunca compartilhe telas ou logs com tokens.
   - Ative autenticação de dois fatores (**2FA**) em todas as contas (GitHub, Vercel, Supabase, Mercado Pago e Resend).

---

## 16. Roteiro de Reconstrução do Site do Zero

Caso todos os servidores sejam perdidos, siga este roteiro numerado para reerguer a loja:

1. **Código-fonte:** Clone o repositório do GitHub em um computador limpo.
2. **Supabase:**
   - Crie uma conta e um novo projeto no Supabase.
   - Abra o SQL Editor e execute em sequência os 15 arquivos da pasta `supabase/migrations/`.
   - Confirme que as tabelas e RPCs foram criadas.
3. **Mercado Pago:**
   - Obtenha o Access Token de produção.
   - Configure o Webhook apontando para `https://seudominio.com.br/api/mercado-pago/webhook` e anote o Webhook Secret.
4. **Resend:**
   - Adicione seu domínio no Resend e adicione os apontamentos DNS no provedor de domínio.
5. **Vercel:**
   - Importe o repositório na Vercel.
   - Cadastre todas as variáveis de ambiente da Seção 5 no painel da Vercel (Production & Preview).
   - Conecte o domínio próprio.
6. **Deploy:** Inicie o deploy e aguarde a conclusão.

### Checklist de Homologação Final
- [ ] Criar um produto teste no admin com valor de R$ 1,50.
- [ ] Fazer uma compra real com PIX ou Cartão no checkout.
- [ ] Confirmar se o status do pedido mudou para `approved` no painel admin.
- [ ] Confirmar se o aviso chegou no WhatsApp e E-mail.
- [ ] Testar estorno no Mercado Pago e verificar se o status foi atualizado para Reembolsado (`refunded`).
- [ ] Enviar uma avaliação com foto pelo formulário público e aprová-la no painel admin.

---

## 17. Estado Atual e Pendências do Projeto

Esta seção consolida o diagnóstico do que já está funcionando em produção e as pendências técnicas mapeadas para acompanhamento:

1. **O que está implementado (entra em produção após o deploy da branch de produção, ver seção 12):**
   - Catálogo com centenas de modelos, filtros por liga e busca inteligente.
   - Checkout Pro integrado com Mercado Pago e conciliação atômica de pedidos.
   - DRE Financeiro confiável no admin, com controle de taxas reais e registro de reembolsos.
   - Moderação de avaliações com upload de fotos protegido em bucket privado.
   - Arquitetura de outbox com limite de 5 tentativas e botão de reenvio manual no admin.

2. **O que Ainda Não Está Configurado:**
   - **Resend:** Para envio de e-mails, é necessário criar a conta no Resend, validar o domínio no DNS e preencher `RESEND_API_KEY` e `ORDER_EMAIL_FROM` na Vercel.
   - **WhatsApp:** É necessário plugar a automação externa (n8n/Make/Z-API) na URL `WHATSAPP_ORDER_WEBHOOK_URL` e definir `OWNER_NOTIFY_WHATSAPP`. Até lá, o sistema conclui os pedidos sem gerar falhas nem travar o painel.

3. **Pendência de Segurança Nº 1:**
   - **Rotacionar a chave `SUPABASE_SERVICE_ROLE_KEY` e o `ADMIN_ORDERS_TOKEN`** conforme descrito na Seção 15.

4. **Polos de F1 com Marca d'Água:**
   - Alguns produtos legados de Fórmula 1 podem conter fotos com números de telefone de intermediários. Utilizar periodicamente o script `scripts/remover-fotos-f1.ts` para higienização contra a blacklist.

5. **Lentidão da Página Inicial (Home):**
   - A página inicial carrega múltiplos carrosséis pesados e imagens remotas do Yupoo. Recomenda-se a futura implementação de pré-otimização local das imagens em WebP e lazy-loading de seções inferiores.

6. **Migração do Catálogo Estático para o Banco:**
   - Atualmente, os produtos base residem nos arquivos `data/products.json` e `data/f1-products.json`. Uma melhoria futura planejada é unificar todo o catálogo exclusivamente dentro da tabela `products` do Supabase para edição 100% via painel administrativo.

7. **Limite de Armazenamento de Deploys na Vercel:**
   - Como cada build gera centenas de páginas estáticas e vestígios de artefatos, o plano Hobby da Vercel pode alertar sobre acúmulo de deploys antigos [VERIFICAR no painel da Vercel]. Periodicamente, limpe os deploys arquivados em Project Settings > Deployments.

8. **Pixel da Meta / Facebook:**
   - O código do Pixel do Facebook e eventos de `Purchase`/`AddToCart` ainda não estão integrados. Recomenda-se adicionar via Google Tag Manager ou script no `app/layout.tsx` para campanhas de remarketing.

---

## 18. Problemas Conhecidos e Soluções

| Problema | Causa Raiz | Solução |
| :--- | :--- | :--- |
| **Porta 3000 ocupada** | Processo Node anterior travado em segundo plano. | Finalizar processo com `Stop-Process` no PowerShell ou usar `npm run dev -- -p 3001`. |
| **Erro 404 em arquivos de estilo (CSS sumiu)** | Cache `.next` corrompido após interrupção brusca. | Apagar a pasta `.next` e rodar `npm run dev` novamente. |
| **Build falha com erro de ESLint (`any`)** | Código adicionado com tipagem flexível proibida pelo lint. | Substituir `any` por tipos específicos ou `unknown` com guardas de tipo. Nunca usar `eslint-disable`. |
| **Erro 503 na rota `/api/reviews`** | Chave `SUPABASE_SERVICE_ROLE_KEY` ausente ou incorreta. | Verificar se o token de serviço do Supabase está presente no `.env.local` ou nas configurações da Vercel. |
| **Polos da F1 com foto contendo WhatsApp** | Imagem fornecida pelo Yupoo com marca d'água antiga. | Utilizar o script `scripts/remover-fotos-f1.ts` ou remover a URL no arquivo `data/f1-products.json`. |

---

## 19. Glossário de Termos Técnicos

- **App Router:** Modelo moderno de roteamento do Next.js baseado na estrutura de diretórios da pasta `app/`.
- **SSG (Static Site Generation):** Geração estática de páginas durante o build para carregamento instantâneo.
- **Idempotência:** Capacidade de uma operação ser executada múltiplas vezes sem produzir efeitos colaterais repetidos (ex.: receber o mesmo webhook 3 vezes e debitar o estoque apenas 1 vez).
- **Outbox Pattern:** Padrão arquitetural onde mensagens e avisos são salvos no banco de dados na mesma transação da regra de negócio para serem disparados de forma segura e assíncrona por um worker.
- **RLS (Row Level Security):** Recurso de segurança do PostgreSQL que restringe quais linhas da tabela podem ser lidas ou gravadas de acordo com a função do usuário conectado.
- **RPC (Remote Procedure Call):** Função SQL executada diretamente dentro do banco de dados PostgreSQL acionada via API.
- **SKIP LOCKED:** Cláusula do PostgreSQL que pula linhas travadas por outro processo concorrente, evitando que dois servidores peguem a mesma tarefa para executar simultaneamente.

---

## 20. Anexo: Comandos Úteis

### Comandos de Desenvolvimento e Build
```bash
# Iniciar ambiente de desenvolvimento
npm run dev

# Validação de regras de estilo e boas práticas
npm run lint

# Checagem estrita de tipos TypeScript
npm run typecheck

# Execução de toda a suíte de testes unitários e de integração
npm test

# Compilação e geração do pacote de produção
npm run build
```

### Como Executar Testes Específicos
```bash
# Rodar apenas testes de notificações
cmd /c "npm test -- tests/order-notifications.test.ts"

# Rodar apenas testes de pagamentos
cmd /c "npm test -- tests/payment.test.ts"
```

---

## Itens para Conferência Manual ("VERIFICAR")

Os seguintes itens dependem de credenciais contratuais e administrativas que devem ser preenchidas e guardadas no cofre de senhas da empresa:

1. **[VERIFICAR] Registro do Domínio:** Confirmar se o domínio está hospedado no Registro.br, Hostinger, GoDaddy ou Cloudflare, e anotar o e-mail do titular.
2. **[VERIFICAR] Ferramenta de WhatsApp:** Definir e documentar qual gateway de envio de WhatsApp está conectado à URL `WHATSAPP_ORDER_WEBHOOK_URL` (se é instância própria do n8n, Make, Z-API ou Evolution API).
3. **[VERIFICAR] E-mails Titulares e 2FA:** Preencher o inventário da Seção 2 com os e-mails e confirmação de ativação do duplo fator de autenticação em todas as contas (GitHub, Vercel, Supabase, Mercado Pago e Resend).
4. **[VERIFICAR] Branch de Produção na Vercel:** Conferir em Vercel > Settings > Git > Production Branch se a branch ativa é `master` ou `feat/admin-final`.
5. **[VERIFICAR] Valores e Limites de Planos:** Conferir no painel dos provedores as taxas do Mercado Pago, limites do plano gratuito da Vercel/Supabase/Resend e preços vigentes configurados no catálogo.

---

---

## Emergência em 1 Página (Guia Rápido de Intervenção)

> Guia prático para restauração e contingência operacional imediata. Imprima ou mantenha esta página acessível para pronta resposta a incidentes.

### 1. Site fora do ar ou tela de erro (500 / 404 / Falha no Deploy)
- **Ação:** Acesse o painel da Vercel > projeto `AlvesStore` > aba **Deployments**.
- **Rollback Imediato (30 segundos):** Localize o último deploy funcional anterior, clique no menu de três pontos (`...`) e selecione **"Promote to Production"**. O site voltará ao estado funcional anterior instantaneamente.
- **Banco Indisponível:** Acesse `supabase.com` e verifique se o projeto foi pausado por inatividade (comum no plano Free após períodos sem tráfego). Se pausado, clique em **"Restore project"**.

### 2. Cliente pagou, mas pedido não atualizou no site
- **Ação:** Acesse o painel administrativo em `/admin/pedidos` utilizando seu token de acesso (`ADMIN_ORDERS_TOKEN`).
- **Conciliação Manual:** Localize a linha do pedido (pelo e-mail ou nome do cliente) e clique no botão **"Conciliar"**.
- O sistema consultará o Mercado Pago na hora e, se aprovado, atualizará o status para pago, deduzirá o custo do fornecedor e enfileirará os avisos.

### 3. Avisos de WhatsApp ou E-mail não estão chegando
- **No Admin:** Verifique se o pedido está com o selo vermelho **"Aviso pendente"**. Clique no botão **"Reenviar aviso"**.
- **No Servidor (Vercel):** Verifique se as variáveis `RESEND_API_KEY` (e-mails) e `WHATSAPP_ORDER_WEBHOOK_URL` (WhatsApp) estão configuradas e válidas em **Settings > Environment Variables**.

### 4. Suspeita de vazamento de credenciais
- **Supabase:** Acesse **Project Settings > API** e clique em **Rotate Secret Key** para a chave `service_role`.
- **Vercel:** Atualize imediatamente `SUPABASE_SERVICE_ROLE_KEY` e altere o `ADMIN_ORDERS_TOKEN` nas variáveis de ambiente da Vercel. Faça um novo deploy para propagar.

### 5. Links Rápidos dos Painéis Críticos
- **Hospedagem e Deploys:** Vercel (`vercel.com`)
- **Banco de Dados e Imagens:** Supabase (`supabase.com`)
- **Recebimentos e Cobranças:** Mercado Pago (`mercadopago.com.br`)
- **E-mails Transacionais:** Resend (`resend.com`)

---

> **Declaração de Conformidade:** Confirmo que este manual foi revisado rigorosamente contra o código e o schema de produção, e **não contém nenhum valor secreto, chave de API, senha, telefone ou dado pessoal confidencial**.
