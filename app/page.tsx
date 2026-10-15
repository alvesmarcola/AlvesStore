import Image from "next/image";
import Link from "next/link";
import { ArrowRight, HeartHandshake, ShoppingBag, Truck, WalletCards } from "lucide-react";
import { ProductGrid } from "@/components/product-grid";
import { HeroCarousel } from "@/components/hero-carousel";
import { Reveal } from "@/components/motion-effects";
import { StickyLeagueRail } from "@/components/sticky-league-rail";
import { FormulaOneShowcase } from "@/components/formula-one-showcase";
import { images } from "@/data/images";
import { formatCurrency, leagues, products } from "@/lib/catalog";
import { storeConfig } from "@/config";
import type { Metadata } from "next";
import { classifyProduct } from "@/lib/product-classification";
import { editorialPriorities, prioritizeClubs, prioritizeEditorialProducts, sortCatalogProducts } from "@/lib/catalog-order";
import { getSupabaseProducts } from "@/lib/server/supabase-catalog";

export const metadata: Metadata = { alternates: { canonical: "/" } };
export const revalidate = 300;

const features = [
  { icon: ShoppingBag, title: "Condições de envio", text: storeConfig.shippingOfferText },
  { icon: WalletCards, title: "Pagamento", text: "Finalize seu pedido com segurança pelo Mercado Pago." },
  { icon: Truck, title: "Envio direto", text: "Seu pedido segue do fornecedor ao endereço informado." },
  { icon: HeartHandshake, title: "Personalização", text: `+${formatCurrency(storeConfig.customizationPrice)} por camisa` },
];

const collections = [
  { title: "MASCULINO", sub: "Do estádio ao dia a dia", href: "/masculino", image: images.categories.male, size: "collection-men" },
  { title: "FEMININO", sub: "Torça do seu jeito", href: "/feminino", image: images.categories.female, size: "collection-women" },
  { title: "LIGAS", sub: "Paixão sem fronteiras", href: "/ligas/brasileirao-serie-a", image: images.categories.leagues, size: "collection-leagues" },
];

const differentials = [
  { title: "Clubes e seleções", body: "Explore camisas de clubes e seleções nacionais em categorias separadas.", links: [{ label: "Ver clubes", href: "/ligas/brasileirao-serie-a" }, { label: "Ver seleções", href: "/ligas/selecoes" }] },
  { title: "Personalização opcional", body: `Adicione nome e número por ${formatCurrency(storeConfig.customizationPrice)} a cada camisa personalizada.`, links: [{ label: "Escolher uma camisa", href: "/masculino" }] },
];

function ProductSection({
  title,
  kicker,
  href,
  items,
  dark = false,
}: {
  title: string;
  kicker: string;
  href: string;
  items: typeof products;
  dark?: boolean;
}) {
  return (
    <section className={`product-showcase ${dark ? "bg-ink text-white" : "bg-white text-ink"}`}>
      <div className="mx-auto max-w-7xl px-5 py-14 lg:px-8 lg:py-20">
        <Reveal className="mb-7 flex items-end justify-between gap-4 sm:mb-9">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[.2em] text-action">{kicker}</p>
            <h2 className="mt-2 text-3xl font-black uppercase tracking-tight sm:text-5xl">{title}</h2>
          </div>
          <Link className="mb-1 flex shrink-0 items-center gap-1 text-[10px] font-black uppercase tracking-wide hover:text-action" href={href}>Ver tudo <ArrowRight size={15} /></Link>
        </Reveal>
        <ProductGrid items={items} />
      </div>
    </section>
  );
}

