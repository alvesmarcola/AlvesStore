import { notFound } from "next/navigation";
import { CatalogPage } from "@/components/catalog-page";
import { images } from "@/data/images";
import { getLeague, leagues, products } from "@/lib/catalog";

export function generateStaticParams() {
  return leagues.flatMap((league) => league.clubes.map((club) => ({ liga: league.slug, clube: club.slug })));
}

export async function generateMetadata({ params }: { params: Promise<{ liga: string; clube: string }> }) {
  const { liga, clube } = await params;
  const club = getLeague(liga)?.clubes.find((item) => item.slug === clube);
  return { title: club ? `Camisas ${club.nome}` : "Clube", description: club ? `Encontre modelos de ${club.nome} na alves store.` : undefined };
}

export default async function ClubPage({ params }: { params: Promise<{ liga: string; clube: string }> }) {
  const { liga: leagueSlug, clube: clubSlug } = await params;
  const league = getLeague(leagueSlug);
  const club = league?.clubes.find((item) => item.slug === clubSlug);
  if (!league || !club) notFound();
  const clubProducts = products.filter((product) => product.clubeSlug === clubSlug && product.liga === leagueSlug);
  return <CatalogPage
    title={club.nome}
    description={`Encontre modelos de ${club.nome}: versões torcedor, jogador, feminina e retrô.`}
    products={clubProducts}
    breadcrumb={[{ name: "Ligas", href: "/ligas/brasileirao-serie-a" }, { name: league.nome, href: `/ligas/${league.slug}` }, { name: club.nome }]}
    heroImage={images.leagues[league.imagemCapa]}
    heroEyebrow={`${league.nome} · ${league.competicao}`}
  />;
}
