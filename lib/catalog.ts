import productsData from "@/data/products.json";
import leaguesData from "@/data/leagues.json";
import { images } from "@/data/images";
import type { ImageAsset } from "@/data/images";
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

export function productImageAsset(product: Pick<Product, "images" | "imageSeed" | "tipo" | "nome">, alternate = false): ImageAsset {
  const primary = product.images?.[0];
  const image = alternate
    ? product.images?.find((candidate) => candidate.src !== primary?.src) ?? primary
    : primary;
  if (image) return { ...image, alt: `${product.nome} – ${alternate && image.src !== primary?.src ? "verso" : "frente"}` };
  if (product.tipo === "retro") return images.retro.cover;
  return alternate ? images.products.alternate : images.products.primary;
}

export function productImage(product: Pick<Product, "images" | "imageSeed" | "tipo" | "nome">, alternate = false) {
  return productImageAsset(product, alternate).src;
}
