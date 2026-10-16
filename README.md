# Alves Store

Loja de camisas de futebol feita com Next.js 15, TypeScript, Zustand, Neon/PostgreSQL e Mercado Pago Checkout Pro.

## Preços e frete

`config.ts` define os pacotes das camisas comuns (R$ 160,00 / R$ 300,00 / R$ 450,00), retro manga curta por R$ 185,00, retro manga longa por R$ 220,00 e torcedor full patch por R$ 180,00. Personalizacao adiciona R$ 20,00 por camisa.

O frete é calculado pelo servidor pela quantidade total de unidades de todas as linhas do pedido: uma camisa R$ 20,00, duas R$ 30,00 e três ou mais grátis. O navegador não envia preço ou escolha de frete. O valor salvo no pedido, enviado ao Checkout Pro e conferido no webhook é recalculado no servidor.

## Variáveis de ambiente

Configure as variáveis abaixo na Vercel para o ambiente desejado. `PAYMENT_ENVIRONMENT` e o prefixo do token precisam corresponder: `test` requer `TEST-`; `production` requer `APP_USR-`. O backend nunca aceita combinação cruzada.

- `PAYMENT_ENVIRONMENT=test` ou `production`
- `MERCADO_PAGO_ACCESS_TOKEN`
- `MERCADO_PAGO_WEBHOOK_SECRET`
- `DATABASE_URL`
- `SITE_URL` (origem pública HTTPS, por exemplo `https://alves-store-green.vercel.app`)
- `ADMIN_ORDERS_TOKEN` (token forte e privado para `/admin/pedidos`)
- Opcional: `RESEND_API_KEY` e `ORDER_EMAIL_FROM` para e-mail de pagamento aprovado

### Ativar pagamentos de produção

1. No Mercado Pago, obtenha o Access Token de produção `APP_USR-` e configure `PAYMENT_ENVIRONMENT=production` e `MERCADO_PAGO_ACCESS_TOKEN` no ambiente Production da Vercel. Não configure o token `TEST-` nesse ambiente.
2. Cadastre no painel do Mercado Pago a URL `https://alves-store-green.vercel.app/api/mercado-pago/webhook` para notificações de pagamento. Copie a chave secreta de assinatura do webhook de produção para `MERCADO_PAGO_WEBHOOK_SECRET`.
3. Confirme `DATABASE_URL` e aplique as migrações ao banco de produção: `npm run db:migrate`.
4. Faça Redeploy de Production na Vercel e valide com uma compra real controlada. O checkout escolhe `init_point` em produção e `sandbox_init_point` em teste; o webhook recusa pagamentos com `live_mode` incompatível.

## Banco de pedidos

Execute `npm run db:migrate` com `DATABASE_URL` apontando ao banco. A ordem e `001_store_orders.sql`, `002_order_tracking.sql` e `003_order_patches.sql`; as migracoes usam `IF NOT EXISTS` e podem ser reaplicadas.

## Operação

- `/admin` redireciona para `/admin/pedidos`, protegido por `ADMIN_ORDERS_TOKEN`; o painel lista os 200 pedidos mais recentes e exporta CSV. O token segue no cabeçalho `Authorization` para a API, nunca em variáveis públicas ou links.
- Salve o código de rastreio no botão do pedido. `/rastreio` consulta por código do pedido e e-mail ou CPF.
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

Preços classificados: torcedor comum R$ 160,00; torcedor full patch R$ 180,00; retrô manga curta R$ 185,00; retrô manga longa R$ 220,00. Versões sem preço confirmado aparecem para revisão e não podem seguir para pagamento. Corrija a classificação em `data/product-overrides.json`, registrando fonte e responsável. O comando local `npm run catalog:override -- <product-id-ou-slug> --version retro --sleeve long --price 220 --source URL --verified-by Nome` registra uma correção; revise o JSON e publique um deploy para ativá-la.

Patches só aparecem quando `data/patches.ts` registra imagem, preço, fonte, temporada, produto compatível, posições confirmadas e disponibilidade comercial. A lista começa vazia porque o catálogo atual não confirma estoque/venda nem compatibilidade desses itens. Não inclua uma opção até verificar essas informações.

## Pedidos, rastreio e WhatsApp

Os pedidos desta aplicação são armazenados em `store_orders` no PostgreSQL configurado por `DATABASE_URL` (Neon no setup atual). O painel `/admin` redireciona para `/admin/pedidos`; use o valor privado de `ADMIN_ORDERS_TOKEN` quando solicitado. O painel lista os 200 pedidos mais recentes e permite atualizar o código de rastreio. Isso não usa uma tabela Supabase `orders`.

O webhook autenticado do Mercado Pago envia o evento `order_paid` ao endereço HTTPS configurado em `WHATSAPP_ORDER_WEBHOOK_URL` quando o pagamento muda para aprovado. O destinatário administrativo é `WHATSAPP_ORDER_RECIPIENT` (número internacional, somente dígitos); o payload inclui nome, contato, endereço, itens, valores e status. `WHATSAPP_ORDER_WEBHOOK_TOKEN` é opcional e enviado como Bearer. Configure esse endpoint numa automação/provedor que tenha acesso à API WhatsApp Business; sem URL/destinatário, nenhum envio é feito. O cadastro do código gera também os eventos `tracking_code_updated` para o cliente, por e-mail quando Resend está configurado e por WhatsApp somente se ele marcou o consentimento opcional no checkout.

Mensagens iniciadas pela empresa dependem da configuração do provedor, do opt-in do cliente e dos modelos aprovados aplicáveis na plataforma WhatsApp. O FAQ `/duvidas` descreve o envio internacional e informa que o código oficial é enviado em até 3 a 4 dias úteis após a confirmação do pagamento. O cliente acompanha o pedido em `/rastreio` usando o código do pedido e e-mail ou CPF.
