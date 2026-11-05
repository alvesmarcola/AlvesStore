import { redirect } from "next/navigation";
import { CatalogPage } from "@/components/catalog-page";
import { images } from "@/data/images";
import { getSupabaseProducts } from "@/lib/server/supabase-catalog";
import { toCatalogPreview } from "@/lib/catalog";
import { isRetroCategory, isRetroProduct, normalizeCategorySlug } from "@/lib/product-classification";
import { SITE_NAME } from "@/lib/site";

export const revalidate = 300;

export const metadata = { title: `Camisas masculinas | ${SITE_NAME}`, description: `Encontre camisas masculinas de futebol, versões torcedor, jogador e retrô na ${SITE_NAME}.`, alternates: { canonical: "/masculino" } };

export default async function MasculinoPage({ searchParams }: { searchParams: Promise<{ tipo?: string }> }) {
  const { tipo = "" } = await searchParams;
  const normalizedTipo = isRetroCategory(tipo) ? "retro" : normalizeCategorySlug(tipo);
  if (normalizedTipo === "regata") {
    redirect("/masculino?tipo=regata-nba");
  }
  const products = await getSupabaseProducts();
  const validTypes = ["torcedor", "jogador", "retro", "treino", "inverno", "regata-nba"];
  const initialType = validTypes.includes(normalizedTipo) ? normalizedTipo : "";
  const maleProducts = products
    .filter((product) => product.publico === "masculino" || product.publico === "unissex" || isRetroProduct(product))
    .map(toCatalogPreview);
  return <CatalogPage title="Masculino" description="Camisas e peças de futebol para levar a paixão do campo para todos os momentos." products={maleProducts} breadcrumb={[{ name: "Masculino" }]} initialType={initialType} heroImage={images.categories.male} heroEyebrow={`Coleção masculina · ${SITE_NAME}`} />;
}
