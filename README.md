# alves store

Loja demonstrativa de camisas de futebol com Next.js App Router, TypeScript, Tailwind CSS, Zustand, React Hook Form e Zod. O catálogo, login e checkout são mockados; nenhum pedido ou pagamento é enviado para um serviço externo.

## Requisitos e execução

- Node.js 20.9 ou superior
- npm

```bash
npm install
npm run dev
```

Acesse [http://localhost:3000](http://localhost:3000). Os comandos para verificar a aplicação e executá-la como produção:

```bash
npm run lint
npm run typecheck
npm run build
npm start
```

## Organização

- `app/`: rotas do App Router, metadata e sitemap.
- `components/`: header, menus, cards e grades de produto, filtros, footer, consentimento e formulários compartilhados.
- `config.ts`: nome da loja, WhatsApp, valores do Pix, parcelas, frete, cupom, desconto progressivo e personalização.
- `data/products.json`: 60 produtos mockados; os nomes de clubes são fictícios.
- `data/categories.json`: públicos e subcategorias.
- `data/leagues.json`: ligas e respectivos clubes.
- `lib/types.ts`: modelos TypeScript do catálogo e sacola.
- `lib/catalog.ts`: consulta, formatação de preço e helpers de imagem.
- `lib/commerce.ts`: regras de cálculo do carrinho.
- `lib/validation.ts`: schemas Zod, incluindo validação do CPF.
- `store/cart.ts`: estado Zustand da sacola persistido no localStorage.
- `tailwind.config.ts` e `app/globals.css`: tokens de cor e tipografia.

## Como personalizar

- **Produtos:** edite `data/products.json`. Mantenha o `slug` único e relacione `liga` e `clubeSlug` aos slugs em `data/leagues.json`. Campos `publico`, `tipo`, `temporada` e `uniforme` controlam onde o item aparece e os filtros. `estoque` igual a zero exibe item esgotado; `esgotados` marca tamanhos indisponíveis.
- **Ligas e clubes:** atualize `data/leagues.json`; os menus, rotas e breadcrumbs usam essa fonte. O mesmo produto participa do catálogo por público e por liga/clube.
- **Categorias:** altere `data/categories.json` e os grupos de navegação em `components/site-header.tsx`.
- **Marca e regras comerciais:** edite `config.ts`.
- **Cores:** os tokens Tailwind estão em `tailwind.config.ts`; as variáveis CSS equivalentes estão no início de `app/globals.css`. Azul é a cor primária de ação e preto/grafite compõem a marca.
- **Imagens:** o catálogo usa URLs placeholder do `picsum.photos`, formadas em `productImage()` dentro de `lib/catalog.ts`. Troque o helper por imagens próprias quando disponíveis. Os placeholders não usam escudos ou logos reais.

## Pagamento e backend

O checkout valida identificação, e-mail, CPF, telefone, CEP e endereço. A pesquisa de CEP usa ViaCEP quando disponível; o frete e o rastreio são estimados/mockados. Nenhum dado de pedido é transmitido pelo formulário. Para produção, implemente uma API de pedidos no servidor, armazene as informações com os requisitos de segurança e privacidade aplicáveis e crie a sessão/cobrança no provedor escolhido (Mercado Pago, Stripe ou Pix) no backend. Nunca exponha chaves secretas no navegador.
