import { notFound } from "next/navigation";
import { CatalogPage } from "@/components/catalog-page";
import { getLeague, leagues, products } from "@/lib/catalog";
import { images } from "@/data/images";

export function generateStaticParams() {
  return leagues.map((league) => ({ liga: league.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ liga: string }> }) {
  const { liga } = await params;
  const league = getLeague(liga);
  return { title: league ? `Camisas ${league.nome}` : "Ligas", description: league ? `Explore camisas de ${league.nome} e encontre seu clube.` : undefined };
}

export default async function LeaguePage({ params }: { params: Promise<{ liga: string }> }) {
  const { liga: leagueSlug } = await params;
  const league = getLeague(leagueSlug);
  if (!league) notFound();
  const leagueProducts = products.filter((product) => product.liga === leagueSlug);
  const cover = images.leagues[league.imagemCapa];
  return <CatalogPage
    title={league.nome}
    description={`Explore camisas de ${league.nome} e descubra os clubes que movimentam ${league.pais}.`}
    products={leagueProducts}
    breadcrumb={[{ name: "Ligas", href: "/ligas/brasileirao-serie-a" }, { name: league.nome }]}
    heroImage={cover}
    heroEyebrow={`${league.competicao} · ${league.pais}`}
    quickLinks={league.clubes.slice(0, 10).map((club) => ({ name: club.nome, href: `/ligas/${league.slug}/${club.slug}` }))}
  />;
}
