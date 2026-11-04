import { CatalogPage } from "@/components/catalog-page";
import { getSupabaseProducts } from "@/lib/server/supabase-catalog";
import { toCatalogPreview } from "@/lib/catalog";

export const metadata = { title: "Clubes | Imports Alves", description: "Explore camisas de clubes nacionais e internacionais na Imports Alves." };

export const revalidate = 300;

export default async function ClubsPage() {
  const products = await getSupabaseProducts();
  return <CatalogPage title="Clubes" description="Camisas dos clubes que fazem história dentro e fora de campo." products={products.filter((product) => product.liga !== "selecoes" && product.liga !== "revisar" && product.clubeSlug !== "revisar").map(toCatalogPreview)} breadcrumb={[{ name: "Clubes" }]} heroEyebrow="Coleção de Clubes · Imports Alves" />;
}
