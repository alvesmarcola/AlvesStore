import type { ImageAsset } from "@/data/images";
import { images as storeImages } from "@/data/images";
import type { Product } from "@/lib/types";

const neutralBlur = "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxIDEiPjxyZWN0IHdpZHRoPSIxIiBoZWlnaHQ9IjEiIGZpbGw9IiNmNWY1ZjUiLz48L3N2Zz4=";
const missingProductImage: ImageAsset = {
  src: storeImages.products.primary.src,
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
