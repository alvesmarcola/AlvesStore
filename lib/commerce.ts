import { storeConfig } from "@/config";
import type { CartItem } from "@/lib/types";
import { classifyProduct, getProductSizeSurcharge, isFreeShippingProduct, isManualProduct, isNbaTankTop, isPackageEligible, isRetroProduct, isTestProduct } from "@/lib/product-classification";
import { getAvailablePatches } from "@/lib/patch-compatibility";
import { formatCustomization } from "@/lib/customization";
import { calcularPromoBlackFriday, isBlackFridayEligibleShirt } from "@/lib/black-friday";

export function getPackagePrice(units: number) {
  const normalizedUnits = Math.max(0, Math.floor(units));
  const bundlesOfThree = Math.floor(normalizedUnits / 3);
  const remainder = normalizedUnits % 3;
  return bundlesOfThree * storeConfig.threeShirtPrice
    + (remainder === 2 ? storeConfig.twoShirtPrice : remainder * storeConfig.fanCommonPrice);
}

export function qualifiesForFreeShipping(items: CartItem[]) {
  const chargeableUnits = items.reduce((sum, item) => sum + (isFreeShippingProduct(item.product) ? 0 : item.quantity), 0);
  return chargeableUnits >= storeConfig.freeShippingQuantity;
}

export function getShippingCents(units: number) {
  const quantity = Math.max(0, Math.floor(units));
  if (quantity >= storeConfig.freeShippingQuantity) return 0;
  return quantity >= 1 ? storeConfig.shippingPrice * 100 : 0;
}

