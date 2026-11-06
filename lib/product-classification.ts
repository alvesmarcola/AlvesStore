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

export function isManualProduct(product: Product): boolean {
  return Boolean(
    product.ignorar_regras_preco ||
    product.yupoo_id?.startsWith("manual:") ||
    product.id?.startsWith("manual:") ||
    product.slug === "teste" ||
    (product.nome && product.nome.toLowerCase() === "teste")
  );
}

export function isTestProduct(product: Product): boolean {
  const slug = (product.slug || "").toLowerCase();
  const nome = (product.nome || "").toLowerCase();
  return slug === "teste" || nome === "teste" || product.id === "25288570-84a7-48cc-9a8b-abad05d51fd0";
}

export function isFreeShippingProduct(product: Product): boolean {
  return isTestProduct(product);
}

export function isKidsProduct(product: Product) {
  return product.publico === "infantil" || /\b(?:kids|junior|youth|infantil|children)\b/i.test(`${product.nome} ${product.imageSeed}`);
}

export function isNbaTankTop(product: Product) {
  if (isManualProduct(product)) return false;
  if (product.tipo !== "regata") return false;
  const evidence = `${product.liga} ${product.league ?? ""} ${product.category ?? ""} ${product.subcategory ?? ""} ${product.nome} ${product.title ?? ""} ${product.name ?? ""} ${product.clube ?? ""} ${product.clubeSlug ?? ""} ${(product.tags ?? []).join(" ")}`.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");
  return /\bnba\b|national basketball association|warriors|lakers|celtics|bulls|heat|nets|knicks|bucks|mavericks|suns|clippers|nuggets|76ers|sixers|spurs|raptors|rockets|cavaliers|grizzlies|hawks|pacers|magic|pelicans|timberwolves|thunder|trail blazers|jazz|kings|wizards|pistons|hornets/.test(evidence);
}

