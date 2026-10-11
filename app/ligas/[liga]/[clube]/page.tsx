import { notFound } from "next/navigation";
import { CatalogPage } from "@/components/catalog-page";
import { getLeague, leagues, products } from "@/lib/catalog";

export function generateStaticParams() {
  return leagues.flatMap((league) => league.clubs.map((club) => ({ liga: league.slug, clube: club.slug })));
}

export async function generateMetadata({ params }: { params: Promise<{ liga: string; clube: string }> }) {
  const { liga, clube } = await params;
  const club = getLeague(liga)?.clubs.find((item) => item.slug === clube);
  return { title: club ? `Camisas ${club.name}` : "Clube", description: club ? `Encontre modelos de ${club.name} na alves store.` : undefined };
}

export default async function ClubPage({ params }: { params: Promise<{ liga: string; clube: string }> }) {
  const { liga: leagueSlug, clube: clubSlug } = await params;
  const league = getLeague(leagueSlug);
  const club = league?.clubs.find((item) => item.slug === clubSlug);
  if (!league || !club) notFound();
  const clubProducts = products.filter((product) => product.clubeSlug === clubSlug && product.liga === leagueSlug);
  return <CatalogPage title={`Camisas ${club.name}`} description={`Encontre os mantos de ${club.name}: versões torcedor, jogador, feminina e retrô.`} products={clubProducts} breadcrumb={[{ name: "Ligas", href: "/ligas/brasileirao" }, { name: league.name, href: `/ligas/${league.slug}` }, { name: club.name }]} />;
}
