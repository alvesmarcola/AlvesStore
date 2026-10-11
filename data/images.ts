import catalogImageData from "@/data/catalogo-imagens.json";

export interface ImageAsset {
  src: string;
  alt: string;
  credit: string;
  focalPoint: { x: number; y: number };
  blurDataURL: string;
}

const blurDataURL =
  "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxIDEiPjxyZWN0IHdpZHRoPSIxIiBoZWlnaHQ9IjEiIGZpbGw9IiMxNzE3MTciLz48L3N2Zz4=";
const originalIllustration = "Ilustração original da alves store; sem ativos de terceiros.";
const catalogImages = catalogImageData as Record<string, ImageAsset>;

function placeholder(src: string, alt: string, focalPoint = { x: 50, y: 50 }): ImageAsset {
  return { src, alt, credit: originalIllustration, focalPoint, blurDataURL };
}

function themeImage(slot: string, fallback: ImageAsset): ImageAsset {
  return catalogImages[slot] ?? fallback;
}

export const images = {
  home: {
    hero: themeImage(
      "home.hero",
      placeholder("/arena/arena-hero.svg", "Ilustração placeholder de jogador em ação numa arena iluminada", { x: 70, y: 50 }),
    ),
  },
  categories: {
    male: themeImage(
      "categories.male",
      placeholder("/arena/arena-hero.svg", "Ilustração placeholder de disputa de bola em estádio", { x: 70, y: 55 }),
    ),
    female: themeImage(
      "categories.female",
      placeholder("/arena/women-action.svg", "Ilustração placeholder de jogadora em movimento num estádio", { x: 58, y: 48 }),
    ),
    leagues: themeImage(
      "categories.leagues",
      placeholder("/arena/stadium-aerial.svg", "Ilustração placeholder de estádio e gramado vistos de cima"),
    ),
  },
  retro: {
    cover: themeImage(
      "retro.cover",
      placeholder("/arena/retro-match.svg", "Ilustração placeholder de partida antiga em tratamento sépia", { x: 59, y: 50 }),
    ),
  },
  leagues: {
    brazil: themeImage("league.brazil", placeholder("/arena/stadium-aerial.svg", "Estádio placeholder para clubes brasileiros")),
    england: themeImage("league.england", placeholder("/arena/arena-hero.svg", "Arena placeholder para clubes ingleses")),
    spain: themeImage("league.spain", placeholder("/arena/stadium-aerial.svg", "Estádio placeholder para clubes espanhóis", { x: 44, y: 50 })),
    italy: themeImage("league.italy", placeholder("/arena/arena-hero.svg", "Arena placeholder para clubes italianos", { x: 72, y: 52 })),
    germany: themeImage("league.germany", placeholder("/arena/stadium-aerial.svg", "Estádio placeholder para clubes alemães", { x: 55, y: 47 })),
    france: themeImage("league.france", placeholder("/arena/arena-hero.svg", "Arena placeholder para clubes franceses", { x: 68, y: 53 })),
    portugal: themeImage("league.portugal", placeholder("/arena/stadium-aerial.svg", "Estádio placeholder para clubes portugueses", { x: 45, y: 50 })),
    netherlands: themeImage("league.netherlands", placeholder("/arena/arena-hero.svg", "Arena placeholder para clubes neerlandeses", { x: 73, y: 48 })),
    scotland: themeImage("league.scotland", placeholder("/arena/stadium-aerial.svg", "Estádio placeholder para clubes escoceses", { x: 53, y: 49 })),
    mls: themeImage("league.mls", placeholder("/arena/arena-hero.svg", "Arena placeholder para clubes da MLS", { x: 68, y: 56 })),
    saudi: themeImage("league.saudi", placeholder("/arena/stadium-aerial.svg", "Estádio placeholder para clubes sauditas", { x: 44, y: 49 })),
    libertadores: themeImage("league.libertadores", placeholder("/arena/arena-hero.svg", "Arena placeholder para a Copa Libertadores", { x: 71, y: 50 })),
    champions: themeImage("league.champions", placeholder("/arena/stadium-aerial.svg", "Estádio placeholder para a UEFA Champions League")),
    national: themeImage("league.national", placeholder("/arena/women-action.svg", "Estádio placeholder para seleções nacionais", { x: 58, y: 48 })),
  },
  products: {
    primary: themeImage("product.primary", placeholder("/arena/shirt-primary.svg", "Camisa esportiva placeholder azul sem escudos ou marcas")),
    alternate: themeImage("product.alternate", placeholder("/arena/shirt-alternate.svg", "Vista alternativa de camisa esportiva placeholder sem escudos")),
  },
} as const;

export type LeagueImageSlot = keyof typeof images.leagues;
