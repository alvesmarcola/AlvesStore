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
  evidence: string[];
}

export function classifyProduct(product: Product): ProductClassification {
  const override = productOverrides[product.id] ?? productOverrides[product.slug];
  const evidence = `${product.nome} ${product.slug} ${product.imageSeed} ${product.tipo} ${(product.images ?? []).map((image) => image.source).join(" ")}`.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR").replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
  const fullPatchEvidence = /\b(full ?patch(?:es)?|patch completo|patches completos|full sponsor|all sponsors)\b/.test(evidence);
  const inferredVersion: ShirtVersion = product.tipo === "retro" || /\b(retro|vintage)\b/.test(evidence)
    ? "retro"
    : product.tipo === "jogador" || /\b(player|player version|versao jogador|jogador)\b/.test(evidence)
      ? "player"
      : product.tipo === "goleiro" || /\b(goleiro|goalkeeper|keeper|gk)\b/.test(evidence)
        ? "goalkeeper"
      : "fan";
  const inferredSleeve: SleeveType = /\b(manga longa|long sleeve|ls)\b/.test(evidence)
    ? "long"
    : /\b(manga curta|short sleeve|ss)\b/.test(evidence) ? "short" : "unknown";
  const inferredUniform: Uniform = product.uniforme !== "revisar"
    ? product.uniforme
    : /\b(home|titular)\b/.test(evidence) ? "titular"
    : /\b(away|reserva|resrva|visitante)\b/.test(evidence) ? "reserva"
        : /\b(third|3rd|terceiro|terceira)\b/.test(evidence) ? "terceiro"
          : /\b(fourth|4th|quarto|quarta)\b/.test(evidence) ? "quarto" : "revisar";
  const version = override?.version ?? inferredVersion;
  const isGoalkeeper = product.tipo === "goleiro" || inferredVersion === "goalkeeper";
  const sleeve = override?.sleeve ?? inferredSleeve;
  const uniform = override?.uniform ?? inferredUniform;
  const fullPatch = override?.fullPatch ?? (version === "fan" && fullPatchEvidence);
  const overridePrice = Number.isFinite(override?.price) && (override?.price ?? 0) > 0 && (override?.price ?? Infinity) <= 2000
    ? override?.price : undefined;
  const categoryPrice = (
    version === "retro" && sleeve === "long" ? storeConfig.retroLongSleevePrice
      : version === "retro" && sleeve === "short" ? storeConfig.retroShortSleevePrice
        : version === "player" && sleeve === "long" ? storeConfig.playerLongSleevePrice
      : version === "goalkeeper" ? storeConfig.fanCommonPrice
        : version === "fan" && fullPatch ? storeConfig.fanFullPatchPrice
            : version === "fan" && sleeve === "long" && product.preco > 0 && product.preco !== storeConfig.fanCommonPrice ? product.preco
              : version === "fan" ? storeConfig.fanCommonPrice : null
  );
  const registeredPrice = Number.isFinite(product.preco) && product.preco > 0 && !(product.preco === storeConfig.fanCommonPrice && version !== "fan");
  const price = isGoalkeeper ? storeConfig.fanCommonPrice : overridePrice ?? categoryPrice ?? (
    registeredPrice && ((version === "retro" && sleeve === "unknown") || !["fan", "player"].includes(version))
      ? product.preco : null
  );
  const verifiedOverride = Boolean(override?.source && override?.verifiedBy);
  const reviewRequired = price === null || version === "unknown" || (version === "player" && sleeve !== "long" && !verifiedOverride);
  const label = price === null ? "Preço em revisão" : `R$ ${price.toFixed(2).replace(".", ",")}${reviewRequired ? " · classificação em revisão" : ""}`;
  return {
    version,
    sleeve,
    uniform,
    fullPatch,
    price,
    priceLabel: label,
    reviewRequired,
    source: override ? "correção administrativa" : reviewRequired ? "revisão necessária" : "catálogo",
    evidence: override?.source ? [override.source] : [product.tipo !== "revisar" ? `tipo:${product.tipo}` : "", /\b(manga longa|long sleeve|ls)\b/.test(evidence) ? "indicação de manga no nome/slug/fonte da imagem" : ""].filter(Boolean),
  };
}

export function getProductSizeSurcharge(size: string) {
  return size === "2GG" ? storeConfig.size2GGPrice : 0;
}

export function getProductUnitPrice(product: Product, size?: string) {
  const price = classifyProduct(product).price;
  return price === null ? null : price + getProductSizeSurcharge(size ?? "");
}

export function isPackageEligible(product: Product) {
  const facts = classifyProduct(product);
  return product.tipo !== "goleiro" && facts.version === "fan" && !facts.fullPatch && facts.price === storeConfig.fanCommonPrice;
}
