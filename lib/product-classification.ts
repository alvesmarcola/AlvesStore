import type { Product, ShirtVersion, SleeveType, Uniform } from "@/lib/types";
import { productOverrides } from "@/data/product-overrides";
import { storeConfig } from "@/config";

export interface ProductClassification {
  version: ShirtVersion;
  sleeve: SleeveType;
  uniform: Uniform;
  fullPatch: boolean;
  price: number | null;
  priceLabel: string;
  reviewRequired: boolean;
  source: "correção administrativa" | "catálogo" | "revisão necessária";
}

export function classifyProduct(product: Product): ProductClassification {
  const override = productOverrides[product.id] ?? productOverrides[product.slug];
  const evidence = `${product.nome} ${product.slug} ${product.imageSeed} ${(product.images ?? []).map((image) => image.source).join(" ")}`.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");
  const inferredVersion: ShirtVersion = product.tipo === "retro" || /\b(retro|vintage)\b/.test(evidence)
    ? "retro"
    : product.tipo === "jogador" || /\b(player version|versao jogador)\b/.test(evidence)
      ? "player"
      : product.tipo === "goleiro" || /\b(goleiro|goalkeeper|keeper|gk)\b/.test(evidence)
        ? "goalkeeper"
        : product.tipo === "torcedor" || /manga-longa-torcedor|\b(fan version|versao torcedor)\b/.test(evidence)
          ? "fan"
          : "unknown";
  const inferredSleeve: SleeveType = /manga longa|manga-longa|long sleeve|\bls\b/.test(evidence)
    ? "long"
    : inferredVersion === "retro" ? "short" : "unknown";
  const inferredUniform: Uniform = product.uniforme !== "revisar"
    ? product.uniforme
    : /\b(home|titular)\b/.test(evidence) ? "titular"
      : /\b(away|reserva)\b/.test(evidence) ? "reserva"
        : /\b(third|terceiro|terceira)\b/.test(evidence) ? "terceiro"
          : /\b(fourth|quarto|quarta)\b/.test(evidence) ? "quarto" : "revisar";
  const version = override?.version ?? inferredVersion;
  const sleeve = override?.sleeve ?? inferredSleeve;
  const uniform = override?.uniform ?? inferredUniform;
  const fullPatch = override?.fullPatch ?? (version === "fan" && /full.?patch|patch completo/.test(evidence));
  const price = override?.price ?? (
    version === "retro" && sleeve === "long" ? storeConfig.retroLongSleevePrice
      : version === "retro" && sleeve === "short" ? storeConfig.retroShortSleevePrice
        : version === "fan" && !fullPatch ? storeConfig.fanCommonPrice
          : version === "fan" && fullPatch ? storeConfig.fanFullPatchPrice : null
  );
  const label = price === null ? "Preço em revisão" : `R$ ${price.toFixed(2).replace(".", ",")}`;
  return {
    version,
    sleeve,
    uniform,
    fullPatch,
    price,
    priceLabel: label,
    reviewRequired: price === null,
    source: override ? "correção administrativa" : price === null ? "revisão necessária" : "catálogo",
  };
}

export function getProductUnitPrice(product: Product) {
  return classifyProduct(product).price;
}
