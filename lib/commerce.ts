import { storeConfig } from "@/config";
import type { CartItem } from "@/lib/types";
import { classifyProduct, getProductSizeSurcharge, isPackageEligible } from "@/lib/product-classification";
import { getAvailablePatches } from "@/lib/patch-compatibility";

export function getPackagePrice(units: number) {
  const normalizedUnits = Math.max(0, Math.floor(units));
  const bundlesOfThree = Math.floor(normalizedUnits / 3);
  const remainder = normalizedUnits % 3;
  return bundlesOfThree * storeConfig.threeShirtPrice
    + (remainder === 2 ? storeConfig.twoShirtPrice : remainder * storeConfig.fanCommonPrice);
}

export function qualifiesForFreeShipping(items: CartItem[]) {
  return items.reduce((sum, item) => sum + item.quantity, 0) >= storeConfig.freeShippingQuantity;
}

export function getShippingCents(units: number) {
  const quantity = Math.max(0, Math.floor(units));
  if (quantity >= storeConfig.freeShippingQuantity) return 0;
  if (quantity === 2) return storeConfig.shippingTwoShirts * 100;
  return quantity === 1 ? storeConfig.shippingOneShirt * 100 : 0;
}

export function getCartPricing(items: CartItem[]) {
  const units = items.reduce((sum, item) => sum + item.quantity, 0);
  const classified = items.map((item) => ({ item, facts: classifyProduct(item.product) }));
  const packageUnits = classified.reduce((sum, row) => sum + (isPackageEligible(row.item.product) ? row.item.quantity : 0), 0);
  const baseShirtsTotal = classified.reduce((sum, row) => sum + ((row.facts.price ?? 0) + getProductSizeSurcharge(row.item.size)) * row.item.quantity, 0);
  const packageEligibleBase = classified.reduce((sum, row) => sum + (isPackageEligible(row.item.product) ? storeConfig.fanCommonPrice * row.item.quantity : 0), 0);
  const customizationTotal = items.reduce(
    (sum, item) => sum + (item.customization ? storeConfig.customizationPrice : 0) * item.quantity,
    0,
  );
  const shipping = getShippingCents(units) / 100;
  const patchesPrice = classified.reduce((sum, row) => sum + row.item.quantity * (row.item.patches ?? []).reduce((patchSum, selected) => {
    const option = getAvailablePatches(row.item.product).find((patch) => patch.id === selected.id && patch.positions.includes(selected.position));
    return patchSum + (option?.priceCents ?? 0);
  }, 0) / 100, 0);
  const subtotal = baseShirtsTotal + customizationTotal + patchesPrice;
  const bundleDiscount = packageEligibleBase - getPackagePrice(packageUnits);
  const productsTotal = baseShirtsTotal - bundleDiscount + customizationTotal + patchesPrice;
  const needsReview = classified.some((row) => row.facts.reviewRequired);
  const patchCount = items.reduce((sum, item) => sum + (item.patches?.length ?? 0), 0);
  return { subtotal, bundleDiscount, total: productsTotal, shipping, grandTotal: productsTotal + shipping, needsReview, patchCount };
}

export function getProductCategoryKey(product: CartItem["product"]) {
  const facts = classifyProduct(product);
  if (facts.fullPatch) return "full-patch";
  if (product.tipo === "goleiro") return "goleiro";
  if (facts.version === "fan") return "torcedor";
  if (facts.version === "player") return "jogador";
  if (facts.version === "retro") return "retro";
  if (facts.version === "goalkeeper") return "goleiro";
  return product.tipo;
}

export function getProductOfferText(product: CartItem["product"]) {
  const facts = classifyProduct(product);
  const shipping = "Frete: R$ 20,00 (1 camisa), R$ 30,00 (2) ou grátis (3+).";
  if (isPackageEligible(product)) {
    return `Torcedor comum: 1 por R$ ${storeConfig.fanCommonPrice}, 2 por R$ ${storeConfig.twoShirtPrice} ou 3 por R$ ${storeConfig.threeShirtPrice}. ${shipping}`;
  }
  if (facts.price !== null) {
    const category = facts.fullPatch ? "Full Patches" : facts.version === "retro" ? "Retrô" : facts.version === "player" ? "Jogador" : facts.version === "fan" ? "Torcedor manga longa" : facts.version === "goalkeeper" ? "Goleiro" : "Produto";
    return `${category}: ${new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(facts.price)} por camisa; sem oferta por quantidade. ${shipping}`;
  }
  return `Preço em revisão. ${shipping}`;
}