export function normalizeCategorySlug(value: string | undefined | null): string {
  if (!value) return "";
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function isRetroCategory(value: string | undefined | null): boolean {
  const normalized = normalizeCategorySlug(value);
  return normalized === "retro" || normalized === "classicos-retro" || normalized === "retro-jersey";
}

export function isRetroProduct(product: Product): boolean {
  // (4) Regra estrita: produtos da categoria NBA nunca aparecem no Retrô
  const isNba = product.liga === "nba" || product.tipo === "regata" || isNbaTankTop(product);
  if (isNba) return false;

  const isF1 = product.tipo === "f1" || product.tipo === "formula1" || product.liga === "f1";
  if (isF1) return false;

  const normTipo = normalizeCategorySlug(product.tipo);
  const normCat = normalizeCategorySlug(product.category);
  const normSub = normalizeCategorySlug(product.subcategory);
  const normSlug = normalizeCategorySlug(product.slug);

  if (normTipo === "retro" || normCat === "retro" || normSub === "retro") return true;
  if (normSlug === "retro" || normSlug.startsWith("retro-") || normSlug.includes("-retro-") || normSlug.endsWith("-retro")) return true;

  const classification = classifyProduct(product);
  return classification.version === "retro";
}

/** Regatas NBA e camisas de Fórmula 1 não aceitam personalização de nome e número. */
export function allowsCustomization(product: Product) {
  const isF1 = product.tipo === "f1" || product.tipo === "formula1" || product.liga === "f1" || product.liga === "formula-1"
    || /\b(?:f1|formula[-\s]*1|formula[-\s]*one|automobilismo|scuderia|ferrari|red[-\s]*bull(?:[-\s]*racing)?|mclaren|mercedes(?:[-\s]*amg)?|senna|aston[-\s]*martin|alpine|williams|haas)\b/i.test(`${product.liga} ${product.nome} ${product.clube}`);
  return !isF1 && !isNbaTankTop(product);
}

export function classifyProduct(product: Product): ProductClassification {
  if (isManualProduct(product)) {
    const rawPrice = Number(product.preco);
    const price = Number.isFinite(rawPrice) && rawPrice >= 0 ? rawPrice : 0;
    const formattedPrice = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(price);
    return {
      version: product.tipo === "jogador" ? "player" : product.tipo === "retro" ? "retro" : product.tipo === "goleiro" ? "goalkeeper" : "fan",
      sleeve: "short",
      uniform: product.uniforme !== "revisar" ? product.uniforme : "titular",
      fullPatch: false,
      price,
      priceLabel: formattedPrice,
      reviewRequired: false,
      source: "catálogo",
      evidence: ["produto manual com preço cadastrado respeitado"],
    };
  }

  const override = productOverrides[product.id] ?? productOverrides[product.slug];
  const evidence = `${product.nome} ${product.title ?? ""} ${product.name ?? ""} ${product.slug} ${product.imageSeed} ${product.tipo} ${product.category ?? ""} ${product.subcategory ?? ""} ${product.version ?? ""} ${product.model ?? ""} ${(product.tags ?? []).join(" ")} ${(product.images ?? []).map((image) => `${image.source} ${image.src}`).join(" ")}`.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR").replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
  const isKids = isKidsProduct(product);
  const fullPatchEvidence = /\b(full ?patch(?:es)?|patch completo|patches completos|full sponsor|all sponsors)\b/.test(evidence);
  const modelEvidence = `${product.nome} ${product.title ?? ""} ${product.name ?? ""} ${product.slug} ${product.category ?? ""} ${product.version ?? ""} ${product.model ?? ""} ${(product.tags ?? []).join(" ")}`.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR").replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
  const explicitTrainingProduct = product.tipo === "treino" && /\b(treino|training|pre jogo|pre match)\b/.test(modelEvidence)
    && !/\b(player|jogador)\b/.test(`${product.nome} ${product.title ?? ""} ${product.name ?? ""} ${product.category ?? ""} ${product.version ?? ""} ${product.model ?? ""}`.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR"));
  const isNba = isNbaTankTop(product) || product.tipo === "regata" || product.liga === "nba";
  const inferredVersion: ShirtVersion = (product.tipo === "f1" || product.tipo === "formula1" || isNba) ? "unknown" : explicitTrainingProduct ? "fan" : product.tipo === "retro" || /\b(retro|vintage)\b/.test(evidence)
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
  const fullPatch = override?.fullPatch ?? (version === "fan" && fullPatchEvidence && !isKids);
  const overridePrice = Number.isFinite(override?.price) && (override?.price ?? 0) > 0 && (override?.price ?? Infinity) <= 2000
    ? override?.price : undefined;
  const categoryPrice = isKids ? storeConfig.kidsPrice : isNbaTankTop(product) ? storeConfig.nbaTankTopPrice : (product.tipo === "revisar" && !override ? null : ((product.tipo === "f1" || product.tipo === "formula1") ? (product.preco > 0 ? product.preco : storeConfig.fanCommonPrice) : (
    version === "retro" && sleeve === "long" ? storeConfig.retroLongSleevePrice
      : version === "retro" && sleeve === "short" ? storeConfig.retroShortSleevePrice
        : version === "retro" ? (product.preco > storeConfig.fanCommonPrice ? product.preco : storeConfig.retroShortSleevePrice)
        : version === "player" ? (sleeve === "long" ? storeConfig.playerLongSleevePrice : storeConfig.playerShortSleevePrice)
      : version === "goalkeeper" ? storeConfig.fanCommonPrice
        : version === "fan" && fullPatch ? storeConfig.fanFullPatchPrice
            : version === "fan" && sleeve === "long" && product.preco > storeConfig.fanCommonPrice ? product.preco
              : version === "fan" ? storeConfig.fanCommonPrice : null
  )));

  const registeredPrice = Number.isFinite(product.preco) && product.preco > 0 && !(product.preco === storeConfig.fanCommonPrice && version !== "fan");
  const price = isKids ? storeConfig.kidsPrice
    : isGoalkeeper ? storeConfig.fanCommonPrice
    : isNbaTankTop(product) ? storeConfig.nbaTankTopPrice
    : (categoryPrice === null && overridePrice === undefined ? null : (overridePrice ?? categoryPrice ?? (registeredPrice && (product.tipo === "f1" || product.tipo === "formula1" || (version === "retro" && sleeve === "unknown") || !["fan", "player"].includes(version)) ? product.preco : storeConfig.fanCommonPrice)));
  const reviewRequired = price === null;
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
  if (isManualProduct(product)) {
    return price;
  }
  return price === null ? null : price + getProductSizeSurcharge(size ?? "");
}

export function isPackageEligible(product: Product): boolean {
  if (isManualProduct(product)) return false;
  if (product.sem_oferta_quantidade === true || product.ignorar_regras_preco === true) return false;
  if (isKidsProduct(product)) return false;
  if (isRetroProduct(product)) return false;
  if (isNbaTankTop(product) || product.tipo === "regata" || product.liga === "nba") return false;
  if (product.tipo === "f1" || product.tipo === "formula1" || product.liga === "f1") return false;

  const facts = classifyProduct(product);
  if (facts.version !== "fan" || facts.sleeve === "long" || facts.fullPatch) return false;
  if (facts.price !== storeConfig.fanCommonPrice) return false;

  return product.tipo === "torcedor" || product.publico === "masculino" || product.publico === "feminino" || product.publico === "unissex";
}
