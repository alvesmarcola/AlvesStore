import Image from "next/image";
import Link from "next/link";
import { ArrowRight, HeartHandshake, ShoppingBag, Truck, WalletCards } from "lucide-react";
import { ProductGrid } from "@/components/product-grid";
import { HeroCarousel } from "@/components/hero-carousel";
import { Reveal } from "@/components/motion-effects";
import { StickyLeagueRail } from "@/components/sticky-league-rail";
import { FormulaOneShowcase } from "@/components/formula-one-showcase";
import { InstagramCTA } from "@/components/instagram-cta";
import { CustomerReviews } from "@/components/customer-reviews";
import { images } from "@/data/images";
import { formatCurrency } from "@/lib/catalog";
import { storeConfig } from "@/config";
import type { Metadata } from "next";
import type { Product } from "@/lib/types";
import { deriveCatalogLeagues } from "@/lib/catalog-taxonomy";
import { editorialPriorities, prioritizeClubs, prioritizeEditorialProducts, sortCatalogProducts } from "@/lib/catalog-order";
import { classifyProduct, isNbaTankTop, isRetroProduct } from "@/lib/product-classification";
import { getBundledFormulaOneProducts, getSupabaseProducts } from "@/lib/server/supabase-catalog";
import { isFormulaOneProduct } from "@/lib/formula-one";

export const metadata: Metadata = { alternates: { canonical: "/" } };
export const revalidate = 300;

const features: { icon: typeof ShoppingBag; title: string; text: string; link?: { label: string; href: string } }[] = [
  { icon: ShoppingBag, title: "Frete facilitado", text: `${formatCurrency(storeConfig.shippingPrice)} (1 ou 2 itens) · Grátis a partir de ${storeConfig.freeShippingQuantity} peças`, link: { label: "Ver regras completas", href: "/envios-e-prazos" } },
  { icon: WalletCards, title: "Pagamento seguro", text: "Pix imediato ou cartão em até 12x via Mercado Pago." },
  { icon: Truck, title: "Envio rastreado", text: "Acompanhamento completo do despacho até sua casa." },
  { icon: HeartHandshake, title: "Personalização", text: `Nome e número oficiais por +${formatCurrency(storeConfig.customizationPrice)}.` },
];

const collections = [
  { title: "MASCULINO", sub: "Do estádio ao dia a dia", href: "/masculino", image: images.categories.male, size: "collection-men" },
  { title: "FEMININO", sub: "Torça do seu jeito", href: "/feminino", image: images.categories.female, size: "collection-women" },
  { title: "LIGAS", sub: "Paixão sem fronteiras", href: "/clubes", image: images.categories.leagues, size: "collection-leagues" },
];

const differentials = [
  { title: "Clubes e seleções", body: "Explore os principais mantos de clubes do Brasil e do mundo, além de seleções nacionais.", links: [{ label: "Ver clubes", href: "/clubes" }, { label: "Ver seleções", href: "/selecoes" }] },
  { title: "Personalização oficial", body: `Adicione seu nome, número ou ambos por apenas ${formatCurrency(storeConfig.customizationPrice)} por camisa.`, links: [{ label: "Escolher uma camisa", href: "/masculino" }] },
  { title: "Qualidade premium", body: "Tecidos tecnológicos respiráveis, bordados precisos e acabamento de alto padrão para quem vive o esporte.", links: [{ label: "Conhecer a loja", href: "/quem-somos" }] },
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
  items: Product[];
  dark?: boolean;
}) {
  return (
    <section className={`product-showcase ${dark ? "bg-ink text-white" : "bg-white text-ink"}`}>
      <div className="mx-auto max-w-7xl px-5 py-14 lg:px-8 lg:py-20">
        <Reveal className="mb-7 flex items-end justify-between gap-4 sm:mb-9">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-action">{kicker}</p>
            <h2 className="mt-2 text-3xl font-bold uppercase tracking-normal sm:text-4xl">{title}</h2>
          </div>
          <Link className="mb-1 flex shrink-0 items-center gap-1 text-[10px] font-bold uppercase tracking-wider hover:text-action" href={href}>Ver tudo <ArrowRight size={15} /></Link>
        </Reveal>
        <ProductGrid items={items} />
      </div>
    </section>
  );
}

