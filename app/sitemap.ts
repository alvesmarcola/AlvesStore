import type { MetadataRoute } from "next";
import { leagues, products } from "@/lib/catalog";

const baseUrl = "https://alves-store-green.vercel.app";

export default function sitemap(): MetadataRoute.Sitemap {
  const staticPaths = ["", "/masculino", "/feminino", "/quem-somos", "/privacidade", "/politica-de-troca", "/termos-de-uso", "/politica-de-personalizacao", "/envios-e-prazos", "/compra-segura", "/como-comprar", "/contato", "/rastreio"];
  const leaguePaths = leagues.flatMap((league) => [
    `/ligas/${league.slug}`,
    ...league.clubes.map((club) => `/ligas/${league.slug}/${club.slug}`),
  ]);
  const productPaths = products.map((product) => `/produto/${product.slug}`);
  return [...staticPaths, ...leaguePaths, ...productPaths].map((path) => ({ url: `${baseUrl}${path}`, lastModified: new Date(), changeFrequency: "weekly", priority: path === "" ? 1 : 0.7 }));
}
