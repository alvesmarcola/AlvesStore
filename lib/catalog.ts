import type { ImageAsset } from "@/data/images";
import type { Product } from "@/lib/types";

const neutralBlur = "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxIDEiPjxyZWN0IHdpZHRoPSIxIiBoZWlnaHQ9IjEiIGZpbGw9IiNmNWY1ZjUiLz48L3N2Zz4=";
const missingProductImage: ImageAsset = {
  src: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 640 800'%3E%3Crect width='640' height='800' fill='%23f5f5f5'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' fill='%23666' font-family='Arial,sans-serif' font-size='32'%3EFoto em breve%3C/text%3E%3C/svg%3E",
  alt: "Imagem do produto indisponível",
  credit: "Alves Store",
  focalPoint: { x: 50, y: 50 },
  blurDataURL: neutralBlur,
};

export function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

export function productImageAsset(product: Pick<Product, "images" | "imageSeed" | "tipo" | "nome">, alternate = false): ImageAsset {
  const primary = product.images?.[0];
  const image = alternate
    ? product.images?.find((candidate) => candidate.src !== primary?.src) ?? primary
    : primary;
  if (!image) return { ...missingProductImage, alt: product.nome };
  return {
    src: image.src,
    fallbackSrc: image.fallbackSrc,
    alt: image.alt || product.nome,
    credit: image.credit,
    focalPoint: image.focalPoint,
    blurDataURL: image.blurDataURL || neutralBlur,
  };
}

export function productImage(product: Pick<Product, "images" | "imageSeed" | "tipo" | "nome">, alternate = false) {
  return productImageAsset(product, alternate).src;
}

export function toCatalogPreview(product: Product): Product {
  return { ...product, images: product.images?.slice(0, 2) ?? [] };
}
