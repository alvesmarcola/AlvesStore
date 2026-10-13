"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Menu, Search, ShoppingBag, X, ChevronDown, ArrowUpRight } from "lucide-react";
import { leagues, products } from "@/lib/catalog";
import { useCart } from "@/store/cart";
import { searchProducts } from "@/lib/smart-search";

const maleCategories = [["Versão Torcedor", "torcedor"], ["Versão Jogador", "jogador"], ["Retrô", "retro"], ["Conjunto de Treino", "treino"], ["Mangas compridas", "inverno"], ["Regatas", "regata"]];
const femaleCategories = [["Camisas Femininas", "torcedor"], ["Conjuntos", "treino"]];
const dropdownTransition = { duration: 0.18, ease: "easeOut" as const };

export function SiteHeader() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [leagueOpen, setLeagueOpen] = useState(false);
  const [categoryOpen, setCategoryOpen] = useState("");
  const [query, setQuery] = useState("");
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const router = useRouter();
  const reducedMotion = useReducedMotion();
  const count = useCart((state) => state.items.reduce((sum, item) => sum + item.quantity, 0));
  const setDrawerOpen = useCart((state) => state.setDrawerOpen);
  const searchResults = query.trim() ? searchProducts(products, query) : { results: [], alternatives: [] };
  const suggestions = (searchResults.results.length ? searchResults.results : searchResults.alternatives).slice(0, 5);

  function search(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    router.push(`/busca?q=${encodeURIComponent(query.trim())}`);
    setSuggestionsOpen(false);
  }

  const dropdownMotion = reducedMotion
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } }
    : { initial: { opacity: 0, y: 8 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: 6 } };

  return (
    <>
      <header className="site-header sticky top-0 z-40 border-b border-white/10 bg-ink text-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 lg:px-8">
          <button className="header-icon lg:hidden" aria-label="Abrir menu" onClick={() => setMenuOpen(true)}><Menu size={23} /></button>
          <Link href="/" className="shrink-0 leading-none" aria-label="ALVES STORE - início">
            <span className="block text-[22px] font-black uppercase tracking-tighter text-white sm:text-[27px]">ALVES <span className="text-action">STORE</span></span>
          </Link>
          <div className="relative hidden max-w-xl flex-1 md:block">
            <form onSubmit={search} role="search" className="flex items-center rounded-full border border-white/10 bg-graphite px-4 py-2.5 focus-within:border-action">
              <Search size={18} className="text-white/55" />
              <input role="combobox" aria-autocomplete="list" value={query} onFocus={() => setSuggestionsOpen(true)} onChange={(event) => { setQuery(event.target.value); setSuggestionsOpen(true); }} onKeyDown={(event) => { if (event.key === "Escape") setSuggestionsOpen(false); }} placeholder="Busque por camisa, clube ou liga..." className="ml-2 min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-white/45" aria-label="Buscar produtos" aria-expanded={suggestionsOpen && suggestions.length > 0} aria-controls="search-suggestions" />
              <button className="text-[10px] font-black uppercase tracking-wider text-blue-200">Buscar</button>
            </form>
            {suggestionsOpen && suggestions.length > 0 && <div id="search-suggestions" role="listbox" className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-lg border border-border bg-white p-2 text-ink shadow-card">
              {searchResults.results.length === 0 && <p className="px-3 py-2 text-[10px] leading-4 text-muted">Alternativas relacionadas; versão ou uniforme ainda não confirmados.</p>}
              {suggestions.map((product) => <Link role="option" aria-selected="false" href={`/produto/${product.slug}`} key={product.id} onClick={() => { setQuery(""); setSuggestionsOpen(false); }} className="block rounded px-3 py-2 text-xs hover:bg-paper">{product.nome}<span className="mt-1 block text-muted">{product.clube} · {product.temporada}</span></Link>)}
              <Link href={`/busca?q=${encodeURIComponent(query)}`} className="block border-t border-border px-3 py-3 text-xs font-bold text-blue-700">Ver todos os resultados</Link>
            </div>}
          </div>
          <div className="flex items-center gap-1 sm:gap-4">
            <button aria-label={`Sacola, ${count} itens`} className="relative flex h-10 w-10 items-center justify-center rounded-full transition hover:bg-white/10" onClick={() => setDrawerOpen(true)}>
              <ShoppingBag size={22} />
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.span key={count} initial={reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.55 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.7 }} transition={reducedMotion ? { duration: 0 } : { type: "spring", stiffness: 520, damping: 26 }} className="absolute -right-0.5 -top-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-action px-1 text-[10px] font-black text-white">{count}</motion.span>
              </AnimatePresence>
            </button>
          </div>
        </div>

        <form onSubmit={search} role="search" className="flex items-center gap-2 border-t border-white/10 bg-graphite px-4 py-2 md:hidden">
          <Search size={17} className="text-white/60" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="O que você procura?" className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-white/50" aria-label="Buscar produtos" />
          <button className="text-[10px] font-black uppercase text-blue-200">Buscar</button>
        </form>

        <nav className="hidden border-t border-white/10 lg:block" aria-label="Menu principal">
          <div className="mx-auto flex max-w-7xl items-center justify-center gap-9 px-8 text-[11px] font-bold uppercase tracking-[.11em]">
            <div className="relative" onMouseEnter={() => setCategoryOpen("masculino")} onMouseLeave={() => setCategoryOpen("")}>
              <Link className="nav-link" href="/masculino">Masculino</Link>
              <AnimatePresence>{categoryOpen === "masculino" && <motion.div {...dropdownMotion} transition={dropdownTransition} className="absolute left-0 top-full z-50 w-64 rounded-b-lg border border-white/10 bg-graphite p-4 shadow-2xl">{maleCategories.map(([name, type], index) => <motion.div key={type} initial={reducedMotion ? false : { opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: reducedMotion ? 0 : index * 0.025 }}><Link href={`/masculino?tipo=${type}`} className="menu-option block rounded px-3 py-2.5 text-xs font-semibold normal-case text-white/75">{name}</Link></motion.div>)}</motion.div>}</AnimatePresence>
            </div>
            <div className="relative" onMouseEnter={() => setCategoryOpen("feminino")} onMouseLeave={() => setCategoryOpen("")}>
              <Link className="nav-link" href="/feminino">Feminino</Link>
              <AnimatePresence>{categoryOpen === "feminino" && <motion.div {...dropdownMotion} transition={dropdownTransition} className="absolute left-0 top-full z-50 w-64 rounded-b-lg border border-white/10 bg-graphite p-4 shadow-2xl">{femaleCategories.map(([name, type], index) => <motion.div key={`${type}-${index}`} initial={reducedMotion ? false : { opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: reducedMotion ? 0 : index * 0.025 }}><Link href={`/feminino?tipo=${type}`} className="menu-option block rounded px-3 py-2.5 text-xs font-semibold normal-case text-white/75">{name}</Link></motion.div>)}</motion.div>}</AnimatePresence>
            </div>
            <div className="relative" onMouseEnter={() => setLeagueOpen(true)} onMouseLeave={() => setLeagueOpen(false)}>
              <button className="nav-link flex items-center gap-1" onFocus={() => setLeagueOpen(true)} onClick={() => setLeagueOpen(true)} aria-expanded={leagueOpen}>Ligas <ChevronDown size={14} /></button>
              <AnimatePresence>{leagueOpen && <motion.div {...dropdownMotion} transition={dropdownTransition} style={{ left: "max(1rem, calc((100vw - 1060px) / 2))", top: "10rem", width: "min(1060px, calc(100vw - 2rem))" }} className="fixed z-50 grid max-h-[70svh] grid-cols-2 gap-x-5 gap-y-6 overflow-y-auto rounded-b-xl border border-white/10 bg-graphite p-5 normal-case shadow-2xl sm:grid-cols-3 sm:p-7 xl:grid-cols-4">
                {leagues.map((league, index) => <motion.div key={league.slug} initial={reducedMotion ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: reducedMotion ? 0 : index * 0.025 }}>
                  <Link href={`/ligas/${league.slug}`} className="group mb-2 flex items-start justify-between gap-2 text-xs font-black uppercase text-white"><span>{league.nome}</span><ArrowUpRight size={13} className="shrink-0 text-action transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5" /></Link>
                  <span className="mb-2 block text-[9px] font-bold uppercase tracking-wider text-white/40">{league.pais} · {league.slug === "selecoes" ? "seleções" : `${league.clubes.length} clubes`}</span>
                  {league.clubes.slice(0, 3).map((club) => <Link key={club.slug} className="menu-option mb-1 block rounded px-2 py-1.5 text-[10px] font-medium text-white/65" href={`/ligas/${league.slug}/${club.slug}`}>{club.nome}</Link>)}
                </motion.div>)}
              </motion.div>}</AnimatePresence>
            </div>
            <Link className="nav-link" href="/ligas/selecoes">Seleções nacionais</Link>
            <Link className="nav-link" href="/rastreio">Rastreio</Link>
          </div>
        </nav>
      </header>

      <AnimatePresence>
        {menuOpen && <motion.div initial={reducedMotion ? { opacity: 0 } : { opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[60] bg-black/65 lg:hidden" onClick={() => setMenuOpen(false)}>
          <motion.aside initial={reducedMotion ? { x: 0, opacity: 0 } : { x: "-100%" }} animate={{ x: 0, opacity: 1 }} exit={reducedMotion ? { opacity: 0 } : { x: "-100%" }} transition={reducedMotion ? { duration: 0 } : { type: "spring", stiffness: 340, damping: 34 }} className="h-full w-[min(88vw,400px)] overflow-y-auto bg-white p-5 text-ink" onClick={(event) => event.stopPropagation()}>
            <div className="mb-6 flex items-center justify-between"><span className="text-lg font-black uppercase tracking-wide">Navegue</span><button className="icon-button" onClick={() => setMenuOpen(false)} aria-label="Fechar menu"><X /></button></div>
            <button className="mobile-nav-link flex w-full items-center justify-between" aria-expanded={categoryOpen === "masculino"} onClick={() => setCategoryOpen(categoryOpen === "masculino" ? "" : "masculino")}>Masculino <ChevronDown size={16} /></button>
            {categoryOpen === "masculino" && <div className="mb-3 pl-4"><Link href="/masculino" className="block py-2 text-xs font-black">Ver tudo</Link>{maleCategories.map(([name, type]) => <Link key={type} href={`/masculino?tipo=${type}`} className="block py-2 text-xs text-muted">{name}</Link>)}</div>}
            <button className="mobile-nav-link flex w-full items-center justify-between" aria-expanded={categoryOpen === "feminino"} onClick={() => setCategoryOpen(categoryOpen === "feminino" ? "" : "feminino")}>Feminino <ChevronDown size={16} /></button>
            {categoryOpen === "feminino" && <div className="mb-3 pl-4"><Link href="/feminino" className="block py-2 text-xs font-black">Ver tudo</Link>{femaleCategories.map(([name, type], index) => <Link key={`${type}-${index}`} href={`/feminino?tipo=${type}`} className="block py-2 text-xs text-muted">{name}</Link>)}</div>}
            <button className="mobile-nav-link flex w-full items-center justify-between" aria-expanded={leagueOpen} onClick={() => setLeagueOpen(!leagueOpen)}>Ligas <ChevronDown size={16} /></button>
            {leagueOpen && <div className="mb-3 pl-4">{leagues.map((league) => <div key={league.slug} className="border-b border-border py-2"><Link href={`/ligas/${league.slug}`} className="text-xs font-black text-ink">{league.nome}</Link><div className="mt-1 flex flex-wrap gap-x-3">{league.clubes.slice(0, 4).map((club) => <Link key={club.slug} className="py-1 text-[10px] text-muted" href={`/ligas/${league.slug}/${club.slug}`}>{club.nome}</Link>)}</div></div>)}</div>}
            <Link className="mobile-nav-link" href="/ligas/selecoes">Seleções nacionais</Link><Link className="mobile-nav-link" href="/rastreio">Rastreio de pedido</Link>
          </motion.aside>
        </motion.div>}
      </AnimatePresence>
    </>
  );
}
