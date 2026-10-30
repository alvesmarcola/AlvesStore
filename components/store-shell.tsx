"use client";

import { useEffect } from "react";
import dynamic from "next/dynamic";
import { useCart } from "@/store/cart";

const CartDrawer = dynamic(() => import("@/components/cart-drawer").then((mod) => mod.CartDrawer), { ssr: false });

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
