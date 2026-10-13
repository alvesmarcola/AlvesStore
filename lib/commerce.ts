import { storeConfig } from "@/config";
import type { CartItem } from "@/lib/types";
import { classifyProduct } from "@/lib/product-classification";
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
  const packageUnits = classified.reduce((sum, row) => sum + (row.facts.version === "fan" && !row.facts.fullPatch ? row.item.quantity : 0), 0);
  const baseShirtsTotal = classified.reduce((sum, row) => sum + (row.facts.price ?? 0) * row.item.quantity, 0);
  const packageEligibleBase = packageUnits * storeConfig.fanCommonPrice;
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
