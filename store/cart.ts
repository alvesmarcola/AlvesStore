"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { products } from "@/lib/catalog";
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function migratePersistedCart(value: unknown): Pick<CartState, "items" | "coupon"> {
  if (!isRecord(value)) return { items: [], coupon: "" };

  const items = Array.isArray(value.items)
    ? value.items.flatMap((entry): CartItem[] => {
      if (!isRecord(entry) || !isRecord(entry.product) || typeof entry.size !== "string") return [];
      const storedProduct = entry.product;
      if (typeof storedProduct.id !== "string") return [];
      const product = products.find((item) => item.id === storedProduct.id);
      if (!product || !product.tamanhos.includes(entry.size)) return [];

      const customization = isRecord(entry.customization)
        && typeof entry.customization.name === "string"
        && typeof entry.customization.number === "string"
        ? { name: entry.customization.name, number: entry.customization.number }
        : undefined;
      const quantity = typeof entry.quantity === "number" && Number.isFinite(entry.quantity)
        ? Math.max(1, Math.floor(entry.quantity))
        : 1;
      const lineId = `${product.id}-${entry.size}-${customization?.name ?? ""}-${customization?.number ?? ""}`;

      return [{ lineId, product, size: entry.size, quantity, ...(customization ? { customization } : {}) }];
    })
    : [];

  return { items, coupon: typeof value.coupon === "string" ? value.coupon : "" };
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
    {
      name: "arquibancada90-cart",
      version: 1,
      migrate: migratePersistedCart,
      skipHydration: true,
      partialize: (state) => ({ items: state.items, coupon: state.coupon }),
    },
  ),
);
