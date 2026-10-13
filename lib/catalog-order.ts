import type { Product } from "@/lib/types";
import { classifyProduct } from "@/lib/product-classification";

const clubPriority = ["flamengo", "corinthians", "gremio", "internacional"];
const nationalTeamPriority = ["brasil", "argentina"];
const uniformOrder: Record<string, number> = { titular: 0, reserva: 1, terceiro: 2, quarto: 3, revisar: 4 };
const versionOrder: Record<string, number> = { fan: 0, player: 1, retro: 2, goalkeeper: 3, unknown: 4 };

function seasonYear(season: string) {
  const match = season.match(/(?:^|\D)(\d{4}|\d{2})(?:\/(?:\d{4}|\d{2}))?/);
  if (!match) return -1;
  const year = Number(match[1]);
  return match[1].length === 2 ? (year >= 70 ? 1900 : 2000) + year : year;
}

export function compareCatalogProducts(a: Product, b: Product) {
  const leagueCompare = Number(a.liga === "selecoes") - Number(b.liga === "selecoes");
  if (leagueCompare) return leagueCompare;
  const clubCompare = a.clube.localeCompare(b.clube, "pt-BR");
  if (clubCompare) return clubCompare;
  const seasonCompare = seasonYear(b.temporada) - seasonYear(a.temporada);
  if (seasonCompare) return seasonCompare;
  const uniformCompare = (uniformOrder[classifyProduct(a).uniform] ?? 4) - (uniformOrder[classifyProduct(b).uniform] ?? 4);
  if (uniformCompare) return uniformCompare;
  const aFacts = classifyProduct(a);
  const bFacts = classifyProduct(b);
  const versionCompare = (versionOrder[aFacts.version] ?? 4) - (versionOrder[bFacts.version] ?? 4);
  if (versionCompare) return versionCompare;
  const sleeveCompare = (aFacts.sleeve === "short" ? 0 : aFacts.sleeve === "long" ? 1 : 2)
    - (bFacts.sleeve === "short" ? 0 : bFacts.sleeve === "long" ? 1 : 2);
  return sleeveCompare || a.nome.localeCompare(b.nome, "pt-BR") || a.id.localeCompare(b.id);
}

export function sortCatalogProducts(items: Product[]) {
  return [...items].sort(compareCatalogProducts);
}

export function prioritizeEditorialProducts(items: Product[], priority: string[], limit: number) {
  const candidates = sortCatalogProducts(items.filter((product) => product.tamanhos.length > 0 && !classifyProduct(product).reviewRequired));
  const selected: Product[] = [];
  const selectedIds = new Set<string>();
  for (const slug of priority) {
    const match = candidates.find((product) => product.clubeSlug === slug && !selectedIds.has(product.id));
    if (match) {
      selected.push(match);
      selectedIds.add(match.id);
    }
  }
  for (const product of candidates) {
    if (selected.length >= limit) break;
    if (!selectedIds.has(product.id)) selected.push(product);
  }
  return selected.slice(0, limit);
}

export function prioritizeClubs<T extends { slug: string; popularity: number }>(clubs: T[]) {
  return [...clubs].sort((a, b) => {
    const aRank = clubPriority.indexOf(a.slug);
    const bRank = clubPriority.indexOf(b.slug);
    const normalizedARank = aRank < 0 ? clubPriority.length : aRank;
    const normalizedBRank = bRank < 0 ? clubPriority.length : bRank;
    return normalizedARank - normalizedBRank || b.popularity - a.popularity || a.slug.localeCompare(b.slug);
  });
}

export const editorialPriorities = { clubs: clubPriority, selections: nationalTeamPriority } as const;
