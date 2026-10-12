import Image from "next/image";
import Link from "next/link";
import { ArrowRight, HeartHandshake, ShieldCheck, Truck, WalletCards } from "lucide-react";
import { ProductGrid } from "@/components/product-grid";
import { NewsletterForm } from "@/components/newsletter-form";
import { HeroCarousel } from "@/components/hero-carousel";
import { Reveal } from "@/components/motion-effects";
import { StickyLeagueRail } from "@/components/sticky-league-rail";
import { images } from "@/data/images";
import { formatCurrency, leagues, products } from "@/lib/catalog";
import { storeConfig } from "@/config";

const features = [
  { icon: Truck, title: "Frete grátis (R$ 0,00)", text: "na compra de 3 camisas" },
  { icon: WalletCards, title: `Até ${storeConfig.installments}x`, text: "no cartão de crédito" },
  { icon: ShieldCheck, title: `${storeConfig.returnPeriodDays} dias`, text: "para devolver" },
  { icon: HeartHandshake, title: "Torcida atendida", text: "a gente está no WhatsApp" },
];

const collections = [
  { title: "MASCULINO", sub: "Do estádio ao dia a dia", href: "/masculino", image: images.categories.male, size: "collection-men" },
  { title: "FEMININO", sub: "Torça do seu jeito", href: "/feminino", image: images.categories.female, size: "collection-women" },
  { title: "LIGAS", sub: "Paixão sem fronteiras", href: "/ligas/brasileirao-serie-a", image: images.categories.leagues, size: "collection-leagues" },
];

const differentials = [
  { title: "Qualidade que entra em campo", body: "Materiais leves e resistentes para acompanhar a torcida em qualquer momento." },
  { title: "Conforto do primeiro ao último minuto", body: "Toque macio e liberdade de movimento para vestir a paixão no seu ritmo." },
  { title: "Caimento para todo torcedor", body: "Modelos e tamanhos para você viver o futebol do seu jeito." },
];

function ProductSection({
  title,
  kicker,
  href,
  items,
  dark = false,
  showBundleOffers = false,
}: {
  title: string;
  kicker: string;
  href: string;
  items: typeof products;
  dark?: boolean;
  showBundleOffers?: boolean;
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
        {showBundleOffers && (
          <div className="mb-8 grid gap-3 sm:grid-cols-3" aria-label="Ofertas por quantidade">
            <div className="rounded-lg border border-border bg-paper p-4 text-ink">
              <p className="text-[10px] font-black uppercase tracking-wider text-muted">1 camisa</p>
              <p className="mt-1 text-xl font-black">{formatCurrency(storeConfig.shirtPrice)} <span className="text-xs font-semibold">+ {formatCurrency(storeConfig.oneShirtShippingPriceCents / 100)} de frete</span></p>
            </div>
            <div className="rounded-lg border border-border bg-paper p-4 text-ink">
              <p className="text-[10px] font-black uppercase tracking-wider text-muted">2 camisas</p>
              <p className="mt-1 text-xl font-black">{formatCurrency(storeConfig.twoShirtPrice)} <span className="text-xs font-semibold">+ {formatCurrency(storeConfig.twoShirtShippingPriceCents / 100)} de frete</span></p>
            </div>
            <div className="rounded-lg border border-action/40 bg-action/5 p-4 text-ink">
              <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-wider text-action">3 camisas <span className="rounded-full bg-action px-2 py-1 text-[9px] text-white">Frete grátis (R$ 0,00)</span></p>
              <p className="mt-1 text-xl font-black">{formatCurrency(storeConfig.threeShirtPrice)}</p>
            </div>
            <p className={`text-[10px] sm:col-span-3 ${dark ? "text-white/60" : "text-muted"}`}>Personalização: +{formatCurrency(storeConfig.customizationPrice)} por camisa.</p>
          </div>
        )}
        <ProductGrid items={items} />
      </div>
    </section>
  );
}

export default function HomePage() {
  const offers = products.filter((product) => product.tag === "Oferta" || product.tag === "Mais vendido").slice(0, 4);
  const bestSellers = products.filter((product) => product.tag === "Mais vendido").slice(0, 4);
  const newArrivals = products.filter((product) => product.tag === "Lançamento" || product.tag === "Novidade").slice(0, 4);
  const retros = products.filter((product) => product.tipo === "retro").slice(0, 4);
  const nationalTeamSlugs = new Set(leagues.find((league) => league.slug === "selecoes")?.clubes.map((team) => team.slug) ?? []);
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
  const clubLinks = allDestinations
    .filter((destination) => destination.league !== "selecoes")
    .sort((a, b) => b.popularity - a.popularity)
    .slice(0, 10);
  const marqueeText = [...leagues.map((league) => league.nome), "O jogo é de todos", ...leagues.map((league) => league.nome)];

  return (
    <main className="overflow-hidden">
      <HeroCarousel />

      <section className="league-marquee bg-action py-4 text-white" aria-label="Ligas disponíveis">
        <div className="league-marquee-track flex w-max items-center gap-8 whitespace-nowrap">
          {marqueeText.map((label, index) => <span className="flex items-center gap-8" key={`${label}-${index}`}><span className="text-[11px] font-black uppercase tracking-[.22em] sm:text-sm">{label}</span><span className="text-lg text-white/50" aria-hidden="true">✳</span></span>)}
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

      <ProductSection title="Ofertas da semana" kicker="Não perca o apito" href="/busca?q=oferta" items={offers} showBundleOffers />
      <ProductSection title="Mais vendidas" kicker="A escolha da torcida" href="/busca?q=mais%20vendidas" items={bestSellers} dark />
      <ProductSection title="Lançamentos" kicker="Chegaram agora" href="/busca?q=lançamento" items={newArrivals} />
      <ProductSection title="Clássicos retrô" kicker="Para quem vive de história" href="/busca?q=retro" items={retros} dark />

      <StickyLeagueRail leagues={leagues} />

      <section className="bg-[#F5F5F5] py-14 sm:py-20">
        <div className="mx-auto max-w-7xl px-5 lg:px-8">
          <Reveal>
            <p className="text-[10px] font-black uppercase tracking-[.2em] text-action">As cores que moram na arquibancada</p>
            <h2 className="mt-2 text-3xl font-black uppercase sm:text-5xl">Clubes populares</h2>
            <p className="mt-3 max-w-xl text-sm text-muted">Descubra camisas de clubes de várias ligas. Só nomes em texto — sem escudos ou logos oficiais.</p>
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
            </div>
          </Reveal>
        ))}
      </section>

      <section className="newsletter-arena bg-action px-5 py-12 sm:py-16">
        <Reveal className="mx-auto max-w-7xl rounded-lg bg-ink px-6 py-9 text-white sm:flex sm:items-center sm:justify-between sm:gap-8 sm:px-10">
          <div className="max-w-xl">
            <p className="text-[10px] font-black uppercase tracking-[.2em] text-blue-300">Faça parte do time</p>
            <h2 className="mt-2 text-3xl font-black uppercase">Novidades direto no seu e-mail</h2>
            <p className="mt-2 text-sm text-white/65">Receba lançamentos e vantagens exclusivas da alves store.</p>
          </div>
          <NewsletterForm />
        </Reveal>
      </section>
    </main>
  );
}
