import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/checkout", "/carrinho", "/admin", "/pedido"] },
    sitemap: "https://importsalves.com.br/sitemap.xml",
  };
}
