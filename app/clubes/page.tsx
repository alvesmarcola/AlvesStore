import { CatalogPage } from "@/components/catalog-page";
import { getSupabaseProducts } from "@/lib/server/supabase-catalog";
import { toCatalogPreview } from "@/lib/catalog";
import { SITE_NAME } from "@/lib/site";

export const metadata = { title: `Clubes | ${SITE_NAME}`, description: `Explore camisas de clubes nacionais e internacionais na ${SITE_NAME}.` };

export const revalidate = 300;

export default async function ClubsPage() {
  const products = await getSupabaseProducts();
  return <CatalogPage title="Clubes" description="Camisas dos clubes que fazem história dentro e fora de campo." products={products.filter((product) => product.liga !== "selecoes" && product.liga !== "revisar" && product.clubeSlug !== "revisar").map(toCatalogPreview)} breadcrumb={[{ name: "Clubes" }]} heroEyebrow={`Coleção de Clubes · ${SITE_NAME}`} />;
}
