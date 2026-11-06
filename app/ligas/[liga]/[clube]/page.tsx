import { notFound } from "next/navigation";
import { CatalogPage } from "@/components/catalog-page";
import { catalogLabel } from "@/lib/catalog-taxonomy";
import { productImageAsset, toCatalogPreview } from "@/lib/catalog";
import { getSupabaseProducts } from "@/lib/server/supabase-catalog";

export const revalidate = 300;
export const dynamicParams = true;

export async function generateStaticParams() {
  const products = await getSupabaseProducts();
  return products.filter((product) => product.liga !== "revisar" && product.clubeSlug !== "revisar")
    .map((product) => ({ liga: product.liga, clube: product.clubeSlug }))
    .filter((route, index, all) => all.findIndex((item) => item.liga === route.liga && item.clube === route.clube) === index);
}

export async function generateMetadata({ params }: { params: Promise<{ liga: string; clube: string }> }) {
  const { liga, clube } = await params;
  const products = await getSupabaseProducts();
  const clubProducts = products.filter((item) => item.liga === liga && item.clubeSlug === clube);
  const club = clubProducts[0];
  if (!club) {
    return { title: "Clube", alternates: { canonical: `/ligas/${liga}/${clube}` } };
  }
  const description = `Compre camisas do ${club.clube} na Imports Alves. ${clubProducts.length} modelo(s) disponíveis com frete facilitado, parcelamento no cartão e opção de personalização.`;
  return {
    title: `Camisas do ${club.clube} | Imports Alves`,
    description,
    alternates: { canonical: `/ligas/${liga}/${clube}` },
    openGraph: {
      title: `Camisas do ${club.clube} | Imports Alves`,
      description,
      url: `/ligas/${liga}/${clube}`,
    },
  };
}

export default async function ClubPage({ params }: { params: Promise<{ liga: string; clube: string }> }) {
  const { liga: leagueSlug, clube: clubSlug } = await params;
  const products = await getSupabaseProducts();
  const clubProducts = products.filter((product) => product.clubeSlug === clubSlug && product.liga === leagueSlug);
  const club = clubProducts[0];
  if (!club) notFound();
  const heroImage = productImageAsset(club);
  return <CatalogPage
    title={club.clube}
    description={`Produtos de ${club.clube} disponíveis no catálogo da loja.`}
    products={clubProducts.map(toCatalogPreview)}
    breadcrumb={[{ name: "Ligas", href: "/busca" }, { name: catalogLabel(leagueSlug), href: `/ligas/${leagueSlug}` }, { name: club.clube }]}
    heroImage={heroImage}
    heroEyebrow={`${catalogLabel(leagueSlug)} · ${clubProducts.length} produtos`}
  />;
}
