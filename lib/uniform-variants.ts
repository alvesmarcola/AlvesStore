import type { Product, ProductImage } from "@/lib/types";
import { productImageAsset } from "@/lib/catalog";

export interface UniformVariant {
  id: string;
  name: string;
  shortName: string;
  images: ProductImage[];
}

/**
 * Deduplica imagens vindas do Yupoo onde o mesmo álbum contém múltiplos formatos
 * (big.jpg, square.jpg, thumbnail hash) para uma única foto real.
 */
export function cleanAndDeduplicateImages(rawImages: ProductImage[], defaultAlt: string): ProductImage[] {
  const unique: ProductImage[] = [];
  const seenKeys = new Set<string>();

  for (const img of rawImages) {
    if (!img?.src) continue;
    // Extrai o hash base da foto no Yupoo: /<conta>/<photoId>/...
    const match = img.src.match(/yupoo\.com\/[^/]+\/([a-zA-Z0-9]+)\//i);
    const photoKey = match ? match[1] : img.src;

    if (!seenKeys.has(photoKey)) {
      seenKeys.add(photoKey);
      // Normaliza para alta resolução (big.jpg) caso venha como square ou thumbnail
      const highResSrc = img.src.replace(/\/(square|[0-9a-f]+)\.jpg$/i, "/big.jpg");
      unique.push({
        ...img,
        src: highResSrc,
        source: img.source || "",
        alt: img.alt || defaultAlt,
        credit: img.credit || "Alves Store",
        focalPoint: img.focalPoint || { x: 50, y: 50 },
        blurDataURL: img.blurDataURL || "",
      });
    }
  }

  return unique.length > 0 ? unique : rawImages;
}

/**
 * Detecta se o produto possui múltiplos uniformes misturados no mesmo álbum (ex: Home e Away, Third e Away)
 * e divide as imagens sequenciais em variantes selecionáveis.
 */
export function detectUniformVariants(product: Product): UniformVariant[] | null {
  const primaryFallback = productImageAsset(product);
  const secondaryFallback = productImageAsset(product, true);

  const rawList: ProductImage[] = product.images && product.images.length > 0
    ? product.images
    : [
        {
          src: primaryFallback.src,
          fallbackSrc: primaryFallback.fallbackSrc,
          source: product.slug,
          alt: primaryFallback.alt,
          credit: primaryFallback.credit,
          focalPoint: primaryFallback.focalPoint,
          blurDataURL: primaryFallback.blurDataURL,
        },
        {
          src: secondaryFallback.src,
          fallbackSrc: secondaryFallback.fallbackSrc,
          source: product.slug,
          alt: secondaryFallback.alt,
          credit: secondaryFallback.credit,
          focalPoint: secondaryFallback.focalPoint,
          blurDataURL: secondaryFallback.blurDataURL,
        },
      ];

  const cleanedImages = cleanAndDeduplicateImages(rawList, product.nome);
  const title = (product.nome || "").toLowerCase();

  // Padrões de múltiplos uniformes no título
  const hasThirdAway = /\b(third\s*(?:&|\/|and|\s+)?\s*away|terceir[oa]\s*(?:&|\/|e|\s+)?\s*(?:reserva|fora))\b/i.test(title);
  const hasHomeAway = /\b(home\s*(?:&|\/|and|\s+)?\s*away|casa\s*(?:&|\/|e|\s+)?\s*fora|titular\s*(?:&|\/|e|\s+)?\s*reserva)\b/i.test(title);
  const hasHomeThird = /\b(home\s*(?:&|\/|and|\s+)?\s*third|casa\s*(?:&|\/|e|\s+)?\s*terceir[oa])\b/i.test(title);

  // Mínimo de 4 fotos únicas para permitir a divisão em 2 uniformes
  if ((hasThirdAway || hasHomeAway || hasHomeThird) && cleanedImages.length >= 4) {
    const half = Math.ceil(cleanedImages.length / 2);
    const set1 = cleanedImages.slice(0, half);
    const set2 = cleanedImages.slice(half);

    if (hasThirdAway) {
      return [
        { id: "terceiro", name: "Terceiro Uniforme (Third)", shortName: "Third", images: set1 },
        { id: "reserva", name: "Uniforme Reserva (Away)", shortName: "Away", images: set2 },
      ];
    }
    if (hasHomeAway) {
      return [
        { id: "titular", name: "Uniforme Titular (Home)", shortName: "Home", images: set1 },
        { id: "reserva", name: "Uniforme Reserva (Away)", shortName: "Away", images: set2 },
      ];
    }
    if (hasHomeThird) {
      return [
        { id: "titular", name: "Uniforme Titular (Home)", shortName: "Home", images: set1 },
        { id: "terceiro", name: "Terceiro Uniforme (Third)", shortName: "Third", images: set2 },
      ];
    }
  }

  return null;
}

