"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { CartItem, Product } from "@/lib/types";

interface CartState {
  items: CartItem[];
  drawerOpen: boolean;
  coupon: string;
  addItem: (product: Product, size: string, customization?: CartItem["customization"]) => void;
  removeItem: (lineId: string) => void;
  updateQuantity: (lineId: string, quantity: number) => void;
  setDrawerOpen: (open: boolean) => void;
  setCoupon: (coupon: string) => void;
  clearCart: () => void;
}

export const useCart = create<CartState>()(
  persist(
    (set) => ({
      items: [],
      drawerOpen: false,
      coupon: "",
      addItem: (product, size, customization) =>
        set((state) => {
          const lineId = `${product.id}-${size}-${customization?.name ?? ""}-${customization?.number ?? ""}`;
          const existing = state.items.find((item) => item.lineId === lineId);
          return {
            items: existing
              ? state.items.map((item) =>
                  item.lineId === lineId
                    ? { ...item, quantity: Math.min(item.quantity + 1, item.product.estoque) }
                    : item,
                )
              : [...state.items, { lineId, product, size, quantity: 1, customization }],
            drawerOpen: true,
          };
        }),
      removeItem: (lineId) => set((state) => ({ items: state.items.filter((item) => item.lineId !== lineId) })),
      updateQuantity: (lineId, quantity) =>
        set((state) => ({
          items: state.items.map((item) =>
            item.lineId === lineId
              ? { ...item, quantity: Math.min(item.product.estoque, Math.max(1, quantity)) }
              : item,
          ),
        })),
      setDrawerOpen: (drawerOpen) => set({ drawerOpen }),
      setCoupon: (coupon) => set({ coupon }),
      clearCart: () => set({ items: [], coupon: "" }),
    }),
    { name: "arquibancada90-cart", skipHydration: true, partialize: (state) => ({ items: state.items, coupon: state.coupon }) },
  ),
);
