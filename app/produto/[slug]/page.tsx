import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProductDetails } from "@/app/produto/[slug]/product-details";
import { getSupabaseProductBySlug, getSupabaseProducts } from "@/lib/server/supabase-catalog";

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
    ? { title: product.nome, description: `Confira ${product.nome} no catálogo atualizado da Alves Store.`, alternates: { canonical: `https://alves-store-green.vercel.app/produto/${product.slug}` } }
    : { title: "Produto não encontrado" };
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [product, products] = await Promise.all([getSupabaseProductBySlug(slug), getSupabaseProducts()]);
  if (!product) notFound();
  const relatedProducts = products.filter((item) => item.id !== product.id && ((product.clubeSlug !== "revisar" && item.clubeSlug === product.clubeSlug) || (product.liga !== "revisar" && item.liga === product.liga))).slice(0, 5);
  return <ProductDetails product={product} relatedProducts={relatedProducts} />;
}
