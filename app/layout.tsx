import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { ConsentAndContact } from "@/components/consent-and-contact";
import { FloatingWhatsApp } from "@/components/floating-whatsapp";
import { StoreShell } from "@/components/store-shell";
import leaguesData from "@/data/leagues.json";
import "./globals.css";

export const revalidate = 300;

export const metadata: Metadata = {
  title: { default: "Imports Alves | Camisas de Futebol e Artigos Esportivos", template: "%s | Imports Alves" },
  description: "Camisas de futebol importadas, versões torcedor, jogador, retrô e F1. Vista as cores do seu time com a Imports Alves.",
  metadataBase: new URL("https://importsalves.com.br"),
  openGraph: { title: "Imports Alves", description: "Vista a paixão pelo seu time com a Imports Alves.", type: "website", locale: "pt_BR" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const leagues = (leaguesData as { slug: string; nome: string }[]).map(({ slug, nome }) => ({ slug, nome }));
  return <html lang="pt-BR" data-scroll-behavior="smooth"><body><StoreShell><SiteHeader leagues={leagues} />{children}<SiteFooter /><ConsentAndContact /><FloatingWhatsApp /></StoreShell></body></html>;
}
