import { classifyProduct, getProductSizeSurcharge, isKidsProduct, isNbaTankTop } from "@/lib/product-classification";
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

export function calcularPromoBlackFriday(itens: BlackFridayItem[], dataAtual: Date) {
  const timestamp = dataAtual.getTime();
  const ativa = Number.isFinite(timestamp) && timestamp <= promoEndsAt;
  if (!ativa) return { desconto: 0, itensComDesconto: [] as BlackFridayDiscountedItem[], ativa };

  const regatas = itens.reduce((sum, item) => sum + (isNbaTankTop(item.product) ? item.quantity : 0), 0);
  const eligibleShirts = itens.flatMap((item, itemIndex) => {
    const facts = classifyProduct(item.product);
    if (item.product.tipo !== "torcedor" || facts.version !== "fan" || facts.fullPatch || isKidsProduct(item.product)) return [];
    return [{
      itemIndex,
      quantity: item.quantity,
      unitPriceCents: Math.round((facts.price ?? 0) * 100),
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