export default async function HomePage() {
  const products = await getSupabaseProducts();
  const nbaRegata = products.find((product) =>
    product.liga === "nba" && product.tipo === "regata" && product.images?.[0]?.src,
  );
  const formulaOneBySlug = new Map<string, Product>();
  for (const product of [...getBundledFormulaOneProducts(), ...products.filter(isFormulaOneProduct)]) {
    formulaOneBySlug.set(product.slug, product);
  }
  const leagues = deriveCatalogLeagues(products);
  const nationalTeamSlugs = new Set(leagues.find((league) => league.slug === "selecoes")?.clubes.map((team) => team.slug) ?? []);
  const catalogProducts = sortCatalogProducts(products);
  const clubCandidates = catalogProducts.filter((product) => product.liga !== "selecoes" && !nationalTeamSlugs.has(product.clubeSlug) && product.clubeSlug !== "revisar" && !isFormulaOneProduct(product));
  const selectedClubProducts = prioritizeEditorialProducts(
    clubCandidates,
    editorialPriorities.clubs,
    8,
  );
  const clubProducts = selectedClubProducts.length ? selectedClubProducts : catalogProducts.slice(0, 8);
  const nationalSelections = prioritizeEditorialProducts(
    catalogProducts.filter((product) => (product.liga === "selecoes" || nationalTeamSlugs.has(product.clubeSlug)) && !isFormulaOneProduct(product)),
    editorialPriorities.selections,
    8,
  );
  const retros = catalogProducts.filter(isRetroProduct).slice(0, 8);
  const kidsProducts = catalogProducts.filter((product) => (product.publico === "infantil" || /\b(?:kids|junior|youth|infantil|children)\b/i.test(`${product.nome} ${product.imageSeed}`)) && !isFormulaOneProduct(product)).slice(0, 8);
  const formulaOneProducts = sortCatalogProducts([...formulaOneBySlug.values()]).slice(0, 12);
  const destinations = new Map<string, { name: string; league: string; slug: string; popularity: number }>();
  products
    .filter((product) => product.liga !== "revisar" && product.clubeSlug !== "revisar")
    .forEach((product) => {
      const league = nationalTeamSlugs.has(product.clubeSlug) ? "selecoes" : product.liga;
      const key = `${league}-${product.clubeSlug}`;
      const destination = destinations.get(key);
      if (destination) destination.popularity += 1;
      else destinations.set(key, { name: product.clube, league, slug: product.clubeSlug, popularity: 1 });
    });
  const allDestinations = [...destinations.values()];
  const clubLinks = prioritizeClubs(allDestinations.filter((destination) => destination.league !== "selecoes")).slice(0, 10);
  const marqueeText = [...leagues.map((league) => league.nome), "O jogo é de todos"];

  return (
    <main className="overflow-hidden">
      {/* ─── 1. HERO CAROUSEL ─── */}
      <HeroCarousel />

      {/* ─── 2. LEAGUE MARQUEE ─── */}
      <section className="league-marquee bg-action py-4 text-white" aria-label="Ligas disponíveis">
        <div className="league-marquee-track flex w-max whitespace-nowrap">
          {[0, 1].map((copy) => <div className="flex min-w-[100vw] shrink-0 items-center justify-around gap-8 px-4" key={copy} aria-hidden={copy === 1}>
            {marqueeText.map((label, index) => <span className="flex shrink-0 items-center gap-8" key={`${copy}-${label}-${index}`}><span className="text-[11px] font-bold uppercase tracking-wider sm:text-sm">{label}</span><span className="text-lg text-white/50" aria-hidden="true">✳</span></span>)}
          </div>)}
        </div>
      </section>

      {/* ─── 3. NBA HIGHLIGHT ─── */}
      <section className="bg-white px-5 py-7 sm:py-9 lg:px-8" aria-labelledby="nba-highlight-title">
        <Link
          href="/masculino?tipo=regata-nba"
          aria-label="Explorar a coleção de Regatas NBA"
          className="group mx-auto grid max-w-7xl grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] items-stretch overflow-hidden rounded-xl border border-white/10 bg-[#0a0a0a] text-white shadow-xl transition hover:border-blue-500/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-400"
        >
          <span className="flex min-w-0 flex-col justify-center p-4 sm:p-8 lg:p-12">
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-blue-300">Coleção de regatas NBA</span>
            <span id="nba-highlight-title" className="mt-2 text-4xl font-black uppercase tracking-tight sm:text-5xl lg:text-7xl">NBA</span>
            <span className="mt-2 line-clamp-2 text-xs font-medium text-white/75 sm:text-sm">{nbaRegata?.nome ?? "Regatas da coleção NBA"}</span>
            <span className="mt-4 flex w-fit items-center gap-2 rounded-full bg-blue-600 px-4 py-2 text-[10px] font-bold uppercase tracking-wider transition group-hover:bg-blue-500 sm:mt-6 sm:text-xs">
              Ver regatas NBA <ArrowRight size={16} />
            </span>
          </span>
          <span className="relative min-h-[220px] overflow-hidden bg-[radial-gradient(circle_at_55%_45%,rgba(37,99,235,0.28),transparent_58%),linear-gradient(135deg,#171717,#0a0a0a)] sm:min-h-[280px] lg:min-h-[360px]">
            <Image
              src={nbaRegata?.images?.[0]?.src ?? "/arena/bf-nba-desktop.webp"}
              alt={nbaRegata?.nome ?? "Destaque visual da coleção NBA"}
              fill
              unoptimized
              sizes="(max-width: 640px) 45vw, (max-width: 1024px) 46vw, 600px"
              className={`object-contain p-3 transition-transform duration-500 group-hover:scale-105 sm:p-6 lg:p-10 ${nbaRegata ? "" : "object-cover object-[80%_center]"}`}
            />
          </span>
        </Link>
      </section>

      {/* ─── 4. BENEFITS STRIP ─── */}
      <section className="benefits-strip bg-[#F5F5F5]">
        <div className="mx-auto grid max-w-7xl grid-cols-1 min-[540px]:grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4 lg:gap-5 px-5 py-7 sm:py-9 lg:px-8">
          {features.map(({ icon: Icon, title, text, link }, index) => (
            <Reveal key={title} delay={index * 0.06} className="h-full w-full min-w-0">
              <div className="flex h-full w-full min-w-0 items-start gap-3.5 rounded-xl border border-black/5 bg-white p-4 shadow-sm transition hover:shadow-md sm:p-5">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-ink text-action sm:h-11 sm:w-11" aria-hidden="true">
                  <Icon size={18} className="sm:h-5 sm:w-5" />
                </span>
                <div className="min-w-0 flex-1 flex flex-col justify-start">
                  <h2 className="text-xs sm:text-sm font-bold uppercase tracking-normal text-ink break-words whitespace-normal leading-snug">
                    {title}
                  </h2>
                  <p className="mt-1 text-[11px] sm:text-xs leading-relaxed text-muted break-words whitespace-normal">
                    {text}
                  </p>
                  {link && (
                    <Link
                      href={link.href}
                      className="mt-2 inline-flex w-fit text-[11px] sm:text-xs font-semibold text-blue-700 hover:text-blue-800 underline underline-offset-2 break-words whitespace-normal"
                    >
                      {link.label}
                    </Link>
                  )}
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ─── 5. COLLECTIONS BENTO ─── */}
      <section className="mx-auto max-w-7xl px-5 py-14 lg:px-8 lg:py-20" aria-label="Explore coleções">
        <Reveal className="mb-7 flex items-end justify-between gap-4">
          <div><p className="text-[10px] font-bold uppercase tracking-wider text-action">Escolha o seu lado</p><h2 className="mt-2 text-3xl font-bold uppercase tracking-normal sm:text-4xl">O jogo é seu</h2></div>
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
                <span aria-hidden="true" className="collection-outline pointer-events-none absolute right-[-.04em] top-0 -z-10 text-[5rem] font-bold uppercase leading-none tracking-normal text-transparent sm:text-[8rem]">{item.title}</span>
                <span className="text-[10px] font-bold uppercase tracking-wider text-blue-200">{item.sub}</span>
                <span className="mt-2 flex items-end justify-between gap-3">
                  <span className="text-3xl font-bold uppercase leading-none tracking-normal sm:text-4xl">{item.title}</span>
                  <span className="collection-cta inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-white">Explorar <ArrowRight size={15} /></span>
                </span>
              </Link>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ─── 6. LEAGUE RAIL ─── */}
      <StickyLeagueRail leagues={leagues} />

      {/* ─── 7. CLUB PRODUCTS ─── */}
      {clubProducts.length > 0 && <ProductSection title="Camisas de clubes" kicker="Explore o catálogo" href="/clubes" items={clubProducts} />}

      {/* ─── 8. FEATURED CLUBS ─── */}
      <section className="bg-[#F5F5F5] py-14 sm:py-20">
        <div className="mx-auto max-w-7xl px-5 lg:px-8">
          <Reveal>
            <p className="text-[10px] font-bold uppercase tracking-wider text-action">As cores que moram na arquibancada</p>
            <h2 className="mt-2 text-3xl font-bold uppercase tracking-normal sm:text-4xl">Clubes em destaque</h2>
            <p className="mt-3 max-w-xl text-sm text-muted">Descubra camisas de clubes de várias ligas.</p>
          </Reveal>
          <div className="mt-7 grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 lg:grid-cols-6">
            {clubLinks.map((club, index) => (
              <Reveal key={`${club.league}-${club.slug}`} delay={(index % 6) * 0.04}>
                <Link href={`/ligas/${club.league}/${club.slug}`} className="club-text-card group flex min-h-20 items-center justify-between gap-2 rounded-lg border border-border bg-white p-3 transition hover:border-action hover:bg-ink hover:text-white">
                  <span className="min-w-0 text-xs font-bold uppercase leading-tight">{club.name}</span>
                  <ArrowRight size={14} className="shrink-0 text-action transition group-hover:translate-x-1" />
                </Link>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ─── 9. RETRO ─── */}
      {retros.length > 0 && <ProductSection title="Clássicos retrô" kicker="Para quem vive de história" href="/retro" items={retros} />}

      {/* ─── 10. SESSÃO INFORMATIVA F1 ─── */}
      <FormulaOneShowcase href="/f1" />

      {/* ─── 11. PRODUTOS FÓRMULA 1 (Logo abaixo da sessão informativa F1) ─── */}
      {formulaOneProducts.length > 0 && (
        <ProductSection
          title="F1"
          kicker="Universo motorsport"
          href="/f1"
          items={formulaOneProducts}
          dark
        />
      )}

      {/* ─── 12. KIDS ─── */}
      {kidsProducts.length > 0 && <ProductSection title="Kits infantis" kicker="A torcida começa cedo" href="/infantil" items={kidsProducts} dark />}

      {/* ─── 13. SELEÇÕES NACIONAIS ─── */}
      {nationalSelections.length > 0 && <ProductSection title="Seleções nacionais" kicker="Camisas de seleções" href="/selecoes" items={nationalSelections} dark />}

      {/* ─── 14. DIFFERENTIALS ─── */}
      <section className="mx-auto grid max-w-7xl gap-4 px-5 py-14 sm:grid-cols-3 lg:px-8 lg:py-20">
        {differentials.map((item, index) => (
          <Reveal key={item.title} delay={index * 0.08} className="h-full">
            <div className="differential-card h-full rounded-lg border border-border bg-white p-6 sm:p-7">
              <span className="mb-5 block h-1 w-10 bg-action" />
              <h2 className="text-lg font-bold uppercase leading-tight">{item.title}</h2>
              <p className="mt-3 text-sm leading-6 text-muted">{item.body}</p>
              <div className="mt-4 flex flex-wrap gap-4">{item.links.map((link) => <Link key={link.href} href={link.href} className="text-xs font-bold text-blue-700 underline">{link.label}</Link>)}</div>
            </div>
          </Reveal>
        ))}
      </section>

      {/* ─── 15. INSTAGRAM CTA ─── */}
      <InstagramCTA />

      {/* ─── 16. CUSTOMER REVIEWS ─── */}
      <CustomerReviews />

    </main>
  );
}
