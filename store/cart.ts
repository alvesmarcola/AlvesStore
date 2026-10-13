"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { products } from "@/lib/catalog";
import type { CartItem, Product } from "@/lib/types";
import { getAvailablePatches } from "@/lib/patch-compatibility";

interface CartState {
  items: CartItem[];
  drawerOpen: boolean;
  addItem: (product: Product, size: string, customization?: CartItem["customization"], patches?: CartItem["patches"]) => void;
  removeItem: (lineId: string) => void;
  updateQuantity: (lineId: string, quantity: number) => void;
  setDrawerOpen: (open: boolean) => void;
  clearCart: () => void;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function migratePersistedCart(value: unknown): Pick<CartState, "items"> {
  if (!isRecord(value)) return { items: [] };

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
      const allowed = getAvailablePatches(product);
      const patches = Array.isArray(entry.patches) ? entry.patches.flatMap((candidate) => {
        if (!isRecord(candidate) || typeof candidate.id !== "string" || typeof candidate.position !== "string") return [];
        const option = allowed.find((patch) => patch.id === candidate.id && patch.positions.includes(candidate.position as never));
        return option ? [{ id: option.id, position: candidate.position as NonNullable<CartItem["patches"]>[number]["position"] }] : [];
      }) : [];
      const quantity = typeof entry.quantity === "number" && Number.isFinite(entry.quantity)
        ? Math.max(1, Math.floor(entry.quantity))
        : 1;
      const lineId = `${product.id}-${entry.size}-${customization?.name ?? ""}-${customization?.number ?? ""}-${patches.map(({ id, position }) => `${id}:${position}`).sort().join(",")}`;

      return [{ lineId, product, size: entry.size, quantity, ...(customization ? { customization } : {}), ...(patches.length ? { patches } : {}) }];
    })
    : [];

  return { items };
}

export const useCart = create<CartState>()(
  persist(
    (set) => ({
      items: [],
      drawerOpen: false,
      addItem: (product, size, customization, patches) =>
        set((state) => {
          const lineId = `${product.id}-${size}-${customization?.name ?? ""}-${customization?.number ?? ""}-${(patches ?? []).map(({ id, position }) => `${id}:${position}`).sort().join(",")}`;
          const existing = state.items.find((item) => item.lineId === lineId);
          return {
            items: existing
              ? state.items.map((item) =>
                  item.lineId === lineId
                    ? { ...item, quantity: item.quantity + 1 }
                    : item,
                )
              : [...state.items, { lineId, product, size, quantity: 1, customization, ...(patches?.length ? { patches } : {}) }],
            drawerOpen: true,
          };
        }),
      removeItem: (lineId) => set((state) => ({ items: state.items.filter((item) => item.lineId !== lineId) })),
      updateQuantity: (lineId, quantity) =>
        set((state) => ({
          items: state.items.map((item) =>
            item.lineId === lineId
              ? { ...item, quantity: Math.max(1, Math.floor(quantity)) }
              : item,
          ),
        })),
      setDrawerOpen: (drawerOpen) => set({ drawerOpen }),
      clearCart: () => set({ items: [] }),
    }),
    {
      name: "arquibancada90-cart",
      version: 3,
      migrate: migratePersistedCart,
      skipHydration: true,
      partialize: (state) => ({ items: state.items }),
    },
  ),
);
