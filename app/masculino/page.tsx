import { CatalogPage } from "@/components/catalog-page";
import { images } from "@/data/images";
import { getSupabaseProducts } from "@/lib/server/supabase-catalog";
import { toCatalogPreview } from "@/lib/catalog";

export const revalidate = 300;

export const metadata = { title: "Camisas masculinas", description: "Encontre camisas masculinas de futebol, versões torcedor, jogador e retrô.", alternates: { canonical: "/masculino" } };

export default async function MasculinoPage({ searchParams }: { searchParams: Promise<{ tipo?: string }> }) {
  const { tipo = "" } = await searchParams;
  const products = await getSupabaseProducts();
  const initialType = ["torcedor", "jogador", "retro", "treino", "inverno", "regata"].includes(tipo) ? tipo : "";
  return <CatalogPage title="Masculino" description="Camisas e peças de futebol para levar a paixão do campo para todos os momentos." products={products.filter((product) => product.publico === "masculino" || product.publico === "unissex").map(toCatalogPreview)} breadcrumb={[{ name: "Masculino" }]} initialType={initialType} heroImage={images.categories.male} heroEyebrow="Coleção masculina · alves store" />;
}
