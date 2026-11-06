import { notFound } from "next/navigation";
import { CatalogPage } from "@/components/catalog-page";
import { images } from "@/data/images";
import { deriveCatalogLeagues } from "@/lib/catalog-taxonomy";
import { productImageAsset, toCatalogPreview } from "@/lib/catalog";
import { getSupabaseProducts } from "@/lib/server/supabase-catalog";

export const revalidate = 300;
export const dynamicParams = true;

export async function generateStaticParams() {
  return deriveCatalogLeagues(await getSupabaseProducts()).map((league) => ({ liga: league.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ liga: string }> }) {
  const { liga } = await params;
  const products = await getSupabaseProducts();
  const league = deriveCatalogLeagues(products).find((item) => item.slug === liga);
  if (!league) {
    return { title: "Ligas", alternates: { canonical: `/ligas/${liga}` } };
  }
  const clubCount = league.clubes.length;
  const description = `Compre camisas e mantos de ${league.nome} na Imports Alves. Confira ${league.productCount} modelos de ${clubCount} equipes com frete facilitado, parcelamento em até 12x e personalização.`;
  return {
    title: `Camisas de ${league.nome} | Imports Alves`,
    description,
    alternates: { canonical: `/ligas/${liga}` },
    openGraph: {
      title: `Camisas de ${league.nome} | Imports Alves`,
      description,
      url: `/ligas/${liga}`,
    },
  };
}

export default async function LeaguePage({ params }: { params: Promise<{ liga: string }> }) {
  const { liga: leagueSlug } = await params;
  const products = await getSupabaseProducts();
  const league = deriveCatalogLeagues(products).find((item) => item.slug === leagueSlug);
  if (!league) notFound();
  const leagueProducts = products.filter((product) => product.liga === leagueSlug);
  const heroImage = leagueProducts[0] ? productImageAsset(leagueProducts[0]) : images.categories.leagues;
  return <CatalogPage
    title={league.nome}
    description={`Explore os produtos de ${league.nome} disponíveis no catálogo da loja.`}
    products={leagueProducts.map(toCatalogPreview)}
    breadcrumb={[{ name: "Ligas", href: "/busca" }, { name: league.nome }]}
    heroImage={heroImage}
    heroEyebrow={`${league.productCount} produtos · catálogo Supabase`}
    quickLinks={league.clubes.slice(0, 10).map((club) => ({ name: club.nome, href: `/ligas/${league.slug}/${club.slug}` }))}
  />;
}
