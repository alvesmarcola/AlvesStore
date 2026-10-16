import { CatalogPage } from "@/components/catalog-page";
import { getSupabaseProducts } from "@/lib/server/supabase-catalog";
import { toCatalogPreview } from "@/lib/catalog";

export const metadata = { title: "Camisas retrô | Alves Store", description: "Reviva a história do futebol com camisas retrô." };

export default async function RetroPage() {
  const products = await getSupabaseProducts();
  return <CatalogPage title="Camisas retrô" description="Clássicos que atravessam gerações." products={products.filter((product) => product.tipo === "retro").map(toCatalogPreview)} breadcrumb={[{ name: "Retrô" }]} initialType="retro" />;
}
