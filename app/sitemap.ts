import type { MetadataRoute } from "next";
import { leagues, products } from "@/lib/catalog";

const baseUrl = "https://alvesstore.com.br";

export default function sitemap(): MetadataRoute.Sitemap {
  const staticPaths = ["", "/masculino", "/feminino", "/carrinho", "/checkout", "/login", "/rastreio", "/guia-de-medidas", "/quem-somos", "/privacidade", "/envios-e-prazos", "/compra-segura", "/como-comprar", "/contato", "/busca"];
  const leaguePaths = leagues.flatMap((league) => [
    `/ligas/${league.slug}`,
    ...league.clubes.map((club) => `/ligas/${league.slug}/${club.slug}`),
  ]);
  const productPaths = products.map((product) => `/produto/${product.slug}`);
  return [...staticPaths, ...leaguePaths, ...productPaths].map((path) => ({ url: `${baseUrl}${path}`, lastModified: new Date(), changeFrequency: "weekly", priority: path === "" ? 1 : 0.7 }));
}
