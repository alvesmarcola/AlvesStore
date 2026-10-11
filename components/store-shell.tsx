"use client";

import { useEffect } from "react";
import { CartDrawer } from "@/components/cart-drawer";
import { useCart } from "@/store/cart";

export function StoreShell({ children }: { children: React.ReactNode }) {
  const setDrawerOpen = useCart((state) => state.setDrawerOpen);
  useEffect(() => {
    void useCart.persist.rehydrate();
    function openCart() { setDrawerOpen(true); }
    window.addEventListener("open-cart", openCart);
    return () => window.removeEventListener("open-cart", openCart);
  }, [setDrawerOpen]);
  return <>{children}<CartDrawer /></>;
}
