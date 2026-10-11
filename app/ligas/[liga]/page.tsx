import { notFound } from "next/navigation";
import { CatalogPage } from "@/components/catalog-page";
import { getLeague, leagues, products } from "@/lib/catalog";

export function generateStaticParams() {
  return leagues.map((league) => ({ liga: league.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ liga: string }> }) {
  const { liga } = await params;
  const league = getLeague(liga);
  return { title: league ? `Camisas ${league.name}` : "Ligas", description: league ? `Explore camisas de ${league.name} e encontre seu clube.` : undefined };
}

export default async function LeaguePage({ params }: { params: Promise<{ liga: string }> }) {
  const { liga: leagueSlug } = await params;
  const league = getLeague(leagueSlug);
  if (!league) notFound();
  const leagueProducts = products.filter((product) => product.liga === leagueSlug);
  return <><div className="mx-auto max-w-7xl px-4 pt-7 lg:px-8"><div className="rounded-xl bg-pitch p-6 text-white sm:p-10"><p className="text-[10px] font-black uppercase tracking-[.2em] text-lime">Camisas por liga</p><h1 className="mt-2 text-3xl font-black sm:text-4xl">{league.name}</h1><p className="mt-2 text-sm text-white/70">{league.competition} · Vista as cores do seu clube.</p><div className="mt-5 flex flex-wrap gap-2">{league.clubs.map((club) => <a key={club.slug} href={`/ligas/${league.slug}/${club.slug}`} className="rounded-full border border-white/30 px-3 py-2 text-xs font-bold hover:bg-white hover:text-pitch">{club.name}</a>)}</div></div></div><CatalogPage title={`Camisas ${league.name}`} description={`Modelos de torcedor, jogador e retrô da ${league.competition}. Escolha seu clube e vista a paixão.`} products={leagueProducts} breadcrumb={[{ name: "Ligas", href: "/ligas/brasileirao" }, { name: league.name }]} /></>;
}
