import type { MetadataRoute } from "next";
import { deriveCatalogLeagues } from "@/lib/catalog-taxonomy";
import { getSupabaseProducts } from "@/lib/server/supabase-catalog";

const baseUrl = "https://alves-store-green.vercel.app";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const products = await getSupabaseProducts();
  const leagues = deriveCatalogLeagues(products);
  const staticPaths = ["", "/masculino", "/feminino", "/infantil", "/quem-somos", "/privacidade", "/politica-de-troca", "/termos-de-uso", "/politica-de-personalizacao", "/envios-e-prazos", "/compra-segura", "/como-comprar", "/contato", "/rastreio", "/duvidas", "/guia-de-medidas"];
  const leaguePaths = leagues.flatMap((league) => [
    `/ligas/${league.slug}`,
    ...league.clubes.map((club) => `/ligas/${league.slug}/${club.slug}`),
  ]);
  const productPaths = products.map((product) => `/produto/${product.slug}`);
  return [...staticPaths, ...leaguePaths, ...productPaths].map((path) => ({ url: `${baseUrl}${path}`, lastModified: new Date(), changeFrequency: "weekly", priority: path === "" ? 1 : 0.7 }));
}