export function getShippingOfferText() {
  const currency = (amount: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(amount);
  return `Oferta de quantidade válida para torcedor comum: 2 por ${currency(storeConfig.twoShirtPrice)} ou 3 por ${currency(storeConfig.threeShirtPrice)}. Camisas comuns: ${currency(storeConfig.fanCommonPrice)}; Regatas NBA: ${currency(storeConfig.nbaTankTopPrice)}. Personalização: +${currency(storeConfig.customizationPrice)}. Frete de ${currency(storeConfig.shippingPrice)} para 1 ou 2 produtos e grátis em pedidos de ${storeConfig.freeShippingQuantity} ou mais.`;
}

export function getCartPricing(items: CartItem[]) {
  const shippingUnits = items.reduce((sum, item) => sum + (isFreeShippingProduct(item.product) ? 0 : item.quantity), 0);
  const classified = items.map((item) => ({ item, facts: classifyProduct(item.product) }));
  const promo = calcularPromoBlackFriday(items, new Date());
  const packageUnits = promo.desconto > 0 ? 0 : classified.reduce((sum, row) => sum + (isPackageEligible(row.item.product) ? row.item.quantity : 0), 0);
  const baseShirtsCents = classified.reduce((sum, row) => sum + Math.round(((row.facts.price ?? 0) + (isManualProduct(row.item.product) ? 0 : getProductSizeSurcharge(row.item.size))) * 100) * row.item.quantity, 0);
  const packageEligibleBaseCents = classified.reduce((sum, row) => sum + (isPackageEligible(row.item.product) ? storeConfig.fanCommonPrice * row.item.quantity * 100 : 0), 0);
  const customizationCents = items.reduce(
    (sum, item) => sum + (formatCustomization(item.customization) ? Math.round(storeConfig.customizationPrice * 100) : 0) * item.quantity,
    0,
  );
  const shippingCents = getShippingCents(shippingUnits);
  const shipping = shippingCents / 100;
  const patchesCents = classified.reduce((sum, row) => sum + row.item.quantity * (row.item.patches ?? []).reduce((patchSum, selected) => {
    const option = getAvailablePatches(row.item.product).find((patch) => patch.id === selected.id && patch.positions.includes(selected.position));
    return patchSum + (option?.priceCents ?? 0);
  }, 0), 0);
  const promoDiscountCents = Math.round(promo.desconto * 100);
  const subtotalCents = baseShirtsCents + customizationCents + patchesCents;
  const bundleDiscountCents = promoDiscountCents > 0 ? 0 : packageEligibleBaseCents - getPackagePrice(packageUnits) * 100;
  const productsTotalCents = baseShirtsCents - bundleDiscountCents - promoDiscountCents + customizationCents + patchesCents;
  const tankTopQuantity = items.reduce((sum, item) => sum + (isNbaTankTop(item.product) ? item.quantity : 0), 0);
  const eligibleShirtQuantity = items.reduce((sum, item) => sum + (isBlackFridayEligibleShirt(item.product) ? item.quantity : 0), 0);
  const discountedQuantity = promo.itensComDesconto.reduce((sum, item) => sum + item.quantity, 0);
  const promoNotice = promo.ativa && (tankTopQuantity !== discountedQuantity || eligibleShirtQuantity !== discountedQuantity)
    ? tankTopQuantity === discountedQuantity
      ? "Adicione uma regata NBA e ganhe 50% na sua camisa."
      : eligibleShirtQuantity === discountedQuantity
        ? "Adicione uma camisa de time e ganhe 50% de desconto."
        : "Adicione outra regata NBA e ganhe 50% na sua camisa."
    : "";
  const needsReview = classified.some((row) => row.facts.reviewRequired);
  const patchCount = items.reduce((sum, item) => sum + (item.patches?.length ?? 0), 0);
  const totalCents = productsTotalCents + shippingCents;
  return {
    subtotal: subtotalCents / 100,
    bundleDiscount: bundleDiscountCents / 100,
    promoDiscount: promoDiscountCents / 100,
    promoActive: promo.ativa,
    promoNotice,
    total: productsTotalCents / 100,
    shipping,
    grandTotal: totalCents / 100,
    needsReview,
    patchCount,
  };
}

export function getProductCategoryKey(product: CartItem["product"]) {
  if (isRetroProduct(product)) return "retro";
  const facts = classifyProduct(product);
  if (facts.fullPatch) return "full-patch";
  if (isNbaTankTop(product)) return "regata-nba";
  if (product.tipo === "regata") return "regata";
  if (product.tipo === "goleiro") return "goleiro";
  if (facts.version === "fan") return "torcedor";
  if (facts.version === "player") return "jogador";
  if (facts.version === "retro") return "retro";
  if (facts.version === "goalkeeper") return "goleiro";
  return product.tipo;
}

export function getProductOfferText(product: CartItem["product"]) {
  if (isManualProduct(product)) {
    const facts = classifyProduct(product);
    const shipping = isTestProduct(product)
      ? "Frete grátis."
      : `Frete: ${new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(storeConfig.shippingPrice)} (1 ou 2 camisas) ou grátis (${storeConfig.freeShippingQuantity}+).`;
    return `Preço cadastrado: ${new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(facts.price ?? 0)}; sem oferta por quantidade. ${shipping}`;
  }
  const facts = classifyProduct(product);
  const shipping = `Frete: ${new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(storeConfig.shippingPrice)} (1 ou 2 camisas) ou grátis (${storeConfig.freeShippingQuantity}+).`;
  if (isNbaTankTop(product)) {
    return `Regata NBA: ${new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(storeConfig.nbaTankTopPrice)} por regata; sem oferta por quantidade. ${shipping}`;
  }
  if (isPackageEligible(product)) {
    return `Torcedor comum: 1 por R$ ${storeConfig.fanCommonPrice}, 2 por R$ ${storeConfig.twoShirtPrice} ou 3 por R$ ${storeConfig.threeShirtPrice}. ${shipping}`;
  }
  if (facts.price !== null) {
    const category = facts.fullPatch ? "Full Patches" : (facts.version === "retro" || isRetroProduct(product)) ? "Retrô" : facts.version === "player" ? "Jogador" : facts.version === "fan" ? "Torcedor manga longa" : facts.version === "goalkeeper" ? "Goleiro" : "Produto";
    return `${category}: ${new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(facts.price)} por camisa; sem oferta por quantidade. ${shipping}`;
  }
  return `Preço em revisão. ${shipping}`;
}
