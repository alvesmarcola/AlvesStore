import { CatalogPage } from "@/components/catalog-page";
import { images } from "@/data/images";
import { getSupabaseProducts } from "@/lib/server/supabase-catalog";
import { toCatalogPreview } from "@/lib/catalog";

export const revalidate = 300;

export const metadata = {
  title: "Kits infantis | Imports Alves",
  description: "Explore a linha de kits e camisas infantis da Imports Alves.",
  alternates: { canonical: "/infantil" },
};

export default async function KidsPage() {
  const products = await getSupabaseProducts();
  const kidsProducts = products.filter((product) => product.publico === "infantil" || /\b(?:kids|junior|youth|infantil|children)\b/i.test(`${product.nome} ${product.imageSeed}`));
  return <CatalogPage
    title="Infantil / Kids"
    description="Kits completos e camisas infantis para vestir a paixão pelo futebol desde cedo."
    products={kidsProducts.map(toCatalogPreview)}
    breadcrumb={[{ name: "Infantil" }]}
    heroImage={images.categories.female}
    heroEyebrow="Coleção infantil · Imports Alves"
  />;
}
