import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProductDetails } from "@/app/produto/[slug]/product-details";
import { getBundledRelatedProducts, getSupabaseProductBySlug, getSupabaseProducts } from "@/lib/server/supabase-catalog";
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
  return product
    ? { title: product.nome, description: `Garanta a sua ${product.nome} na ${SITE_NAME} com qualidade premium e envio para todo o Brasil.`, alternates: { canonical: `https://importsalves.com.br/produto/${product.slug}` } }
    : { title: "Produto não encontrado" };
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = await getSupabaseProductBySlug(slug);
  if (!product) notFound();
  const relatedProducts = getBundledRelatedProducts(product);
  const publicProduct = { ...product, id: product.slug };
  const publicRelatedProducts = relatedProducts.map((related) => ({ ...related, id: related.slug }));
  return <ProductDetails product={publicProduct} relatedProducts={publicRelatedProducts} />;
}
