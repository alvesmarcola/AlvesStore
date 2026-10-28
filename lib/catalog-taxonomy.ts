import type { Product } from "@/lib/types";

export type CatalogClub = { slug: string; nome: string };
export type CatalogLeague = {
  slug: string;
  nome: string;
  clubes: CatalogClub[];
  productCount: number;
  coverImage: string | null;
};

const specialNames: Record<string, string> = {
  "f1": "F1",
  "formula-1": "F1",
  "la-liga": "La Liga",
  "premier-league": "Premier League",
  "ligue-1": "Ligue 1",
  "serie-a": "Série A",
  "selecoes": "Seleções nacionais",
};

export function catalogLabel(slug: string) {
  return specialNames[slug] ?? slug.split("-").filter(Boolean).map((word) => word[0]?.toLocaleUpperCase("pt-BR") + word.slice(1)).join(" ");
}

export function deriveCatalogLeagues(products: Product[]): CatalogLeague[] {
  const grouped = new Map<string, { clubs: Map<string, string>; productCount: number; coverImage: string | null }>();
  for (const product of products) {
    if (!product.liga || product.liga === "revisar") continue;
    const league = grouped.get(product.liga) ?? { clubs: new Map<string, string>(), productCount: 0, coverImage: null };
    league.productCount += 1;
    if (product.clubeSlug && product.clubeSlug !== "revisar" && product.clube !== "Revisar") {
      league.clubs.set(product.clubeSlug, product.clube);
    }
    if (!league.coverImage && product.images?.[0]?.src) league.coverImage = product.images[0].src;
    grouped.set(product.liga, league);
  }

  return [...grouped.entries()].map(([slug, value]) => ({
    slug,
    nome: catalogLabel(slug),
    clubes: [...value.clubs.entries()].map(([clubSlug, nome]) => ({ slug: clubSlug, nome })).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")),
    productCount: value.productCount,
    coverImage: value.coverImage,
  })).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}