export default async function HomePage() {
  const products = await getSupabaseProducts();
  const nationalTeamSlugs = new Set(leagues.find((league) => league.slug === "selecoes")?.clubes.map((team) => team.slug) ?? []);
  const sellableProducts = products.filter((product) => product.tamanhos.length > 0 && !classifyProduct(product).reviewRequired);
  const clubProducts = prioritizeEditorialProducts(
    sellableProducts.filter((product) => product.liga !== "selecoes" && !nationalTeamSlugs.has(product.clubeSlug) && product.clubeSlug !== "revisar"),
    editorialPriorities.clubs,
    4,
  );
  const nationalSelections = prioritizeEditorialProducts(
    sellableProducts.filter((product) => product.liga === "selecoes" || nationalTeamSlugs.has(product.clubeSlug)),
    editorialPriorities.selections,
    4,
  );
  const retros = sortCatalogProducts(sellableProducts.filter((product) => classifyProduct(product).version === "retro")).slice(0, 4);
  const destinations = new Map<string, { name: string; league: string; slug: string; popularity: number }>();
  products
    .filter((product) => product.liga !== "revisar" && product.clubeSlug !== "revisar")
    .forEach((product) => {
      const league = nationalTeamSlugs.has(product.clubeSlug)
        ? "selecoes"
        : leagues.find((candidate) => candidate.slug !== "selecoes" && candidate.clubes.some((club) => club.slug === product.clubeSlug))?.slug ?? product.liga;
      const key = `${league}-${product.clubeSlug}`;
      const destination = destinations.get(key);
      if (destination) destination.popularity += 1;
      else destinations.set(key, { name: product.clube, league, slug: product.clubeSlug, popularity: 1 });
    });
  const allDestinations = [...destinations.values()];
  const clubLinks = prioritizeClubs(allDestinations.filter((destination) => destination.league !== "selecoes")).slice(0, 10);
  const marqueeText = [...leagues.map((league) => league.nome), "O jogo é de todos", ...leagues.map((league) => league.nome)];

  return (
    <main className="overflow-hidden">
      <HeroCarousel />

      <section className="league-marquee bg-action py-4 text-white" aria-label="Ligas disponíveis">
        <div className="league-marquee-track flex w-max items-center gap-8 whitespace-nowrap">
          {marqueeText.map((label, index) => <span className="flex items-center gap-8" key={`${label}-${index}`} aria-hidden={index > leagues.length}><span className="text-[11px] font-black uppercase tracking-[.22em] sm:text-sm">{label}</span><span className="text-lg text-white/50" aria-hidden="true">✳</span></span>)}
        </div>
      </section>

      <section className="benefits-strip bg-[#F5F5F5]">
        <div className="mx-auto grid max-w-7xl grid-cols-2 gap-4 px-5 py-7 sm:grid-cols-4 lg:px-8">
          {features.map(({ icon: Icon, title, text }, index) => (
            <Reveal key={title} delay={index * 0.06} className="flex items-center gap-3">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-ink text-action"><Icon size={19} /></span>
              <div><h2 className="text-xs font-black uppercase">{title}</h2><p className="mt-1 text-[10px] text-muted sm:text-xs">{text}</p></div>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-14 lg:px-8 lg:py-20" aria-label="Explore coleções">
        <Reveal className="mb-7 flex items-end justify-between gap-4">
          <div><p className="text-[10px] font-black uppercase tracking-[.2em] text-action">Escolha o seu lado</p><h2 className="mt-2 text-3xl font-black uppercase sm:text-5xl">O jogo é seu</h2></div>
          <span className="hidden text-[10px] font-bold uppercase tracking-widest text-muted sm:block">Três formas de viver o futebol</span>
        </Reveal>
        <div className="collection-bento grid gap-4 sm:grid-cols-12">
          {collections.map((item, index) => (
            <Reveal className={item.size} delay={index * 0.08} key={item.title}>
              <Link href={item.href} className={`collection-tile group relative isolate flex h-full min-h-[245px] flex-col justify-end overflow-hidden rounded-lg border border-black/10 p-5 text-white sm:min-h-[310px] sm:p-7 ${item.size}`}>
                <Image
                  src={item.image.src}
                  alt={item.image.alt}
                  fill
                  sizes={index === 0 ? "(max-width: 640px) 100vw, 58vw" : "(max-width: 640px) 100vw, 38vw"}
                  placeholder="blur"
                  blurDataURL={item.image.blurDataURL}
                  className="collection-photo -z-20 object-cover"
                  style={{ objectPosition: `${item.image.focalPoint.x}% ${item.image.focalPoint.y}%` }}
                />
                <span className="collection-shade absolute inset-0 -z-10" />
                <span aria-hidden="true" className="collection-outline pointer-events-none absolute right-[-.04em] top-0 -z-10 text-[5rem] font-black uppercase leading-none tracking-tighter text-transparent sm:text-[8rem]">{item.title}</span>
                <span className="text-[10px] font-black uppercase tracking-[.2em] text-blue-200">{item.sub}</span>
                <span className="mt-2 flex items-end justify-between gap-3">
                  <span className="text-3xl font-black uppercase leading-none sm:text-5xl">{item.title}</span>
                  <span className="collection-cta inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-wide text-white">Explorar <ArrowRight size={15} /></span>
                </span>
              </Link>
            </Reveal>
          ))}
        </div>
      </section>

      <ProductSection title="Camisas de clubes" kicker="Explore o catálogo" href="/busca?q=clubes" items={clubProducts} dark />
      <ProductSection title="Seleções nacionais" kicker="Camisas de seleções" href="/ligas/selecoes" items={nationalSelections} />
      <ProductSection title="Clássicos retrô" kicker="Para quem vive de história" href="/busca?q=retro" items={retros} dark />

      <FormulaOneShowcase />

      <StickyLeagueRail leagues={leagues} />

      <section className="bg-[#F5F5F5] py-14 sm:py-20">
        <div className="mx-auto max-w-7xl px-5 lg:px-8">
          <Reveal>
            <p className="text-[10px] font-black uppercase tracking-[.2em] text-action">As cores que moram na arquibancada</p>
            <h2 className="mt-2 text-3xl font-black uppercase sm:text-5xl">Clubes em destaque</h2>
            <p className="mt-3 max-w-xl text-sm text-muted">Descubra camisas de clubes de várias ligas.</p>
          </Reveal>
          <div className="mt-7 grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 lg:grid-cols-6">
            {clubLinks.map((club, index) => (
              <Reveal key={`${club.league}-${club.slug}`} delay={(index % 6) * 0.04}>
                <Link href={`/ligas/${club.league}/${club.slug}`} className="club-text-card group flex min-h-20 items-center justify-between gap-2 rounded-lg border border-border bg-white p-3 transition hover:border-action hover:bg-ink hover:text-white">
                  <span className="min-w-0 text-xs font-black uppercase leading-tight">{club.name}</span>
                  <ArrowRight size={14} className="shrink-0 text-action transition group-hover:translate-x-1" />
                </Link>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-4 px-5 py-14 sm:grid-cols-3 lg:px-8 lg:py-20">
        {differentials.map((item, index) => (
          <Reveal key={item.title} delay={index * 0.08} className="h-full">
            <div className="differential-card h-full rounded-lg border border-border bg-white p-6 sm:p-7">
              <span className="mb-5 block h-1 w-10 bg-action" />
              <h2 className="text-lg font-black uppercase leading-tight">{item.title}</h2>
              <p className="mt-3 text-sm leading-6 text-muted">{item.body}</p>
              <div className="mt-4 flex flex-wrap gap-4">{item.links.map((link) => <Link key={link.href} href={link.href} className="text-xs font-bold text-blue-700 underline">{link.label}</Link>)}</div>
            </div>
          </Reveal>
        ))}
      </section>

    </main>
  );
}
