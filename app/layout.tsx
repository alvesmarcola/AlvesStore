import type { Metadata } from "next";
import { StoreShell } from "@/components/store-shell";
import { SITE_NAME } from "@/lib/site";
import { getSupabaseProducts } from "@/lib/server/supabase-catalog";
import { isNbaTankTop } from "@/lib/product-classification";
import "./globals.css";

export const revalidate = 300;

export const metadata: Metadata = {
  title: { default: `${SITE_NAME} | Camisas de Futebol e Artigos Esportivos`, template: `%s | ${SITE_NAME}` },
  description: `Camisas de futebol importadas, versões torcedor, jogador, retrô e F1. Vista as cores do seu time com a ${SITE_NAME}.`,
  metadataBase: new URL("https://importsalves.com.br"),
  openGraph: { title: SITE_NAME, description: `Vista a paixão pelo seu time com a ${SITE_NAME}.`, type: "website", locale: "pt_BR" },
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const products = await getSupabaseProducts();
  const masculineProducts = products.filter((product) => product.publico === "masculino" || product.publico === "unissex");
  const hasRegatas = masculineProducts.some((product) => product.tipo === "regata");
  const hasNbaRegatas = masculineProducts.some(isNbaTankTop);
  return <html lang="pt-BR" data-scroll-behavior="smooth"><body><StoreShell hasRegatas={hasRegatas} hasNbaRegatas={hasNbaRegatas}>{children}</StoreShell></body></html>;
}
