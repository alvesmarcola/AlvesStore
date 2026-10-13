"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronRight, SlidersHorizontal } from "lucide-react";
import { ProductGrid } from "@/components/product-grid";
import { formatCurrency, leagues } from "@/lib/catalog";
import { storeConfig } from "@/config";
import type { Product } from "@/lib/types";
import { searchProducts } from "@/lib/smart-search";
import { classifyProduct, getProductUnitPrice } from "@/lib/product-classification";
import { getProductCategoryKey } from "@/lib/commerce";
import { compareCatalogProducts } from "@/lib/catalog-order";
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
  initialSearch?: string;
  notice?: string;
}

export function CatalogPage({ title, description, products, breadcrumb, initialType = "", heroImage, heroEyebrow = "Coleção alves store", quickLinks, initialSearch = "", notice }: CatalogPageProps) {
  const [sort, setSort] = useState("relevancia");
  const [search, setSearch] = useState("");
  const [type, setType] = useState(initialType);
  const [uniform, setUniform] = useState("");
  const [sleeve, setSleeve] = useState("");
  const [club, setClub] = useState("");
  const [league, setLeague] = useState("");
  const [size, setSize] = useState("");
  const [season, setSeason] = useState("");
  const [color, setColor] = useState("");
  const [maxPrice, setMaxPrice] = useState("600");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [visibleCount, setVisibleCount] = useState(12);
  const urlReady = useRef(false);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setSearch(initialSearch !== undefined ? initialSearch : params.get("q") ?? ""); setType(params.get("tipo") ?? initialType);
    setUniform(params.get("uniforme") ?? ""); setClub(params.get("clube") ?? ""); setLeague(params.get("liga") ?? ""); setSleeve(params.get("manga") ?? "");
    setSize(params.get("tamanho") ?? ""); setSeason(params.get("temporada") ?? ""); setColor(params.get("cor") ?? "");
    setMaxPrice(params.get("preco") ?? "600"); setSort(params.get("ordem") ?? "relevancia"); urlReady.current = true;
  }, [initialType, initialSearch]);
  useEffect(() => {
    if (!urlReady.current) return;
    const params = new URLSearchParams();
    const values: Record<string, string> = { q: search, tipo: type, uniforme: uniform, manga: sleeve, clube: club, liga: league, tamanho: size, temporada: season, cor: color, preco: maxPrice === "600" ? "" : maxPrice, ordem: sort === "relevancia" ? "" : sort };
    for (const [key, value] of Object.entries(values)) if (value) params.set(key, value);
    const query = params.toString(); window.history.replaceState(null, "", `${window.location.pathname}${query ? `?${query}` : ""}`);
  }, [search, type, uniform, sleeve, club, league, size, season, color, maxPrice, sort]);
  useEffect(() => setVisibleCount(12), [products, type, uniform, sleeve, club, league, size, season, color, maxPrice, sort]);
  const filtered = useMemo(() => {
    const searchResults = search.trim() ? searchProducts(products, search).results : null;
    const matchingProducts = searchResults ? new Set(searchResults.map((product) => product.id)) : null;
    const searchRank = new Map(searchResults?.map((product, index) => [product.id, index]) ?? []);
    const result = products.filter((product) => {
      const price = getProductUnitPrice(product);
      const verifiedUniform = classifyProduct(product).uniform;
      const priceMatches = maxPrice === "600" || (price !== null && price <= Number(maxPrice));
      const category = getProductCategoryKey(product);
      const categoryMatches = !type || category === type || (type === "inverno" && classifyProduct(product).sleeve === "long");
      return categoryMatches && (!sleeve || classifyProduct(product).sleeve === sleeve) && (!uniform || verifiedUniform === uniform) &&
        (!club || product.clubeSlug === club) && (!league || product.liga === league) &&
        (!size || product.tamanhos.includes(size)) &&
        (!season || product.temporada === season) && (!color || product.cor === color) &&
        priceMatches &&
        (!matchingProducts || matchingProducts.has(product.id));
    });
    if (sort === "menor") result.sort((a, b) => (getProductUnitPrice(a) ?? Infinity) - (getProductUnitPrice(b) ?? Infinity) || compareCatalogProducts(a, b));
    else if (sort === "maior") result.sort((a, b) => (getProductUnitPrice(b) ?? -Infinity) - (getProductUnitPrice(a) ?? -Infinity) || compareCatalogProducts(a, b));
    else if (searchResults) result.sort((a, b) => (searchRank.get(a.id) ?? Infinity) - (searchRank.get(b.id) ?? Infinity));
    else result.sort(compareCatalogProducts);
    return result;
  }, [products, type, uniform, sleeve, club, league, size, season, color, maxPrice, search, sort]);
  const clubOptions = Array.from(new Map(products.filter((product) => product.clubeSlug !== "revisar").map((product) => [product.clubeSlug, product.clube])).entries());
  const sizeOptions = Array.from(new Set(products.flatMap((product) => product.tamanhos))).sort();
  const seasonOptions = Array.from(new Set(products.map((product) => product.temporada).filter((value) => value !== "revisar")));
  const colorOptions = Array.from(new Set(products.map((product) => product.cor).filter((value) => value !== "revisar")));
  const leagueOptions = Array.from(new Set(products.map((product) => product.liga).filter((value) => value !== "revisar")));
  const typeLabels: Record<string, string> = { torcedor: "Torcedor", jogador: "Jogador", goleiro: "Goleiro", retro: "Retrô", treino: "Treino", cropped: "Cropped", regata: "Regata", inverno: "Mangas compridas", vestido: "Vestido" };
  typeLabels["full-patch"] = "Full Patches";
  const typeOptions = Array.from(new Set(["torcedor", "jogador", "retro", "full-patch", ...products.map((product) => getProductCategoryKey(product).toString()).filter((value) => value !== "revisar")]));
  const sleeveOptions = Array.from(new Set(products.map((product) => classifyProduct(product).sleeve).filter((value) => value !== "unknown")));
  const uniformLabels: Record<string, string> = { titular: "Casa (Home)", reserva: "Fora (Away)", terceiro: "Terceira camisa (Third)", quarto: "Quarta camisa (Fourth)" };
  const uniformOptions = Array.from(new Set(products.map((product) => classifyProduct(product).uniform).filter((value) => value !== "revisar")));
  const clearFilters = () => {
    setClub("");
    setLeague("");
    setSize("");
    setSeason("");
    setColor("");
    setType("");
    setUniform("");
    setSleeve("");
    setSearch("");
    setMaxPrice("600");
  };
  const filterFields = <>
    <label className="filter-label">Clube<select className="filter-select" value={club} onChange={(event) => setClub(event.target.value)}><option value="">Todos os clubes</option>{clubOptions.map(([slug, name]) => <option key={slug} value={slug}>{name}</option>)}</select></label>
    <label className="filter-label">Liga<select className="filter-select" value={league} onChange={(event) => setLeague(event.target.value)}><option value="">Todas</option>{leagueOptions.map((slug) => <option key={slug} value={slug}>{leagues.find((item) => item.slug === slug)?.nome ?? slug}</option>)}</select></label>
    <label className="filter-label">Tamanho<select className="filter-select" value={size} onChange={(event) => setSize(event.target.value)}><option value="">Todos</option>{sizeOptions.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
    <label className="filter-label">Categoria<select className="filter-select" value={type} onChange={(event) => setType(event.target.value)}><option value="">Todas</option>{typeOptions.map((item) => <option key={item} value={item}>{typeLabels[item] ?? item}</option>)}</select></label>
    {sleeveOptions.length > 0 && <label className="filter-label">Manga<select className="filter-select" value={sleeve} onChange={(event) => setSleeve(event.target.value)}><option value="">Todas</option>{sleeveOptions.map((item) => <option key={item} value={item}>{item === "long" ? "Manga longa" : "Manga curta"}</option>)}</select></label>}
    {uniformOptions.length > 0 && <label className="filter-label">Uniforme<select className="filter-select" value={uniform} onChange={(event) => setUniform(event.target.value)}><option value="">Todos</option>{uniformOptions.map((item) => <option key={item} value={item}>{uniformLabels[item] ?? item}</option>)}</select></label>}
    <label className="filter-label">Temporada<select className="filter-select" value={season} onChange={(event) => setSeason(event.target.value)}><option value="">Todas</option>{seasonOptions.map((item) => <option key={item}>{item}</option>)}</select></label>
    {colorOptions.length > 0 && <label className="filter-label">Cor<select className="filter-select" value={color} onChange={(event) => setColor(event.target.value)}><option value="">Todas</option>{colorOptions.map((item) => <option key={item}>{item}</option>)}</select></label>}
    <label className="filter-label">Faixa de preço<select className="filter-select" value={maxPrice} onChange={(event) => setMaxPrice(event.target.value)}><option value="600">Todos os preços</option><option value={storeConfig.fanCommonPrice}>Até {formatCurrency(storeConfig.fanCommonPrice)}</option><option value={storeConfig.retroShortSleevePrice}>Até {formatCurrency(storeConfig.retroShortSleevePrice)}</option><option value={storeConfig.fanFullPatchPrice}>Até {formatCurrency(storeConfig.fanFullPatchPrice)}</option><option value={storeConfig.retroLongSleevePrice}>Até {formatCurrency(storeConfig.retroLongSleevePrice)}</option></select></label>
    <button className="mt-4 text-xs font-bold text-blue-700 underline" onClick={clearFilters}>Limpar filtros</button>
  </>;

  return <>
    {heroImage && <CategoryHero image={heroImage} eyebrow={heroEyebrow} title={title} description={description} breadcrumbs={breadcrumb} quickLinks={quickLinks} />}
    <main className={`mx-auto max-w-7xl px-4 py-7 lg:px-8 ${heroImage ? "min-h-[55vh]" : ""}`}>
    {!heroImage && <>
      <nav className="mb-5 flex flex-wrap items-center gap-2 text-xs text-muted" aria-label="Breadcrumb"><Link href="/">Início</Link>{breadcrumb.map((item, index) => <span key={item.name} className="flex items-center gap-2"><ChevronRight size={13} />{item.href && index !== breadcrumb.length - 1 ? <Link href={item.href}>{item.name}</Link> : <span>{item.name}</span>}</span>)}</nav>
      <div className="mb-7"><p className="text-[10px] font-black uppercase tracking-[.2em] text-blue-600">ALVES STORE · COLEÇÃO</p><h1 className="mt-1 text-3xl font-black tracking-tight sm:text-4xl">{title}</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-muted">{description}</p></div>
      {notice && <p role="status" className="mb-5 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm leading-6 text-amber-950">{notice}</p>}
    </>}
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-y py-3">
      <span className="text-xs text-muted">{filtered.length} produtos encontrados</span>
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 rounded-lg border border-border bg-white px-3 py-2 text-xs text-muted">
          <span className="font-bold text-ink">Buscar camisa</span>
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Ex.: Flamengo, retro, 26/27..." className="w-44 bg-transparent text-xs text-ink outline-none placeholder:text-muted" aria-label="Buscar camisa" />
        </label>
        <button className="flex items-center gap-1 text-xs font-bold lg:hidden" onClick={() => setFiltersOpen(true)}><SlidersHorizontal size={15} />Filtros</button>
        <label className="flex items-center gap-2 text-xs">Ordenar por <select value={sort} onChange={(event) => setSort(event.target.value)} className="rounded-lg border border-border bg-white px-2 py-2 text-xs"><option value="relevancia">Relevância</option><option value="menor">Menor preço</option><option value="maior">Maior preço</option></select></label>
      </div>
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
