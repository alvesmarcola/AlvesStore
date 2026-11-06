import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { ProductDetails } from "@/app/produto/[slug]/product-details";
import { getBundledRelatedProducts, getSupabaseProductBySlug, getSupabaseProducts } from "@/lib/server/supabase-catalog";
import { ADMIN_SESSION_COOKIE, isValidAdminSessionValue } from "@/lib/server/admin-auth";
import { classifyProduct } from "@/lib/product-classification";
import { SITE_NAME } from "@/lib/site";

export const revalidate = 300;
export const dynamicParams = true;

export async function generateStaticParams() {
  const products = await getSupabaseProducts();
  return products.map((product) => ({ slug: product.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const product = await getSupabaseProductBySlug(slug);
  if (!product) {
    return { title: "Produto não encontrado" };
  }
  const clubText = product.clube && product.clube !== "revisar" ? ` do ${product.clube}` : "";
  const seasonText = product.temporada && product.temporada !== "revisar" ? ` temporada ${product.temporada}` : "";
  const description = product.description
    ? `${product.nome}. ${product.description.slice(0, 140)}...`
    : `Compre a camisa ${product.nome}${clubText}${seasonText} na ${SITE_NAME}. Tamanhos ${product.tamanhos.join(", ")}, frete com rastreio e parcelamento em até 12x.`;

  return {
    title: `${product.nome} | ${SITE_NAME}`,
    description,
    alternates: { canonical: `https://importsalves.com.br/produto/${product.slug}` },
    openGraph: {
      title: `${product.nome} | ${SITE_NAME}`,
      description,
      url: `https://importsalves.com.br/produto/${product.slug}`,
      images: product.images?.[0]?.src ? [{ url: product.images[0].src }] : [],
    },
  };
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(ADMIN_SESSION_COOKIE)?.value ?? "";
  const isAdmin = isValidAdminSessionValue(sessionCookie);

  const product = await getSupabaseProductBySlug(slug, { allowHidden: isAdmin });
  if (!product) notFound();
  const relatedProducts = getBundledRelatedProducts(product);
  const publicProduct = { ...product, id: product.slug };
  const publicRelatedProducts = relatedProducts.map((related) => ({ ...related, id: related.slug }));

  const classification = classifyProduct(product);
  const basePrice = classification.price;
  const inStock = product.tamanhos && product.tamanhos.length > 0;
  const imageUrls = (product.images ?? [])
    .map((img) => img.src)
    .filter((src): src is string => typeof src === "string" && src.length > 0)
    .map((src) => {
      try {
        return new URL(src, "https://importsalves.com.br").toString();
      } catch {
        return src;
      }
    });

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.nome,
    description: product.description || `Camisa ${product.nome} disponível na Imports Alves.`,
    image: imageUrls,
    sku: product.slug,
    ...(basePrice === null ? {} : {
      offers: {
        "@type": "Offer",
        url: `https://importsalves.com.br/produto/${product.slug}`,
        priceCurrency: "BRL",
        price: basePrice,
        availability: inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
        seller: {
          "@type": "Organization",
          name: SITE_NAME,
        },
      },
    }),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c"),
        }}
      />
      <ProductDetails product={publicProduct} relatedProducts={publicRelatedProducts} />
    </>
  );
}
