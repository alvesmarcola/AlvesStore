import { storeConfig } from "@/config";
import type { CartItem } from "@/lib/types";

export function getPackagePrice(units: number) {
  const bundlesOfThree = Math.floor(units / 3);
  const remainder = units % 3;
  return bundlesOfThree * storeConfig.threeShirtPrice
    + (remainder === 2 ? storeConfig.twoShirtPrice : remainder * storeConfig.shirtPrice);
}

export function qualifiesForFreeShipping(items: CartItem[]) {
  return items.reduce((sum, item) => sum + item.quantity, 0) >= storeConfig.freeShippingQuantity;
}

export function getCartPricing(items: CartItem[], coupon: string) {
  const units = items.reduce((sum, item) => sum + item.quantity, 0);
  const customizationTotal = items.reduce(
    (sum, item) => sum + (item.customization ? storeConfig.customizationPrice : 0) * item.quantity,
    0,
  );
  const packagePrice = getPackagePrice(units);
  const subtotal = units * storeConfig.shirtPrice + customizationTotal;
  const bundleDiscount = subtotal - customizationTotal - packagePrice;
  const couponDiscount =
    coupon.trim().toUpperCase() === storeConfig.firstPurchaseCoupon
      ? (subtotal - bundleDiscount) * storeConfig.firstPurchaseDiscount
      : 0;
  return { subtotal, couponDiscount, bundleDiscount, totalDiscount: couponDiscount + bundleDiscount };
}
