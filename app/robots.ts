import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/api/yupoo-image"],
      disallow: ["/checkout", "/carrinho", "/admin", "/pedido", "/api/"],
    },
    sitemap: "https://importsalves.com.br/sitemap.xml",
  };
}
