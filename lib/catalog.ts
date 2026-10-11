import productsData from "@/data/products.json";
import leaguesData from "@/data/leagues.json";
import { images } from "@/data/images";
import type { League, Product } from "@/lib/types";

export const products = productsData as Product[];
export const leagues = leaguesData as League[];

export function getProduct(slug: string) {
  return products.find((product) => product.slug === slug);
}

export function getLeague(slug: string) {
  return leagues.find((league) => league.slug === slug);
}

export function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

export function discountPercent(product: Product) {
  return Math.round((1 - product.preco / product.precoAnterior) * 100);
}

export function productImage(seed: string, alternate = false) {
  if (seed.includes("retro")) return images.retro.cover.src;
  const image = alternate ? images.products.alternate : images.products.primary;
  return image.src;
}
