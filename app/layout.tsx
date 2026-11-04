import type { Metadata } from "next";
import { StoreShell } from "@/components/store-shell";
import { SITE_NAME } from "@/lib/site";
import "./globals.css";

export const revalidate = 300;

export const metadata: Metadata = {
  title: { default: `${SITE_NAME} | Camisas de Futebol e Artigos Esportivos`, template: `%s | ${SITE_NAME}` },
  description: `Camisas de futebol importadas, versões torcedor, jogador, retrô e F1. Vista as cores do seu time com a ${SITE_NAME}.`,
  metadataBase: new URL("https://importsalves.com.br"),
  openGraph: { title: SITE_NAME, description: `Vista a paixão pelo seu time com a ${SITE_NAME}.`, type: "website", locale: "pt_BR" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR" data-scroll-behavior="smooth"><body><StoreShell>{children}</StoreShell></body></html>;
}
