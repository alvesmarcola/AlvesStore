# alves store

Loja de camisas de futebol com Next.js App Router, TypeScript, Tailwind CSS, Framer Motion, Zustand, React Hook Form e Zod. O login permanece demonstrativo. O checkout integra o Mercado Pago Checkout Pro exclusivamente em modo de teste e exige banco de pedidos e credenciais de servidor configurados.

## Requisitos e execução

- Node.js 20.9 ou superior
- npm

```bash
npm install
npm run dev
```

Acesse [http://localhost:3000](http://localhost:3000).

## Organização

- `app/`: rotas do App Router, metadata e sitemap.
- `components/`: header, menus, cards e grades de produto, filtros, footer, consentimento e formulários compartilhados.
- `config.ts`: nome da loja e preços confirmados dos pacotes, camisas, personalização e limite de frete grátis.
- `data/products.json`: catálogo gerado a partir das imagens locais, com as fotos de cada produto.
- `data/categories.json`: públicos e subcategorias.
- `data/leagues.json`: competições, participantes, temporada, cores, slots de capa e fontes consultadas.
- `data/images.ts`: registro central dos slots temáticos; `data/catalogo-imagens.json` guarda as fotos locais escolhidas para cada slot.
- `data/catalogo-revisao.csv`: atributos não deduzidos com segurança para correção manual.
- `data/catalogo-origem.json`: origem, fornecedor e autorização por lote de imagens.
- `scripts/catalogar-imagens.ts`: catalogação e otimização local das fotos.
- `public/catalogo/`: imagens originais fornecidas no projeto; o script não as altera.
- `public/otimizadas/`: versões WebP derivadas em 400, 800 e 1600 px.
- `lib/types.ts`: modelos TypeScript do catálogo e sacola.
- `lib/catalog.ts`: consulta, formatação de preço e helpers de imagem.
- `components/motion-effects.tsx` e `app/globals.css`: animações Framer Motion/CSS e suporte a movimento reduzido.
- `lib/commerce.ts`: regras de cálculo do carrinho.
- `lib/validation.ts`: schemas Zod, incluindo validação do CPF.
- `store/cart.ts`: estado Zustand da sacola persistido no localStorage.
- `tailwind.config.ts` e `app/globals.css`: tokens de cor e tipografia.

## Como personalizar

- **Produtos:** edite `data/products.json`. Mantenha o `slug` único e relacione `liga` e `clubeSlug` aos slugs em `data/leagues.json`. Campos `publico`, `tipo`, `temporada` e `uniforme` controlam onde o item aparece e os filtros. `estoque` igual a zero exibe item esgotado; `esgotados` marca tamanhos indisponíveis.
- **Ligas e clubes:** atualize `data/leagues.json`; os menus, rotas e breadcrumbs usam essa fonte. Os campos `nome`, `pais`, `competicao`, `corDestaque`, `imagemCapa` e `clubes` organizam a navegação. Confira e substitua os participantes marcados com `clubesVerificados: false` antes de publicar.
- **Categorias:** altere `data/categories.json` e os grupos de navegação em `components/site-header.tsx`.
- **Marca e regras comerciais:** edite `config.ts`.
- **Cores:** os tokens Tailwind estão em `tailwind.config.ts`; as variáveis CSS equivalentes estão no início de `app/globals.css`. Azul é a cor primária de ação e preto/grafite compõem a marca.
- **Imagens e créditos:** as fotos dos produtos vêm somente de `public/catalogo/`. Os slots temáticos são preenchidos com imagens locais quando disponíveis, usando ilustrações SVG originais em `public/arena/` como fallback. Atribuições não presumem autorização; consulte “Direitos de imagem” abaixo. Nenhum logo de liga é usado.

### Catalogar as fotos locais

Execute `npm run catalogar` para ler exclusivamente `public/catalogo/`. O comando agrupa arquivos com clube e temporada iguais; sufixos de cópia como `(1)` e `_` viram fotos adicionais, enquanto atributos explícitos como goleiro, treino, retrô ou uniforme diferente separam produtos. As pastas já indicam categorias como Femininas, Jogador, Retrô e Seleções.

Para conferir a inferência sem gravar alterações, use `npm run catalogar -- --dry-run`; `--limit=40` permite uma prévia rápida. O script deduz os nomes consultando `data/leagues.json` e marca como `revisar` o que não consegue confirmar. Edite as colunas correspondentes em `data/catalogo-revisao.csv` e rode o comando novamente. As correções são preservadas em `data/catalogo-correcoes.json`, inclusive depois que o produto deixa de precisar de revisão. Para preencher liga, clube ou enums, use os slugs e valores canônicos do catálogo; os valores possíveis de público são `masculino`, `feminino` e `unissex`.

As imagens válidas geram WebP de até 400, 800 e 1600 px em `public/otimizadas/`, além de `blurDataURL`. A exibição dos produtos reserva proporção 4:5 com `object-cover`; edite `focalPoint` na imagem de `data/products.json` para ajustar o enquadramento — o valor é mantido na próxima catalogação. `data/catalogo-imagens.json` recebe os slots temáticos disponíveis; quando não há foto apropriada, `data/images.ts` mantém a ilustração local de fallback e o relatório indica o slot. O processo é local, idempotente e não baixa arquivos nem modifica originais.

## Direitos de imagem

Use somente imagens próprias, licenciadas para o uso pretendido ou autorizadas por escrito pelo fornecedor. A presença dos arquivos em `public/catalogo/` não comprova licença ou autorização. Antes de publicar, registre a origem de cada lote, fornecedor, referência da autorização e data em `data/catalogo-origem.json`; as referências de arquivo originais também são mantidas em `data/products.json` e nos dados dos slots. Preencha o cadastro de direitos para cada categoria/lote e confirme as permissões para uso comercial. Nenhuma imagem externa é baixada pelo catalogador.

### Temporadas e conferência das ligas

As páginas das ligas brasileiras, inglesas, espanholas, italianas, alemãs, francesas, escocesas e MLS incluem fontes junto dos dados em `data/leagues.json`. Portugal, Eredivisie e Saudi Pro League estão marcadas com lista editorial parcial; Libertadores e Champions League mostram clubes de referência, não uma relação completa de classificados. Seleções estão agrupadas por continente e não equivalem à lista completa de classificados da Copa de 2026. Verifique as páginas oficiais da competição e atualize os clubes antes de publicar ou anunciar disponibilidade.

## Pagamento e backend

O checkout usa Checkout Pro do Mercado Pago em modo de teste. Os endpoints `app/api/checkout`, `app/api/shipping/quote` e `app/api/mercado-pago/webhook` executam no runtime Node da Vercel. Preços, tamanhos, personalização, quantidade e frete são revalidados no servidor; o navegador nunca define o valor cobrado. A sacola só é limpa quando a página de retorno consulta um pedido aprovado no banco.

### Configurar ambiente local e Vercel

1. Copie `.env.example` para `.env.local` no desenvolvimento e não adicione esse arquivo ao Git. Na Vercel, configure cada variável em **Settings → Environment Variables**.
2. Crie um banco PostgreSQL serverless compatível com Neon e configure `DATABASE_URL` usando a connection string do ambiente de teste. A URL deve permitir conexões TLS.
3. Aplique a migração no mesmo ambiente do banco: `npm run db:migrate`. Ela cria `store_orders` e `store_order_payments`; a integração não cria pedidos se as tabelas não existirem.
4. No painel de desenvolvedores do Mercado Pago, crie/seleciona uma aplicação de teste e cadastre o token de teste em `MERCADO_PAGO_ACCESS_TOKEN`. O backend exige `PAYMENT_ENVIRONMENT=test` e token com prefixo `TEST-`; tokens de produção são rejeitados.
5. Configure `MERCADO_PAGO_WEBHOOK_SECRET` com a chave secreta de Webhooks da aplicação de teste. Configure `SITE_URL` com a origem HTTPS do deployment ou `http://localhost:3000` localmente.
6. Para Correios, cadastre usuário, código de acesso e cartão de postagem nas variáveis indicadas no exemplo. Configure o CEP de origem, os códigos/nomes dos serviços contratados em `CORREIOS_SERVICES_JSON` e os pesos/dimensões reais por quantidade (1 e 2 camisas) em `CORREIOS_PACKAGE_SPECS_JSON`. Não use medidas estimadas: o endpoint bloqueia a cotação até esses dados existirem. Pedidos com 3 ou mais camisas recebem frete grátis, conforme a regra comercial confirmada.
7. No painel do Mercado Pago, abra a aplicação → **Webhooks → Configurar notificações**, informe `https://SEU_DOMINIO/api/mercado-pago/webhook`, habilite o evento **Pagamentos** no ambiente de teste, salve e copie a chave secreta para `MERCADO_PAGO_WEBHOOK_SECRET`. Use a função de simulação do painel para conferir a entrega; uma notificação de simulação sem pagamento consultável não atualiza pedidos.
8. Crie um comprador de teste no painel do Mercado Pago e use o link de teste gerado pelo Checkout Pro. Nunca use dados de cartão reais no ambiente de teste. A URL de retorno consulta o banco, e não considera `status` ou `payment_id` enviados pelo navegador como confirmação.

### Variáveis necessárias

- `PAYMENT_ENVIRONMENT=test`, `MERCADO_PAGO_ACCESS_TOKEN`, `MERCADO_PAGO_WEBHOOK_SECRET`
- `DATABASE_URL`, `SITE_URL`
- `CORREIOS_API_USERNAME`, `CORREIOS_API_ACCESS_CODE`, `CORREIOS_POSTING_CARD`, `CORREIOS_ORIGIN_CEP`
- `CORREIOS_SERVICES_JSON`: JSON de serviços habilitados pela conta, por exemplo `[{"code":"CODIGO_CONTRATADO","label":"Nome do serviço contratado"}]`.
- `CORREIOS_PACKAGE_SPECS_JSON`: JSON com os valores medidos, em kg e cm, por quantidade; por exemplo `{"1":{"weightKg":0,"lengthCm":0,"widthCm":0,"heightCm":0},"2":{"weightKg":0,"lengthCm":0,"widthCm":0,"heightCm":0}}`. Substitua todos os zeros por medições reais.

`MERCADO_PAGO_ACCESS_TOKEN`, usuário/código dos Correios, chave do Webhook e `DATABASE_URL` são segredos: somente variáveis de servidor na Vercel, nunca variáveis `NEXT_PUBLIC_*` ou `NEXT_*` expostas no cliente. `.env*` permanece ignorado pelo Git, exceto `.env.example`.
