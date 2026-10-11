import { storeConfig } from "@/config";
import type { CartItem } from "@/lib/types";

export function getCartPricing(items: CartItem[], coupon: string) {
  const subtotal = items.reduce(
    (sum, item) => sum + (item.product.preco + (item.customization ? storeConfig.customizationPrice : 0)) * item.quantity,
    0,
  );
  const units = items.reduce((sum, item) => sum + item.quantity, 0);
  const couponDiscount =
    coupon.trim().toUpperCase() === storeConfig.firstPurchaseCoupon
      ? subtotal * storeConfig.firstPurchaseDiscount
      : 0;
  const bundleDiscount = units >= 2 ? subtotal * storeConfig.bundleDiscount : 0;
  return { subtotal, couponDiscount, bundleDiscount, totalDiscount: couponDiscount + bundleDiscount };
}
