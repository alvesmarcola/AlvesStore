import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { ConsentAndContact } from "@/components/consent-and-contact";
import { StoreShell } from "@/components/store-shell";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "ALVES STORE | Vista seu time", template: "%s | ALVES STORE" },
  description: "Camisas de futebol para vestir seu time. Encontre modelos masculinos, femininos, retrô e seleções.",
  openGraph: { title: "ALVES STORE", description: "Vista seu time. Leve o jogo com você.", type: "website", locale: "pt_BR" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR" data-scroll-behavior="smooth"><body><StoreShell><SiteHeader />{children}<SiteFooter /><ConsentAndContact /></StoreShell></body></html>;
}
