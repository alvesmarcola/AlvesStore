import type { CartItem } from "@/lib/types";

export function getPersistedCartItems(items: CartItem[]) {
  return items.filter((item) => !item.customization?.name && !item.customization?.number);
}
