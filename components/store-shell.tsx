"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { CartDrawer } from "@/components/cart-drawer";
import { ConsentAndContact } from "@/components/consent-and-contact";
import { FloatingWhatsApp } from "@/components/floating-whatsapp";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { useCart } from "@/store/cart";
import leaguesData from "@/data/leagues.json";

export function StoreShell({ children, hasRegatas, hasNbaRegatas }: { children: React.ReactNode; hasRegatas: boolean; hasNbaRegatas: boolean }) {
  const setDrawerOpen = useCart((state) => state.setDrawerOpen);
  const pathname = usePathname();
  const isAdmin = pathname === "/admin" || pathname.startsWith("/admin/");
  useEffect(() => {
    if (isAdmin) return;
    void useCart.persist.rehydrate();
    function openCart() { setDrawerOpen(true); }
    window.addEventListener("open-cart", openCart);
    return () => window.removeEventListener("open-cart", openCart);
  }, [isAdmin, setDrawerOpen]);
  if (isAdmin) return children;
  const leagues = (leaguesData as { slug: string; nome: string }[]).map(({ slug, nome }) => ({ slug, nome }));
  return <><SiteHeader leagues={leagues} hasRegatas={hasRegatas} hasNbaRegatas={hasNbaRegatas} />{children}<SiteFooter /><ConsentAndContact /><FloatingWhatsApp /><CartDrawer /></>;
}
