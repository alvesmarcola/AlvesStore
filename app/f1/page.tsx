import { CatalogPage } from "@/components/catalog-page";
import { toCatalogPreview } from "@/lib/catalog";
import { isFormulaOneProduct } from "@/lib/formula-one";
import { getBundledFormulaOneProducts, getSupabaseProducts } from "@/lib/server/supabase-catalog";
import { sortCatalogProducts } from "@/lib/catalog-order";
import type { Product } from "@/lib/types";

export const metadata = {
  title: "Fórmula 1 | Alves Store",
  description: "Explore os produtos de Fórmula 1 disponíveis na Alves Store.",
  alternates: { canonical: "/f1" },
};
export const revalidate = 300;

export default async function FormulaOnePage() {
  const productBySlug = new Map<string, Product>();
  for (const product of [...getBundledFormulaOneProducts(), ...(await getSupabaseProducts()).filter(isFormulaOneProduct)]) {
    productBySlug.set(product.slug, product);
  }
  const products = sortCatalogProducts([...productBySlug.values()]);
  return <CatalogPage
    title="Fórmula 1"
    description="Produtos para quem acompanha a velocidade e a emoção da Fórmula 1."
    products={products.map(toCatalogPreview)}
    breadcrumb={[{ name: "Fórmula 1" }]}
    heroEyebrow={`${products.length} produtos · catálogo Supabase`}
  />;
}
