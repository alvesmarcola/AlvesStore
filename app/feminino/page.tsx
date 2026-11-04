import { CatalogPage } from "@/components/catalog-page";
import { images } from "@/data/images";
import { getBundledFeminineProducts, getSupabaseProducts } from "@/lib/server/supabase-catalog";
import { toCatalogPreview } from "@/lib/catalog";
import { isFeminineProduct, prepareFeminineProduct } from "@/lib/feminine-catalog";
import { sortCatalogProducts } from "@/lib/catalog-order";
import { SITE_NAME } from "@/lib/site";

export const revalidate = 300;

export const metadata = { title: `Camisas femininas | ${SITE_NAME}`, description: `Camisas femininas e modelos exclusivos para torcer na ${SITE_NAME}.`, alternates: { canonical: "/feminino" } };

export default async function FemininoPage({ searchParams }: { searchParams: Promise<{ tipo?: string }> }) {
  const { tipo = "" } = await searchParams;
  const products = await getSupabaseProducts();
  const initialType = ["torcedor", "treino"].includes(tipo) ? tipo : "";
  const feminineBySlug = new Map<string, ReturnType<typeof prepareFeminineProduct>>();
  for (const product of [...getBundledFeminineProducts(), ...products.filter(isFeminineProduct).map(prepareFeminineProduct)]) {
    feminineBySlug.set(product.slug, product);
  }
  const feminineProducts = sortCatalogProducts([...feminineBySlug.values()]);
  return <CatalogPage title="Feminino" description="Camisas e peças para viver o futebol com o seu jeito e a sua torcida." products={feminineProducts.map(toCatalogPreview)} breadcrumb={[{ name: "Feminino" }]} initialType={initialType} heroImage={images.categories.female} heroEyebrow={`${feminineProducts.length} produtos · Coleção feminina · ${SITE_NAME}`} />;
}
