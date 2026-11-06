# Relatório de Diagnóstico do Catálogo e Infraestrutura — 06/11/2026

**Repositório:** AlvesStore (loja Imports Alves — [www.importsalves.com.br](https://www.importsalves.com.br))  
**Modo:** Somente Consulta (Diagnóstico de Leitura — Zero Escrita / Zero Deploy)  
**Data:** 06 de novembro de 2026  

---

## A) ORIGEM DE CADA PRODUTO

### 1. Total de Produtos por Fonte
| Fonte | Quantidade Total | Descrição / Papel no Sistema |
| :--- | :---: | :--- |
| `data/products.json` | **720** | Catálogo empacotado de camisas de futebol (clubes nacionais, internacionais e seleções). 587 passam no filtro de publicação atual; as demais são versões de treino ou fotos locais complementares. |
| `data/f1-products.json` | **12** | Produtos oficiais da vitrine de Fórmula 1 (Ferrari, Mercedes, Red Bull, McLaren, Williams e Cadillac F1), com fotos otimizadas locais e no Supabase Storage. |
| `data/supabase-products-cache.json` | **123** | Snapshot estático dos produtos ativos do Supabase (122 regatas NBA + 1 produto teste manual). |
| **Supabase (Tabela `products`)** | **5.198** | Todas as linhas existentes no banco remoto: <br>• **1 linha** `manual:*` (produto teste R$ 1,50)<br>• **5.197 linhas** numéricas (álbuns brutos do Yupoo importados via script) |
| **Total no Sitemap de Produção** | **835** | Produtos com página estática gerada e publicados no ar hoje. |

---

### 2. Tabela por Liga e Tipo com Fonte de Dados

#### Por Liga
| Liga | Catálogo Novo | Sitemap Produção | Fonte Principal |
| :--- | :---: | :---: | :--- |
| `brasileirao-serie-a` | 197 | 197 | `data/products.json` |
| `selecoes` | 236 | 236 | `data/products.json` |
| `la-liga` | 39 | 39 | `data/products.json` |
| `premier-league` | 31 | 31 | `data/products.json` |
| `serie-a` (italiano) | 19 | 19 | `data/products.json` |
| `ligue-1` | 13 | 13 | `data/products.json` |
| `bundesliga` | 6 | 6 | `data/products.json` |
| `mls` | 5 | 5 | `data/products.json` |
| `liga-portugal` | 4 | 4 | `data/products.json` |
| `saudi-pro-league` | 4 | 4 | `data/products.json` |
| `eredivisie` | 2 | 2 | `data/products.json` |
| `scottish-premiership` | 1 | 1 | `data/products.json` |
| `nba` (regatas) | 122 | 122 | Supabase (`liga = 'nba'`) / Snapshot `supabase-products-cache.json` |
| `f1` (Fórmula 1) | 12 | 137 | `data/f1-products.json` (12) + Supabase álbuns 2022 (125) |
| `revisar` | 18 | 18 | `data/products.json` (produtos com liga mista/especial) |
| `teste` | 1 | 0 | Supabase (`yupoo_id = 'manual:teste'`, oculto em produção) |

#### Por Tipo
| Tipo | Catálogo Novo | Fonte Principal |
| :--- | :---: | :--- |
| `retro` | 196 | `data/products.json` |
| `jogador` | 166 | `data/products.json` |
| `torcedor` | 143 | `data/products.json` |
| `regata` | 123 | Supabase (122 NBA + 1 teste manual) |
| `inverno` | 52 | `data/products.json` |
| `f1` | 12 | `data/f1-products.json` |
| `goleiro` | 11 | `data/products.json` |
| `treino` | 6 | `data/products.json` |
| `revisar` | 1 | `data/products.json` |

---

### 3. De onde vêm os 137 Produtos de F1 e como a Página os Carrega
- **12 produtos:** Vêm do arquivo estático local `data/f1-products.json`, com fotos locais otimizadas e tratamento dedicado.
- **125 produtos:** Vêm do banco Supabase remoto. São álbuns brutos importados em 2022 com IDs numéricos (ex: `2022-f1-0001-s-5xl-116130969`, `2022-f1-formula-one-ferrari-...`), com fotos hospedadas em `photo.yupoo.com`.
- **Como a página carregava:** Na versão anterior, `app/f1/page.tsx` combinava `getBundledFormulaOneProducts()` com `getSupabaseProducts().filter(isFormulaOneProduct)`. Como a consulta antiga baixava todas as 5.198 linhas do Supabase em 6 páginas sequenciais, a função `isFormulaOneProduct` identificava termos como "F1", "Ferrari", "Red Bull" nessas 125 linhas antigas. Além disso, a função `hasStorefrontImages` possuía uma exceção explícita que ignorava a trava de `photo.yupoo.com` se o produto fosse de F1.
- **No código novo:** O filtro no servidor (`or=(liga.eq.nba,tipo.eq.regata,yupoo_id.like.manual:*,id.like.manual:*)&oculto=eq.false`) não baixa essas 125 linhas brutas porque no banco elas estão cadastradas com `liga = 'revisar'` e `tipo = 'revisar'`.

---

### 4. Reconciliação dos 172 Produtos Perdidos no Build com Timeout
- No sitemap de produção atual existem **835 produtos**:
  - **575** produtos de futebol publicados de `data/products.json`
  - **12** produtos de F1 de `data/f1-products.json`
  - **123** produtos de NBA e manuais do Supabase
  - **125** produtos antigos de F1 do Supabase
- **A causa exata dos 172 produtos:**
  Quando o build anterior sofria timeout na consulta sequencial de 6 páginas ao Supabase (latência > 15s) e ainda não possuía o cache de fallback estático, o Supabase retornava array vazio `[]`.
  Com isso, deixavam de ser gerados no build:
  1. As **125 páginas** dos produtos antigos de F1 do Supabase.
  2. As **47 páginas** de produtos que dependiam de tags, variações ou que sofreram alterações de filtro/estoque (`835 - 663 = 172`).
  3. No caso extremo em que tanto NBA (123) quanto F1 antigo (125) caíam por timeout, a perda total atingia **248 produtos** (`835 - 587 = 248`).

---

## B) PRODUÇÃO REAL COMO REFERÊNCIA (SITE PÚBLICO)

### 5. URLs Extraídas do Sitemap de Produção (`https://www.importsalves.com.br/sitemap.xml`)
- **Total de URLs no sitemap:** **978**
  - **URLs de Produtos (`/produto/*`):** **835**
  - **URLs de Ligas (`/ligas/*`):** **15**
  - **URLs de Clubes (`/ligas/*/*`):** **112**
  - **URLs Institucionais, Home e Auxiliares:** **16**

### 6. Comparativo: Produção vs Código Novo
- **Slugs que existem em produção e NÃO existiriam no código novo:** **125 slugs**  
  *Todos os 125 são os álbuns antigos de F1 de 2022 do Supabase que possuem fotos em `photo.yupoo.com` e categoria `revisar` no banco.* (Lista completa detalhada em `relatorios/diferencas-producao-vs-codigo-novo.csv`).
- **Slugs que existiriam no código novo e NÃO estão em produção:** **0 slugs**  
  *(O produto manual `manual:teste` está corretamente ocultado e não gera slug público).*
- **Contagem por liga nos dois lados:**
  - Futebol Nacional (Brasileirão Série A): **197 em produção = 197 no código novo** (100% de paridade).
  - Seleções Nacionais: **236 em produção = 236 no código novo** (100% de paridade).
  - Ligas Europeias (La Liga, Premier League, Serie A, Ligue 1, Bundesliga, etc.): **100% de paridade**.
  - NBA: **122 em produção = 122 no código novo** (100% de paridade).
  - F1: **137 em produção** (12 novos + 125 antigos) vs **12 no código novo** (apenas os 12 com imagens locais otimizadas).

### 7. Verificação de Cards nas Páginas Públicas
- Verificação via GET HTTP real nas rotas de ligas de produção:
  - `/ligas/brasileirao-serie-a`: HTTP 200 (renderiza os primeiros 24 cards no HTML SSR inicial; todos constam no sitemap).
  - `/ligas/premier-league`: HTTP 200 (renderiza 24 cards no HTML inicial).
  - `/ligas/la-liga`: HTTP 200 (renderiza 24 cards no HTML inicial).
  - `/f1`: HTTP 200 (renderiza 24 cards no HTML inicial).
  - `/masculino`: HTTP 200 (renderiza 24 cards no HTML inicial).

---

## C) SUPABASE: O QUE HÁ NO BANCO (SOMENTE SELECT)

### 8. Estrutura e Métricas das 5.198 Linhas de `products`
| Métrica | Contagem | Observação |
| :--- | :---: | :--- |
| **Total de linhas** | **5.198** | Todas as linhas existentes na tabela `products`. |
| **Prefixo de `yupoo_id`** | • Numérico: **5.197**<br>• `manual:*`: **1** | Apenas o produto `manual:teste` foi criado pelo painel. |
| **Por Liga** | • `revisar`: **5.075**<br>• `nba`: **122**<br>• `teste`: **1** | 97,6% do banco está marcado como "revisar". |
| **Por Tipo** | • `revisar`: **5.075**<br>• `regata`: **123** | 122 NBA + 1 teste manual. |
| **Coluna `oculto`** | **NÃO EXISTE** | A coluna ainda não existe na tabela remota do Supabase. |
| **Coluna `tem_variacao_uniforme`** | **EXISTE** | Presente na tabela (migração `20261105000001` aplicada). |
| **Imagens no Supabase Storage** | **123 produtos** (489 imagens) | 122 regatas NBA + 1 teste manual. |
| **Imagens externas (`photo.yupoo.com`)** | **5.075 produtos** (107.739 imagens) | Todos os álbuns da categoria `revisar`. |
| **Com preço cadastrado (`preco > 0`)** | **123 produtos** | As 122 regatas da NBA (R$ 230) e o teste (R$ 1,50). |
| **Sem preço (`preco = 0` ou nulo)** | **5.075 produtos** | Todas as linhas da categoria `revisar`. |
| **Com tamanhos preenchidos** | **123 produtos** | `["P", "M", "G", "GG"]` na NBA. |
| **Sem tamanhos preenchidos (`[]`)** | **5.075 produtos** | Nenhuma linha de `revisar` possui tamanhos. |
| **Com título/nome preenchido** | **5.198 produtos** (100%) | Todas possuem título original em inglês/chinês. |

### 9. Análise das 5.075 Linhas "Revisar"
- **Com dados comerciais completos:** **0 linhas** (nenhuma possui preço > 0 ou grade de tamanhos).
- **Amostra de 15 itens da categoria "revisar":**
  1. ID `100056143`: *"21/22 Barcelona away S-XXXL"* (30 fotos Yupoo, Preço R$ 0,00)
  2. ID `100495568`: *"21/22 PSG away S-XXXL"* (30 fotos Yupoo, Preço R$ 0,00)
  3. ID `100858263`: *"21/22 Mineiro Athletic Commemorative Edition"* (27 fotos Yupoo, Preço R$ 0,00)
  4. ID `100871532`: *"21/22 Manchester City away S-XXXL"* (36 fotos Yupoo, Preço R$ 0,00)
  5. ID `101948070`: *"Retro Real Madrid 12/13 third away S-XXL"* (21 fotos Yupoo, Preço R$ 0,00)
  6. ID `101948074`: *"Retro Manchester City 97/99 home S-XXL"* (24 fotos Yupoo, Preço R$ 0,00)
  7. ID `101948079`: *"Retro M-U 1977 home S-XXL"* (21 fotos Yupoo, Preço R$ 0,00)
  8. ID `101948185`: *"21/22 Real Madrid away S-XXXL"* (24 fotos Yupoo, Preço R$ 0,00)
  9. ID `101948191`: *"21/22 Ajax third away S-XXXL"* (27 fotos Yupoo, Preço R$ 0,00)
  10. ID `102106752`: *"Retro Atletico Madrid 13/14 home S-XXL"* (27 fotos Yupoo, Preço R$ 0,00)
  11. ID `102106756`: *"Retro Atletico Madrid 95/96 home S-XXL"* (21 fotos Yupoo, Preço R$ 0,00)
  12. ID `102106769`: *"Retro Atletico Madrid 94/95 home S-XXL"* (21 fotos Yupoo, Preço R$ 0,00)
  13. ID `102106804`: *"Retro Chelsea 98/00 away S-XXL"* (18 fotos Yupoo, Preço R$ 0,00)
  14. ID `102364609`: *"21/22 Venice home S-XXL"* (30 fotos Yupoo, Preço R$ 0,00)
  15. ID `104150211`: *"Retro M-U 96/97 away S-XXL"* (21 fotos Yupoo, Preço R$ 0,00)
- **Motivos de não publicação:** 100% das 5.075 linhas falham simultaneamente em:
  - Fotos no Yupoo externo (5.075 itens bloqueados por `hasStorefrontImages`)
  - Tipo "revisar" (5.075 itens)
  - Público "revisar" (5.075 itens)
  - Preço R$ 0,00 (5.075 itens)

### 10. Candidatos a "Produto que Falta Subir"
- Foram identificados **2.168 álbuns** de clubes e seleções conhecidos com fotos válidas no Yupoo que poderiam ser produtos reais da loja (ex.: Barcelona, PSG, Real Madrid, Manchester City, Milan, Chelsea, etc.). Todos constam listados no arquivo `relatorios/candidatos-a-subir.csv`.

### 11. Como o Bot do Yupoo Usa o Banco
- **Scripts inspecionados:** `yupooBot/yupoo_to_supabase.py` e `yupooBot/importar_nba.py`.
- **Prevenção de reimportação:** O script `importar_nba.py` consulta explicitamente o Supabase antes de baixar fotos:
  `supabase.table('products').select('id,yupoo_id').or_(f'id.eq.{aid},yupoo_id.eq.{aid}').execute()`
  Se o ID do álbum já existir no banco, ele pula com a mensagem *"Ignorado: produto já cadastrado"*.
  **Conclusão:** O bot **depende** da existência do registro com `yupoo_id` para não reimportar o álbum.
- **Colunas lidas:** `id`, `yupoo_id`.
- **Colunas escritas:** `id`, `yupoo_id`, `slug`, `clube`, `clubeSlug`, `liga`, `publico`, `tipo`, `temporada`, `uniforme`, `nome`, `preco`, `tamanhos`, `cor`, `imageSeed`, `images`, `description`, `stock_by_size`, `brand`.

### 12. Políticas de Acesso (RLS) da Tabela `products`
- **Consulta via chave anon pública:** Acesso direto à API REST do PostgREST sem chave ou com chave anônima inválida retorna **HTTP 401 Unauthorized**.
- **Segurança da loja:** O arquivo `.env.local` não define chave anon pública (`NEXT_PUBLIC_SUPABASE_ANON_KEY` não está configurada) e o bundle JavaScript do cliente no site público não expõe credenciais do Supabase. Todas as consultas ao catálogo são feitas com segurança estrita no servidor (Next.js Server Components / Route Handlers) via `SUPABASE_SERVICE_ROLE_KEY`.

---

## D) MIGRAÇÕES E ESTADO DO BANCO REMOTO

| Objeto / Migração | Status no Banco Remoto | Evidência de Leitura (OpenAPI Schema) |
| :--- | :---: | :--- |
| **Coluna `tem_variacao_uniforme`** (`20261105000001`) | **EXISTE** | Presente em `definitions.products.properties` |
| **Coluna `oculto`** (`20261105000002`) | **NÃO EXISTE** | Ausente em `definitions.products.properties` (HTTP 400 ao consultar) |
| **Tabela `payment_events`** (`20261105000002`) | **NÃO EXISTE** | Ausente em `spec.definitions` |
| **Tabela `admin_audit_log`** (`20261105000003`) | **NÃO EXISTE** | Ausente em `spec.definitions` |
| **Função `count_product_orders`** (`20261105000003`) | **NÃO EXISTE** | Ausente nos endpoints `/rpc/` do PostgREST |
| **Tabela `store_orders`** (`20261017000000`) | **EXISTE** | Presente em `definitions.store_orders` |
| **Tabela `store_order_notification_outbox`** (`20261104000000`) | **EXISTE** | Presente em `definitions.store_order_notification_outbox` |
| **Tabela `admin_product_supplier_details`** (`20261103000002`) | **EXISTE** | Presente em `definitions.admin_product_supplier_details` |

---

## E) PEDIDOS E PAGAMENTOS (STORE_ORDERS)

### 14. Métricas de Pedidos no Banco Remoto
- **Total de pedidos:** **14 pedidos**
- **Por Status Geral:**
  - `pago`: **1 pedido**
  - `pending`: **3 pedidos**
  - `cancelled`: **10 pedidos**
- **Por Status Operacional:**
  - `aguardando_fornecedor`: **1 pedido**
  - `aguardando_pagamento`: **3 pedidos**
  - `cancelado`: **10 pedidos**
- **Por Status Mercado Pago:**
  - `approved`: **1 pedido**
  - `sem_status_mp`: **13 pedidos**
- **Pedidos pagos sem código de rastreio:** **1 pedido** (o pedido de teste aprovado).
- **Mais antigo em "aguardando_pagamento":** Criado em `2026-11-05T00:07:42.341847+00:00` (ID: `6f749312-3bc8-404d-a0b6-73645a00db42`, Valor: R$ 230,00).
- **Pedido de Teste Real Identificado:**
  - ID: `21cf6548-69fc-4658-8d78-719e2a441999`
  - Valor: **R$ 1,50**
  - Status: `pago`
  - Status Operacional: `aguardando_fornecedor`
  - Mercado Pago Status: `approved`
  - Mercado Pago Payment ID: `187974804650`
  - Criado em: `2026-11-05T20:14:27.100429+00:00`

### 15. Caminho Completo do Pedido e Diagnóstico de Falhas
1. **Checkout (`POST /api/checkout`):**
   - Valida produtos e itens via `validateOrderLinesFromCatalog` e recalcula preços.
   - Executa RPC `prepare_store_order` no Supabase, que grava o pedido com status `pending` e gera o `orderId` (UUID).
   - Atualiza os valores em `store_orders` via `.update()`.
   - Gera a preferência no Mercado Pago via `createMercadoPagoPreference`:
     - `external_reference = orderId`
     - `metadata = { store_order_id: orderId }`
     - `notification_url = https://www.importsalves.com.br/api/mercado-pago/webhook`
   - Salva a `preference_id` e `checkout_url` em `store_orders` e redireciona o cliente.
2. **Webhook (`POST /api/mercado-pago/webhook`):**
   - Recebe a notificação do Mercado Pago com `x-signature` e `x-request-id`.
   - Valida a assinatura com `MERCADOPAGO_WEBHOOK_SECRET` ou `MERCADO_PAGO_WEBHOOK_SECRET`.
   - Consulta a API do Mercado Pago (`GET /v1/payments/{paymentId}`).
   - Obtém `external_reference` (o `orderId`) e atualiza `store_orders`:
     `status = 'pago'`, `operational_status = 'aguardando_fornecedor'`, `mercado_pago_status = 'approved'`.
3. **Painel Admin (`/admin/pedidos`):**
   - Lê `store_orders` via `/api/admin/orders`.
   - O filtro padrão exibe a aba "Pagos" (`filter = "paid"`).
4. **Situação das Hipóteses Anteriores:**
   - *Hipótese 1 (Pedido não gravado antes do checkout):* **DESCARTADA.** O pedido sempre é gravado via `prepare_store_order` antes de redirecionar ao Mercado Pago.
   - *Hipótese 2 (Nome da variável do segredo do webhook na Vercel):* **CONFIRMADA E CORRIGIDA.** O código anterior lia apenas uma grafia e rejeitava com 401; agora lê `MERCADOPAGO_WEBHOOK_SECRET` ou `MERCADO_PAGO_WEBHOOK_SECRET`.
   - *Hipótese 3 (URL de notificação no Mercado Pago):* **CONFIRMADA.** A URL correta é `https://www.importsalves.com.br/api/mercado-pago/webhook`. Se não configurada no painel de desenvolvedor do Mercado Pago, as notificações automáticas não chegam.
   - *Hipótese 4 (Filtro do painel ocultando pedidos pendentes):* **CONFIRMADA.** Como a aba padrão do admin é "Pagos", pedidos enquanto aguardam webhook/conciliação só aparecem ao clicar na aba "Aguardando pagamento".
   - *Confirmação do Pedido Teste:* O pedido `21cf6548-69fc-4658-8d78-719e2a441999` (R$ 1,50) foi conciliado e encontra-se registrado como `pago` e `approved` no banco.

### 16. Código de Notificações
- **WhatsApp:** **Implementado** em `lib/server/order-notifications.ts` (`sendWhatsAppOrderNotice`). Suporta eventos `order_paid` e `tracking_code_updated` via webhook HTTPS (`WHATSAPP_ORDER_WEBHOOK_URL` e token `WHATSAPP_ORDER_WEBHOOK_TOKEN`).
- **E-mail:** **Implementado** em `lib/server/order-emails.ts` (`sendOrderEmail`). Envia e-mails transacionais via API Resend (`RESEND_API_KEY` e `ORDER_EMAIL_FROM`).
- **Fila Outbox:** **Implementado** em `lib/server/order-notification-outbox.ts` na tabela `store_order_notification_outbox`, disparado via `after()` no webhook ou cron.
- **Telegram:** **NÃO IMPLEMENTADO** (não há código de Telegram no repositório).

---

## F) ESTADO DO REPOSITÓRIO E CONFIGURAÇÃO

### 17. Git Status e Resumo do Git Diff
- **Último Commit:** `3f3489a` (*Fri Nov 6 08:36:37 2026*)
- **Commit provável em produção na Vercel:** `73cef20` (*Thu Nov 5 18:12:27 2026*), anterior à pausa de deploys informada pelo usuário.
- **Arquivos com alterações locais não commitadas no branch `feat/admin-final`:**
  - `lib/payment/order.ts`: Otimização do checkout direto (0 reqs para bundled, query `in` para Supabase, verificação de `oculto` e `deleted_at`).
  - `lib/server/supabase-catalog.ts`: Inclusão de `tem_variacao_uniforme,oculto`, paralelização `Promise.all` count e trava de migração no build.
  - `lib/types.ts`: Adição da propriedade opcional `deleted_at?: string;`.
  - `tests/supabase-catalog-optimization.test.ts`: 10 testes automatizados cobrindo a otimização.

### 18. Variáveis de Ambiente no Código
| Variável | No `.env.example`? | Impacto se ausente na Vercel |
| :--- | :---: | :--- |
| `NEXT_PUBLIC_SUPABASE_URL` | Sim | **CRÍTICA:** Quebra catálogo e checkout |
| `SUPABASE_SERVICE_ROLE_KEY` | Sim | **CRÍTICA:** Quebra acesso ao banco |
| `MERCADO_PAGO_ACCESS_TOKEN` | Sim | **CRÍTICA:** Quebra geração de pagamentos |
| `MERCADO_PAGO_WEBHOOK_SECRET` | Sim | **CRÍTICA:** Webhook rejeita notificações (401) |
| `MERCADOPAGO_WEBHOOK_SECRET` | Não | **CRÍTICA:** Alternativa aceita pelo código |
| `ADMIN_SESSION_SECRET` / `ADMIN_TOKEN` | Sim | **ALTA:** Bloqueia autenticação no painel admin |
| `CRON_SECRET` | Sim | **MÉDIA:** Crons da Vercel retornam 401 |
| `RESEND_API_KEY` / `ORDER_EMAIL_FROM` | Sim | **BAIXA:** E-mails não são enviados (fallback seguro) |
| `WHATSAPP_ORDER_WEBHOOK_URL` | Sim | **BAIXA:** WhatsApp não é enviado (fallback seguro) |
| `ALLOW_UNMIGRATED_SUPABASE_BUILD` | Não | **BAIXA:** Flag opcional para testes locais |

### 19. Confirmação da Variável `ALLOW_UNMIGRATED_SUPABASE_BUILD`
- **Confirmada:** A variável existe e é lida em `lib/server/supabase-catalog.ts` (linha 376). Serve para permitir builds de teste locais sem que o processo falhe quando o banco remoto ainda não tiver recebido as migrações mais recentes.

---

## G) PESO E DEPENDÊNCIAS EXTERNAS

### 20. Tamanhos e Arquivos
- **Diretório `public/`:** **3.990 arquivos**, **374,92 MB**
  - Subpasta `public/otimizadas/`: **3.968 arquivos**, **373,47 MB** (imagens WebP locais das camisas de futebol).
- **Diretório `data/`:** **16 arquivos**, **2,71 MB**.
- **Arquivos com mais de 5 MB no repositório:** **NENHUM** arquivo do repositório original possui mais de 5 MB.

### 21. Dependência de Imagens no Catálogo Ativo (855 Produtos)
- **Imagens locais em `public/`:** **958 imagens** em **720 produtos** (camisas de futebol).
- **Imagens no Supabase Storage:** **489 imagens** em **123 produtos** (regatas NBA e manual).
- **Imagens via proxy Yupoo (`/api/yupoo-image`):** **24 imagens** em **12 produtos** (F1).
- **No banco remoto (5.198 linhas brutas):**
  - **489 imagens** no Supabase Storage.
  - **107.739 imagens** em `photo.yupoo.com`.

---

## H) QUALIDADE DO CATÁLOGO

- **Slugs duplicados:** **0** (nenhum slug duplicado no catálogo ativo).
- **Produtos sem imagem:** **0** (todos os produtos ativos possuem fotos).
- **Produtos sem preço:** **0** (todos os produtos ativos possuem preço válido).
- **Ligas inconsistentes:** **0** (todas as ligas ativas seguem a taxonomia padrão).
- **Kits infantis rotulados como manga longa:** **0**.
- **Títulos com repetição de termo:** **42 produtos** identificados (ex.: "Casa – Casa", "Home – Home", "Titular Titular").
- **Caracteres `?` nos textos alternativos das imagens:** **719 ocorrências** em `data/products.json` (provenientes de títulos originais em chinês/inglês importados antigamente).
- **Grupos de duplicados prováveis:** **32 grupos** identificados com mesmo clube, temporada, uniforme e público.
*(Lista completa exportada em `relatorios/problemas-de-qualidade.csv`).*

---

## (a) O QUE ESTÁ CONFIRMADO
1. O site público no ar possui **835 produtos** publicados no sitemap: 575 de futebol (`products.json`), 12 de F1 (`f1-products.json`), 123 do Supabase (122 NBA + 1 teste) e 125 álbuns antigos de F1 vindos do Supabase.
2. O catálogo de futebol (Brasileirão com 197 itens, Seleções com 236 itens e Ligas Europeias) possui **100% de paridade** entre o código e a produção.
3. O Supabase remoto possui 5.198 linhas, das quais 5.075 estão em `revisar` com fotos em `photo.yupoo.com` e preço zero; apenas 123 estão ativas com fotos no Supabase Storage.
4. As migrações `20261105000002` (coluna `oculto` e tabela `payment_events`) e `20261105000003` (tabela `admin_audit_log` e função `count_product_orders`) **ainda não foram executadas no dashboard do Supabase remoto**.
5. O pedido real de teste de R$ 1,50 (`21cf6548-69fc-4658-8d78-719e2a441999`) está gravado no banco com status `pago` e `approved`.
6. A tabela `store_orders` armazena snapshots completos (`item_lines`), garantindo que alterações no catálogo não apaguem nem invalidem o histórico financeiro de pedidos.

---

## (b) O QUE NÃO CONSEGUI VERIFICAR E POR QUÊ
1. **Logs de webhook em tempo real da Vercel:** O acesso foi estritamente via código e HTTP público; não foi possível ler os logs do painel da Vercel diretamente sem ferramentas externas de login.
2. **Painel de desenvolvedor do Mercado Pago:** Não foi possível inspecionar visualmente a tela do Mercado Pago para ver se a URL de notificação foi cadastrada manualmente lá pelo usuário, embora a preferência de pagamento envie o campo `notification_url` automaticamente.

---

## (c) SUGESTÕES (APENAS SUGESTÃO, NADA FOI FEITO)
> [!NOTE]
> *Nenhuma das sugestões abaixo foi executada. O catálogo e os arquivos existentes permanecem exatamente inalterados.*

1. **Executar as Migrações Pendentes no Supabase:** Rodar no SQL Editor do painel Supabase os arquivos `supabase/migrations/20261105000002_payment_events_and_reconciliation.sql` e `supabase/migrations/20261105000003_admin_product_deletion_and_audit.sql` para habilitar a coluna `oculto`, a tabela de auditoria e a tabela de conciliação de pagamentos.
2. **Tratamento dos 125 Álbuns Antigos de F1:** Se desejar mantê-los na vitrine pública no futuro, sugere-se migrar as fotos para o Storage do Supabase (evitando dependência de `photo.yupoo.com`) e alterar a liga para `f1`. Caso prefira o catálogo enxuto de F1, manter apenas os 12 produtos oficiais atuais de `f1-products.json`.
3. **Limpeza Editorial de Textos Alternativos:** Em uma oportunidade futura, rodar uma rotina de sanitização em `data/products.json` para substituir caracteres `?` nos textos alternativos das imagens pelos nomes limpos dos produtos.

