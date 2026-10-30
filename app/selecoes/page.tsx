import { CatalogPage } from "@/components/catalog-page";
import { getSupabaseProducts } from "@/lib/server/supabase-catalog";
import { toCatalogPreview } from "@/lib/catalog";

export const metadata = { title: "Seleções nacionais | Alves Store", description: "Camisas das seleções nacionais de futebol." };

export const revalidate = 300;

export default async function SelectionsPage() {
  const products = await getSupabaseProducts();
  return <CatalogPage title="Seleções nacionais" description="Vista as cores das seleções do mundo." products={products.filter((product) => product.liga === "selecoes").map(toCatalogPreview)} breadcrumb={[{ name: "Seleções nacionais" }]} />;
}
