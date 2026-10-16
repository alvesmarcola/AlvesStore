import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { ConsentAndContact } from "@/components/consent-and-contact";
import { StoreShell } from "@/components/store-shell";
import { deriveCatalogLeagues } from "@/lib/catalog-taxonomy";
import { getSupabaseProducts } from "@/lib/server/supabase-catalog";
import "./globals.css";

export const revalidate = 300;

export const metadata: Metadata = {
  title: { default: "ALVES STORE | Vista seu time", template: "%s | ALVES STORE" },
  description: "Camisas de futebol para vestir seu time. Encontre modelos masculinos, femininos, retrô e seleções.",
  metadataBase: new URL("https://alves-store-green.vercel.app"),
  openGraph: { title: "ALVES STORE", description: "Vista seu time. Leve o jogo com você.", type: "website", locale: "pt_BR" },
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const leagues = deriveCatalogLeagues(await getSupabaseProducts()).map(({ slug, nome }) => ({ slug, nome }));
  return <html lang="pt-BR" data-scroll-behavior="smooth"><body><StoreShell><SiteHeader leagues={leagues} />{children}<SiteFooter /><ConsentAndContact /></StoreShell></body></html>;
}
