"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ChevronRight, SlidersHorizontal } from "lucide-react";
import { ProductGrid } from "@/components/product-grid";
import { formatCurrency, leagues } from "@/lib/catalog";
import type { Product } from "@/lib/types";
import { CategoryHero } from "@/components/category-hero";
import type { ImageAsset } from "@/data/images";

interface CatalogPageProps {
  title: string;
  description: string;
  products: Product[];
  breadcrumb: { name: string; href?: string }[];
  initialType?: string;
  heroImage?: ImageAsset;
  heroEyebrow?: string;
  quickLinks?: { name: string; href: string }[];
}

export function CatalogPage({ title, description, products, breadcrumb, initialType = "", heroImage, heroEyebrow = "Coleção alves store", quickLinks }: CatalogPageProps) {
  const [sort, setSort] = useState("relevancia");
  const [type, setType] = useState(initialType);
  const [uniform, setUniform] = useState("");
  const [club, setClub] = useState("");
  const [league, setLeague] = useState("");
  const [size, setSize] = useState("");
  const [season, setSeason] = useState("");
  const [color, setColor] = useState("");
  const [maxPrice, setMaxPrice] = useState("600");
  const [discountOnly, setDiscountOnly] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [visibleCount, setVisibleCount] = useState(12);
  useEffect(() => setType(initialType), [initialType]);
  useEffect(() => setVisibleCount(12), [products, type, uniform, club, league, size, season, color, maxPrice, discountOnly, sort]);
  const filtered = useMemo(() => {
    const result = products.filter((product) =>
      (!type || product.tipo === type) && (!uniform || product.uniforme === uniform) &&
      (!club || product.clubeSlug === club) && (!league || product.liga === league) &&
      (!size || (product.tamanhos.includes(size) && !product.esgotados.includes(size))) &&
      (!season || product.temporada === season) && (!color || product.cor === color) &&
      product.preco <= Number(maxPrice) &&
      (!discountOnly || product.preco < product.precoAnterior),
    );
    if (sort === "menor") result.sort((a, b) => a.preco - b.preco);
    if (sort === "maior") result.sort((a, b) => b.preco - a.preco);
    if (sort === "desconto") result.sort((a, b) => (1 - b.preco / b.precoAnterior) - (1 - a.preco / a.precoAnterior));
    if (sort === "lancamentos") result.sort((a, b) => Number(b.tag === "Lançamento") - Number(a.tag === "Lançamento"));
    return result;
  }, [products, type, uniform, club, league, size, season, color, maxPrice, discountOnly, sort]);
  const clubOptions = Array.from(new Map(products.filter((product) => product.clubeSlug !== "revisar").map((product) => [product.clubeSlug, product.clube])).entries());
  const sizeOptions = Array.from(new Set(products.flatMap((product) => product.tamanhos))).sort();
  const seasonOptions = Array.from(new Set(products.map((product) => product.temporada).filter((value) => value !== "revisar")));
  const colorOptions = Array.from(new Set(products.map((product) => product.cor).filter((value) => value !== "revisar")));
  const leagueOptions = Array.from(new Set(products.map((product) => product.liga).filter((value) => value !== "revisar")));
  const clearFilters = () => {
    setClub("");
    setLeague("");
    setSize("");
    setSeason("");
    setColor("");
    setType("");
    setUniform("");
    setMaxPrice("600");
    setDiscountOnly(false);
  };
  const filterFields = <>
    <label className="filter-label">Clube<select className="filter-select" value={club} onChange={(event) => setClub(event.target.value)}><option value="">Todos os clubes</option>{clubOptions.map(([slug, name]) => <option key={slug} value={slug}>{name}</option>)}</select></label>
    <label className="filter-label">Liga<select className="filter-select" value={league} onChange={(event) => setLeague(event.target.value)}><option value="">Todas</option>{leagueOptions.map((slug) => <option key={slug} value={slug}>{leagues.find((item) => item.slug === slug)?.nome ?? slug}</option>)}</select></label>
    <label className="filter-label">Tamanho<select className="filter-select" value={size} onChange={(event) => setSize(event.target.value)}><option value="">Todos</option>{sizeOptions.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
    <label className="filter-label">Tipo<select className="filter-select" value={type} onChange={(event) => setType(event.target.value)}><option value="">Todos</option><option value="torcedor">Torcedor</option><option value="jogador">Jogador</option><option value="retro">Retrô</option><option value="treino">Treino</option><option value="cropped">Cropped</option><option value="regata">Regata</option><option value="inverno">Corta-vento</option></select></label>
    <label className="filter-label">Uniforme<select className="filter-select" value={uniform} onChange={(event) => setUniform(event.target.value)}><option value="">Todos</option><option value="titular">Titular</option><option value="reserva">Reserva</option><option value="terceiro">Terceiro</option></select></label>
    <label className="filter-label">Temporada<select className="filter-select" value={season} onChange={(event) => setSeason(event.target.value)}><option value="">Todas</option>{seasonOptions.map((item) => <option key={item}>{item}</option>)}</select></label>
    <label className="filter-label">Cor<select className="filter-select" value={color} onChange={(event) => setColor(event.target.value)}><option value="">Todas</option>{colorOptions.map((item) => <option key={item}>{item}</option>)}</select></label>
    <label className="filter-label">Faixa de preço<select className="filter-select" value={maxPrice} onChange={(event) => setMaxPrice(event.target.value)}><option value="600">Todos os preços</option><option value="180">Até {formatCurrency(180)}</option><option value="220">Até {formatCurrency(220)}</option><option value="300">Até {formatCurrency(300)}</option></select></label>
    <label className="mt-4 flex items-center gap-2 text-xs"><input type="checkbox" checked={discountOnly} onChange={(event) => setDiscountOnly(event.target.checked)} />Somente com desconto</label>
    <button className="mt-4 text-xs font-bold text-blue-700 underline" onClick={clearFilters}>Limpar filtros</button>
  </>;

  return <>
    {heroImage && <CategoryHero image={heroImage} eyebrow={heroEyebrow} title={title} description={description} breadcrumbs={breadcrumb} quickLinks={quickLinks} />}
    <main className={`mx-auto max-w-7xl px-4 py-7 lg:px-8 ${heroImage ? "min-h-[55vh]" : ""}`}>
    {!heroImage && <>
      <nav className="mb-5 flex flex-wrap items-center gap-2 text-xs text-muted" aria-label="Breadcrumb"><Link href="/">Início</Link>{breadcrumb.map((item, index) => <span key={item.name} className="flex items-center gap-2"><ChevronRight size={13} />{item.href && index !== breadcrumb.length - 1 ? <Link href={item.href}>{item.name}</Link> : <span>{item.name}</span>}</span>)}</nav>
      <div className="mb-7"><p className="text-[10px] font-black uppercase tracking-[.2em] text-blue-600">ALVES STORE · COLEÇÃO</p><h1 className="mt-1 text-3xl font-black tracking-tight sm:text-4xl">{title}</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-muted">{description}</p></div>
    </>}
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-y py-3">
      <span className="text-xs text-muted">{filtered.length} produtos encontrados</span>
      <div className="flex items-center gap-3"><button className="flex items-center gap-1 text-xs font-bold lg:hidden" onClick={() => setFiltersOpen(true)}><SlidersHorizontal size={15} />Filtros</button><label className="flex items-center gap-2 text-xs">Ordenar por <select value={sort} onChange={(event) => setSort(event.target.value)} className="rounded-lg border border-border bg-white px-2 py-2 text-xs"><option value="relevancia">Relevância</option><option value="menor">Menor preço</option><option value="maior">Maior preço</option><option value="desconto">Maior desconto</option><option value="lancamentos">Lançamentos</option></select></label></div>
    </div>
    <div className="grid gap-6 lg:grid-cols-[205px_1fr]">
      <aside className="hidden h-fit rounded-lg border border-border p-4 lg:block">
        <h2 className="mb-4 text-sm font-black">Filtrar produtos</h2>
        {filterFields}
        <div className="mt-6 border-t pt-4"><h3 className="mb-2 text-xs font-black uppercase">Explore ligas</h3>{leagues.slice(0, 6).map((league) => <Link className="block py-1.5 text-xs text-muted hover:text-ink" key={league.slug} href={`/ligas/${league.slug}`}>{league.nome}</Link>)}</div>
      </aside>
      <div>
        <ProductGrid items={filtered.slice(0, visibleCount)} />
        {visibleCount < filtered.length && <button onClick={() => setVisibleCount((count) => count + 12)} className="primary-button mx-auto mt-8 block px-8 py-3 text-xs font-black uppercase">Ver mais produtos</button>}
      </div>
    </div>
    {filtersOpen && <div className="fixed inset-0 z-[65] bg-black/50 lg:hidden" onClick={() => setFiltersOpen(false)}>
      <section role="dialog" aria-modal="true" aria-labelledby="mobile-filter-title" className="absolute bottom-0 left-0 right-0 max-h-[85dvh] overflow-y-auto rounded-t-2xl bg-white p-5 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] shadow-xl" onClick={(event) => event.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between"><h2 id="mobile-filter-title" className="text-lg font-black">Filtros</h2><button onClick={() => setFiltersOpen(false)} className="rounded-lg px-3 py-2 text-sm font-bold">Fechar</button></div>
        {filterFields}
        <button onClick={() => setFiltersOpen(false)} className="primary-button mt-5 w-full py-3 text-sm font-black uppercase">Ver {filtered.length} produtos</button>
      </section>
    </div>}
    </main>
  </>;
}
