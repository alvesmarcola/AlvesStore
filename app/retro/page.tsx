import { CatalogPage } from "@/components/catalog-page";
import { getSupabaseProducts } from "@/lib/server/supabase-catalog";
import { toCatalogPreview } from "@/lib/catalog";
import { isRetroProduct } from "@/lib/product-classification";
import { SITE_NAME } from "@/lib/site";

export const metadata = { title: `Camisas retrô | ${SITE_NAME}`, description: `Reviva a história do futebol com camisas retrô clássicas na ${SITE_NAME}.` };

export const revalidate = 300;

export default async function RetroPage() {
  const products = await getSupabaseProducts();
  const retroProducts = products.filter(isRetroProduct).map(toCatalogPreview);
  return <CatalogPage title="Camisas retrô" description="Clássicos que atravessam gerações." products={retroProducts} breadcrumb={[{ name: "Retrô" }]} initialType="retro" heroEyebrow={`Clássicos Retrô · ${SITE_NAME}`} />;
}
