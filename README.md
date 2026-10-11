# alves store

Loja demonstrativa de camisas de futebol com Next.js App Router, TypeScript, Tailwind CSS, Framer Motion, Zustand, React Hook Form e Zod. O catálogo, login e checkout são mockados; nenhum pedido ou pagamento é enviado para um serviço externo.

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
- `config.ts`: nome da loja, WhatsApp, valores do Pix, parcelas, frete, cupom, desconto progressivo e personalização.
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

O checkout valida identificação, e-mail, CPF, telefone, CEP e endereço. A pesquisa de CEP usa ViaCEP quando disponível; o frete e o rastreio são estimados/mockados. Nenhum dado de pedido é transmitido pelo formulário. Para produção, implemente uma API de pedidos no servidor, armazene as informações com os requisitos de segurança e privacidade aplicáveis e crie a sessão/cobrança no provedor escolhido (Mercado Pago, Stripe ou Pix) no backend. Nunca exponha chaves secretas no navegador.
