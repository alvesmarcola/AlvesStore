import { CatalogPage } from "@/components/catalog-page";
import { toCatalogPreview } from "@/lib/catalog";
import { isFormulaOneProduct } from "@/lib/formula-one";
import { getSupabaseProducts } from "@/lib/server/supabase-catalog";

export const metadata = {
  title: "Fórmula 1 | Alves Store",
  description: "Explore os produtos de Fórmula 1 disponíveis na Alves Store.",
  alternates: { canonical: "/f1" },
};
export const revalidate = 300;

export default async function FormulaOnePage() {
  const products = (await getSupabaseProducts()).filter(isFormulaOneProduct);
  return <CatalogPage
    title="Fórmula 1"
    description="Produtos para quem acompanha a velocidade e a emoção da Fórmula 1."
    products={products.map(toCatalogPreview)}
    breadcrumb={[{ name: "Fórmula 1" }]}
    heroEyebrow={`${products.length} produtos · catálogo Supabase`}
  />;
}
