import { storeConfig } from "@/config";
import type { CartItem } from "@/lib/types";

export function getPackagePrice(units: number) {
  const normalizedUnits = Math.max(0, Math.floor(units));
  const bundlesOfThree = Math.floor(normalizedUnits / 3);
  const remainder = normalizedUnits % 3;
  return bundlesOfThree * storeConfig.threeShirtPrice
    + (remainder === 2 ? storeConfig.twoShirtPrice : remainder * storeConfig.shirtPrice);
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
  const standardUnits = items.reduce((sum, item) => sum + (item.product.tipo === "retro" ? 0 : item.quantity), 0);
  const retroUnits = units - standardUnits;
  const customizationTotal = items.reduce(
    (sum, item) => sum + (item.customization ? storeConfig.customizationPrice : 0) * item.quantity,
    0,
  );
  const packagePrice = getPackagePrice(standardUnits) + retroUnits * storeConfig.retroShirtPrice;
  const shipping = getShippingCents(units) / 100;
  const subtotal = standardUnits * storeConfig.shirtPrice + retroUnits * storeConfig.retroShirtPrice + customizationTotal;
  const bundleDiscount = subtotal - customizationTotal - packagePrice;
  const productsTotal = subtotal - bundleDiscount;
  return { subtotal, bundleDiscount, total: productsTotal, shipping, grandTotal: productsTotal + shipping };
}
