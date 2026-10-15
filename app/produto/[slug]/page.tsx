import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getSupabaseProduct, getSupabaseProducts } from "@/lib/server/supabase-catalog";
import { ProductDetails } from "@/app/produto/[slug]/product-details";

export const revalidate = 300;

export async function generateStaticParams() {
  const products = await getSupabaseProducts();
  return products.map((product) => ({ slug: product.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const product = await getSupabaseProduct(slug);
  return product ? { title: product.nome, description: `Confira o preço e as condições de personalização de ${product.nome} na ALVES STORE.`, alternates: { canonical: `https://alves-store-green.vercel.app/produto/${product.slug}` } } : { title: "Produto não encontrado" };
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = await getSupabaseProduct(slug);
  if (!product) notFound();
  return <ProductDetails product={product} />;
}
