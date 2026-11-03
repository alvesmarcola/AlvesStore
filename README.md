# Alves Store

Loja de camisas de futebol feita com Next.js 15, TypeScript, Zustand, Supabase e Mercado Pago Checkout Pro.

## Preços e frete

`config.ts` define os pacotes das camisas comuns (R$ 160,00 / R$ 300,00 / R$ 450,00), retro manga curta por R$ 185,00, retro manga longa por R$ 220,00, jogador por R$ 190,00 (manga longa R$ 220,00) e torcedor full patch por R$ 180,00. Camisas de Fórmula 1 não têm personalização. Personalizacao adiciona R$ 20,00 por camisa.

O frete é calculado pelo servidor pela quantidade total de unidades de todas as linhas do pedido: uma ou duas camisas R$ 20,00 e três ou mais grátis. O navegador não envia preço ou escolha de frete. O valor salvo no pedido, enviado ao Checkout Pro e conferido no webhook é recalculado no servidor.

## Variáveis de ambiente

Configure as variáveis abaixo na Vercel para o ambiente desejado. Defina `PAYMENT_ENVIRONMENT=test` ou `production` de acordo com a credencial e a conta Mercado Pago usadas. O prefixo `APP_USR-` sozinho não distingue produção de teste: a documentação oficial também usa esse prefixo nos Access Tokens de contas de teste do Checkout Pro.

- `PAYMENT_ENVIRONMENT=test` ou `production`
- `MERCADO_PAGO_ACCESS_TOKEN`
- `MERCADO_PAGO_WEBHOOK_SECRET`
- `SUPABASE_URL` (ou `NEXT_PUBLIC_SUPABASE_URL`)
- `SUPABASE_SECRET_KEY` (preferível) ou `SUPABASE_SERVICE_ROLE_KEY`; somente no servidor.
- `SITE_URL` (origem pública HTTPS, por exemplo `https://alves-store-green.vercel.app`)
- `ADMIN_ORDERS_TOKEN` (token forte e privado para `/admin/pedidos`)
- `WHATSAPP_ORDER_WEBHOOK_URL` (URL HTTPS do provedor/automação conectado à API WhatsApp Business)
- `WHATSAPP_ORDER_WEBHOOK_TOKEN` (opcional, token Bearer para autenticar o webhook)
- Opcional: `RESEND_API_KEY` e `ORDER_EMAIL_FROM` para e-mail de pagamento aprovado

Para a gestão administrativa, mantenha configurada a credencial privada do Supabase (`SUPABASE_SECRET_KEY` ou `SUPABASE_SERVICE_ROLE_KEY`). Em uma instalação existente, aplique as migrações ainda pendentes, em ordem: `20261103000000_post_sale_order_status.sql`, `20261103000001_manual_product_fields.sql` e `20261103000002_order_operations_finance.sql`. Elas são aditivas; não recriam nem apagam pedidos ou produtos. O catálogo e o bucket públicos de fotos já usados pela importação permanecem os mesmos.

### Ativar pagamentos de produção

1. No Mercado Pago, obtenha o Access Token de produção `APP_USR-` e configure `PAYMENT_ENVIRONMENT=production` e `MERCADO_PAGO_ACCESS_TOKEN` no ambiente Production da Vercel. Não configure o token `TEST-` nesse ambiente.
2. Cadastre no painel do Mercado Pago a URL `https://alves-store-green.vercel.app/api/webhooks/mercadopago` para notificações de pagamento. Copie a chave secreta de assinatura do webhook de produção para `MERCADO_PAGO_WEBHOOK_SECRET`.
3. Em um banco novo, aplique as migrações em ordem. Em um banco já existente, aplique somente as migrações ainda não aplicadas, sem recriar tabelas nem reexecutar migrações anteriores. Configure também a chave secreta do Supabase no ambiente Production da Vercel.
4. Faça Redeploy de Production na Vercel e valide com uma compra real controlada. O checkout redireciona para `init_point` e usa `sandbox_init_point` apenas como fallback se o primeiro não vier; o webhook recusa pagamentos com `live_mode` incompatível.

## Banco de pedidos

Os pedidos ficam em `store_orders` e os pagamentos em `store_order_payments` no Supabase. `status` e `mercado_pago_status` continuam descrevendo a situação financeira compatível com os registros antigos; `operational_status` guarda separadamente o fluxo `aguardando_pagamento`, `pagamento_aprovado`, `aguardando_fornecedor`, `pedido_realizado`, `em_preparacao`, `enviado` e `cancelado`. O webhook só promove o andamento operacional de pedidos novos/ainda aguardando pagamento para `aguardando_fornecedor`, sem substituir uma escolha operacional já feita. A migração adiciona os novos campos sem reescrever ou apagar pedidos existentes.

## Operação

