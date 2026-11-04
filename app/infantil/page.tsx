import { CatalogPage } from "@/components/catalog-page";
import { images } from "@/data/images";
import { getSupabaseProducts } from "@/lib/server/supabase-catalog";
import { toCatalogPreview } from "@/lib/catalog";
import { SITE_NAME } from "@/lib/site";

export const revalidate = 300;

export const metadata = {
  title: `Kits infantis | ${SITE_NAME}`,
  description: `Explore a linha de kits e camisas infantis da ${SITE_NAME}.`,
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
    heroEyebrow={`Coleção infantil · ${SITE_NAME}`}
  />;
}
