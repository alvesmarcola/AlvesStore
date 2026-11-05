import { classifyProduct, getProductSizeSurcharge, isKidsProduct, isNbaTankTop } from "@/lib/product-classification";
import { storeConfig } from "@/config";
import type { Product } from "@/lib/types";

export const BLACK_FRIDAY_PROMO_CODE = "BF-NBA-2026";
const promoEndsAt = Date.UTC(2026, 11, 2, 2, 59, 59, 999);

export type BlackFridayItem = {
  product: Product;
  quantity: number;
  size?: string;
  lineId?: string;
};

export type BlackFridayDiscountedItem = {
  itemIndex: number;
  quantity: number;
  discountPerUnitCents: number;
  lineId?: string;
};

/**
 * Identifica explicitamente se um produto se trata de versão jogador / player / atleta de jogo.
 */
export function isPlayerVersion(product: Product): boolean {
  if (product.tipo === "jogador" || product.version === "player") return true;

  const facts = classifyProduct(product);
  if (facts.version === "player") return true;

  const rawEvidence = [
    product.nome,
    product.title,
    product.name,
    product.description,
    product.version,
    product.model,
    product.category,
    product.subcategory,
    ...(product.tags ?? []),
  ].filter((item): item is string => typeof item === "string" && item.trim().length > 0).join(" ");

  const normalized = rawEvidence
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR");

  return /\b(?:versao[-\s]*jogador|player[-\s]*version|player|versao[-\s]*atleta|modelo[-\s]*atleta|camisa[-\s]*atleta|jogador)\b/.test(normalized);
}

/**
 * Regra de elegibilidade da promoção Black Friday NBA (50% na camisa comum):
 * Elegíveis: camisas de time comuns (torcedor tradicional, treino, femininas comuns,
 * clubes, seleções, diferentes temporadas e competições).
 * Não elegíveis:
 * - Regatas NBA (são o produto ativador do benefício)
 * - Conjuntos infantis
 * - Versão jogador / player / atleta (exceção explícita da promoção)
 */
export function isBlackFridayEligibleShirt(product: Product): boolean {
  if (isNbaTankTop(product) || product.tipo === "regata") return false;
  if (isKidsProduct(product)) return false;
  if (isPlayerVersion(product)) return false;

  return true;
}

export function calcularPromoBlackFriday(itens: BlackFridayItem[], dataAtual: Date) {
  const timestamp = dataAtual.getTime();
  const ativa = Number.isFinite(timestamp) && timestamp <= promoEndsAt;
  if (!ativa) return { desconto: 0, itensComDesconto: [] as BlackFridayDiscountedItem[], ativa };

  const regatas = itens.reduce((sum, item) => sum + (isNbaTankTop(item.product) ? item.quantity : 0), 0);
  const eligibleShirts = itens.flatMap((item, itemIndex) => {
    if (!isBlackFridayEligibleShirt(item.product)) return [];
    const facts = classifyProduct(item.product);
    const basePrice = (facts.price ?? (item.product.preco > 0 ? item.product.preco : storeConfig.fanCommonPrice));
    return [{
      itemIndex,
      quantity: item.quantity,
      unitPriceCents: Math.round(basePrice * 100),
      size: item.size ?? "",
      lineId: item.lineId,
    }];
  }).sort((a, b) => b.unitPriceCents + getProductSizeSurcharge(b.size) * 100
    - (a.unitPriceCents + getProductSizeSurcharge(a.size) * 100) || a.itemIndex - b.itemIndex);

  let remainingDiscounts = Math.min(regatas, eligibleShirts.reduce((sum, item) => sum + item.quantity, 0));
  const itensComDesconto: BlackFridayDiscountedItem[] = [];
  for (const shirt of eligibleShirts) {
    if (remainingDiscounts <= 0) break;
    const quantity = Math.min(shirt.quantity, remainingDiscounts);
    const discountPerUnitCents = Math.floor(shirt.unitPriceCents / 2);
    itensComDesconto.push({
      itemIndex: shirt.itemIndex,
      quantity,
      discountPerUnitCents,
      ...(shirt.lineId ? { lineId: shirt.lineId } : {}),
    });
    remainingDiscounts -= quantity;
  }

  const descontoCents = itensComDesconto.reduce((sum, item) => sum + item.discountPerUnitCents * item.quantity, 0);
  return { desconto: descontoCents / 100, itensComDesconto, ativa };
}