- `/admin` exibe a visão geral. A navegação também oferece `/admin/pedidos`, `/admin/produtos`, `/admin/fornecedores`, `/admin/financeiro` e `/admin/configuracoes`; as APIs administrativas exigem `ADMIN_ORDERS_TOKEN` no cabeçalho `Authorization`.
- O dashboard separa faturamento aprovado, gastos registrados e lucro estimado. Os indicadores financeiros abrangem todos os pedidos; as tabelas de pedidos recentes mostram até 300. Os valores do fornecedor, frete e demais despesas são preenchidos manualmente e não são presumidos.
- `/admin/produtos` permite criar e editar produtos manuais, fotos, descrição, marca, categoria, preço, custo e fornecedor padrão, além de estoque informativo por tamanho. Os produtos manuais são gravados na tabela `products` existente e entram na mesma vitrine/busca/checkout; produtos importados ficam fora da edição manual. Custos/fornecedores são mantidos em `admin_product_supplier_details`, sem leitura pública. Estoque não é reservado, validado nem descontado no checkout.
- `/admin/pedidos` exibe dados de compra e pagamento, tamanho/quantidade, endereço e andamento operacional. Nos detalhes, registre fornecedor, solicitação, custos e observações internas. Salvar código/link de rastreamento não altera o status; use separadamente “Marcar como enviado” para atualizar `operational_status` e a data de envio. O aviso WhatsApp/e-mail de despacho só é tentado nessa ação; WhatsApp exige opt-in do cliente e provedor configurado. `/rastreio` continua disponível para consultas do comprador.
- `/admin/fornecedores` consolida nomes de fornecedores registrados em produtos e pedidos. `/admin/financeiro` apresenta faturamento e custos separados. `/admin/configuracoes` apenas indica se variáveis necessárias estão presentes; não valida as credenciais nem confirma disponibilidade dos provedores.
- E-mails de pagamento aprovado são opcionais. Configure Resend e um remetente verificado; falhas são registradas no log e não alteram a confirmação do pagamento.
- O limite de checkout é de 15 requisições por IP em dez minutos, mantido em memória por instância. Para múltiplas instâncias, substitua por armazenamento compartilhado antes de depender dele como controle distribuído.

## Desenvolvimento e validação

- `npm run dev`
- `npm run typecheck`
- `npm run lint`
- `npm test`
- `npm run build`

Antes da publicação, o responsável pela loja deve completar os itens `TODO(dono)` nas páginas institucionais, como razão social, CNPJ, endereço, WhatsApp, prazo real e canais de privacidade e devolução. O conteúdo jurídico precisa ser revisado para a operação concreta da loja.
## Catálogo, preços e patches

A busca interpreta termos locais em português e inglês, abreviações de uniforme, versão, manga e temporada. Não usa IA nem serviço externo; quando a versão não está confirmada, mostra alternativas sem afirmar que são o modelo exato.

Preços classificados: torcedor comum R$ 160,00; torcedor full patch R$ 180,00; retrô manga curta R$ 185,00; retrô manga longa R$ 220,00; jogador R$ 190,00; jogador manga longa R$ 220,00. Versões sem preço confirmado aparecem para revisão e não podem seguir para pagamento. Corrija a classificação em `data/product-overrides.json`, registrando fonte e responsável. O comando local `npm run catalog:override -- <product-id-ou-slug> --version retro --sleeve long --price 220 --source URL --verified-by Nome` registra uma correção; revise o JSON e publique um deploy para ativá-la.

Patches de competição ficam em `data/patches.ts` e custam R$ 10,00 cada, por camisa (`patchPrice` em `config.ts`). Hoje: Brasileirão, Copa do Brasil, Libertadores, Champions League e Campeão do Mundo. Cada patch só aparece para as ligas (`leagueSlugs`) ou clubes/seleções (`clubSlugs`) listados nele, e nunca em camisas retrô ou de Fórmula 1. O cliente marca quantos quiser na página do produto; a escolha vai para o carrinho, é revalidada no servidor (preço, compatibilidade e posição) e fica gravada em `item_lines` do pedido, visível no painel `/admin/pedidos`. Para adicionar um patch novo, inclua um item em `patchOptions`.

## Pedidos, rastreio e WhatsApp

Os pedidos desta aplicação são armazenados em `store_orders` e `store_order_payments` no Supabase. A API usa uma chave privada apenas no servidor; a tabela aplica RLS e não concede acesso público. O painel `/admin` contém a visão geral e a navegação para pedidos, produtos, fornecedores, financeiro e configurações. Use o valor privado de `ADMIN_ORDERS_TOKEN` quando solicitado.

O webhook autenticado do Mercado Pago atualiza a situação financeira do pedido e registra o método de pagamento quando disponível. Para mensagens WhatsApp, configure `WHATSAPP_ORDER_WEBHOOK_URL` com um endpoint HTTPS de automação/provedor ligado à API WhatsApp Business; `WHATSAPP_ORDER_WEBHOOK_TOKEN` é opcional e enviado como Bearer. A confirmação do pagamento e o aviso de despacho só são enviados ao telefone do cliente se ele autorizou atualizações pelo WhatsApp no checkout. O aviso de despacho ocorre ao marcar o pedido como enviado, não ao salvar o código de rastreio. Se o provedor falhar após a aprovação, o webhook responde com erro para permitir nova tentativa do Mercado Pago. O despacho também envia e-mail de rastreio quando Resend está configurado.

Mensagens iniciadas pela empresa dependem da configuração do provedor, do opt-in do cliente e dos modelos aprovados aplicáveis na plataforma WhatsApp. Configure as credenciais/templates no provedor: a aplicação não pode criar credenciais do WhatsApp Business por conta própria. O cliente acompanha o pedido em `/rastreio` usando o código do pedido e e-mail ou CPF.
