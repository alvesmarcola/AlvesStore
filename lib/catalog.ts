import productsData from "@/data/products.json";
import leaguesData from "@/data/leagues.json";
import { storeConfig } from "@/config";
import { images } from "@/data/images";
import type { ImageAsset } from "@/data/images";
import type { League, Product } from "@/lib/types";

export const products = (productsData as Product[]).map((product) => ({
  ...product,
  preco: storeConfig.shirtPrice,
  precoAnterior: storeConfig.shirtPrice,
}));
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

export function productImageAsset(product: Pick<Product, "images" | "imageSeed" | "tipo">, alternate = false): ImageAsset {
  const image = product.images?.[alternate ? 1 : 0] ?? product.images?.[0];
  if (image) return image;
  if (product.tipo === "retro") return images.retro.cover;
  return alternate ? images.products.alternate : images.products.primary;
}

export function productImage(product: Pick<Product, "images" | "imageSeed" | "tipo">, alternate = false) {
  return productImageAsset(product, alternate).src;
}
