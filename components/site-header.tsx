"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Menu, Search, ShoppingBag, UserRound, X, ChevronDown } from "lucide-react";
import { leagues, products } from "@/lib/catalog";
import { useCart } from "@/store/cart";

export function SiteHeader() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [leagueOpen, setLeagueOpen] = useState(false);
  const [categoryOpen, setCategoryOpen] = useState("");
  const [query, setQuery] = useState("");
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const router = useRouter();
  const count = useCart((state) => state.items.reduce((sum, item) => sum + item.quantity, 0));
  const setDrawerOpen = useCart((state) => state.setDrawerOpen);
  const maleCategories = [["Versão Torcedor", "torcedor"], ["Versão Jogador", "jogador"], ["Retrô", "retro"], ["Conjunto de Treino", "treino"], ["Corta-vento / Inverno", "inverno"], ["Regatas", "regata"]];
  const femaleCategories = [["Camisas Femininas", "torcedor"], ["Versão Jogadora", "jogador"], ["Cropped", "cropped"], ["Vestidos", "vestido"], ["Retrô", "retro"], ["Conjuntos", "treino"]];
  const suggestions = query.trim()
    ? products.filter((product) => `${product.nome} ${product.clube}`.toLocaleLowerCase("pt-BR").includes(query.toLocaleLowerCase("pt-BR"))).slice(0, 5)
    : [];

  function search(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    router.push(`/busca?q=${encodeURIComponent(query.trim())}`);
  }

  return (
    <>
      <div className="bg-ink px-4 py-2 text-center text-xs font-bold tracking-wide text-white sm:text-sm">
        PRIMEIRA COMPRA? USE <span className="font-black text-action">PRIMEIRACOMPRA</span> E GANHE 10% OFF
      </div>
      <header className="sticky top-0 z-40 border-b border-black/5 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 lg:px-8">
          <button className="icon-button lg:hidden" aria-label="Abrir menu" onClick={() => setMenuOpen(true)}><Menu size={23} /></button>
          <Link href="/" className="shrink-0 leading-none" aria-label="alves store - início">
            <span className="block text-[22px] font-black lowercase tracking-tighter text-pitch sm:text-[27px]">alves <span className="text-lime">store</span></span>
            <span className="mt-1 block text-[9px] font-bold uppercase tracking-[.24em] text-muted">Vista seu time. Leve o jogo.</span>
          </Link>
          <div className="relative hidden max-w-xl flex-1 md:block">
            <form onSubmit={search} className="flex items-center rounded-full bg-paper px-4 py-2.5">
              <Search size={18} className="text-muted" />
              <input role="combobox" aria-autocomplete="list" value={query} onFocus={() => setSuggestionsOpen(true)} onChange={(event) => { setQuery(event.target.value); setSuggestionsOpen(true); }} onKeyDown={(event) => { if (event.key === "Escape") setSuggestionsOpen(false); }} placeholder="Busque por camisa, clube ou liga..." className="ml-2 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted" aria-label="Buscar produtos" aria-expanded={suggestionsOpen && suggestions.length > 0} aria-controls="search-suggestions" />
              <button className="text-xs font-bold text-pitch">BUSCAR</button>
            </form>
            {suggestionsOpen && suggestions.length > 0 && <div id="search-suggestions" role="listbox" className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-lg border border-border bg-white p-2 shadow-card">
              {suggestions.map((product) => <Link role="option" aria-selected="false" href={`/produto/${product.slug}`} key={product.id} onClick={() => { setQuery(""); setSuggestionsOpen(false); }} className="block rounded px-3 py-2 text-xs hover:bg-paper">{product.nome}<span className="mt-1 block text-muted">{product.clube} · {product.temporada}</span></Link>)}
              <Link href={`/busca?q=${encodeURIComponent(query)}`} className="block border-t border-border px-3 py-3 text-xs font-bold text-blue-700">Ver todos os resultados</Link>
            </div>}
          </div>
          <div className="flex items-center gap-1 sm:gap-4">
            <Link href="/login" className="hidden items-center gap-2 text-xs font-semibold text-ink sm:flex"><UserRound size={20} /><span>Olá!<br />Entre ou cadastre-se</span></Link>
            <button aria-label={`Carrinho com ${count} itens`} className="relative flex h-10 w-10 items-center justify-center rounded-full hover:bg-paper" onClick={() => setDrawerOpen(true)}>
              <ShoppingBag size={22} /><span className="absolute -right-0.5 -top-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-lime px-1 text-[10px] font-black">{count}</span>
            </button>
          </div>
        </div>
        <form onSubmit={search} className="flex items-center gap-2 border-t border-black/5 px-4 py-2 md:hidden">
          <Search size={17} className="text-muted" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="O que você procura?" className="min-w-0 flex-1 text-sm outline-none" aria-label="Buscar produtos" />
        </form>
        <nav className="hidden border-t border-black/5 lg:block" aria-label="Menu principal">
          <div className="mx-auto flex max-w-7xl items-center justify-center gap-10 px-8 text-[13px] font-bold uppercase tracking-wide">
            <div className="relative" onMouseEnter={() => setCategoryOpen("masculino")} onMouseLeave={() => setCategoryOpen("")}>
              <Link className="nav-link" href="/masculino">Masculino</Link>
              {categoryOpen === "masculino" && <div className="absolute left-0 top-full z-50 w-60 rounded-lg border border-black/5 bg-white p-4 shadow-card">{maleCategories.map(([name, type]) => <Link key={type} href={`/masculino?tipo=${type}`} className="block py-2 text-xs font-semibold normal-case text-muted hover:text-pitch">{name}</Link>)}</div>}
            </div>
            <div className="relative" onMouseEnter={() => setCategoryOpen("feminino")} onMouseLeave={() => setCategoryOpen("")}>
              <Link className="nav-link" href="/feminino">Feminino</Link>
              {categoryOpen === "feminino" && <div className="absolute left-0 top-full z-50 w-60 rounded-lg border border-black/5 bg-white p-4 shadow-card">{femaleCategories.map(([name, type], index) => <Link key={`${type}-${index}`} href={`/feminino?tipo=${type}`} className="block py-2 text-xs font-semibold normal-case text-muted hover:text-pitch">{name}</Link>)}</div>}
            </div>
            <div className="relative" onMouseEnter={() => setLeagueOpen(true)} onMouseLeave={() => setLeagueOpen(false)}>
              <button className="nav-link flex items-center gap-1" onClick={() => setLeagueOpen(!leagueOpen)} aria-expanded={leagueOpen}>Ligas <ChevronDown size={14} /></button>
              {leagueOpen && <div className="absolute left-1/2 top-full z-50 grid w-[620px] -translate-x-1/2 grid-cols-3 gap-6 rounded-xl border border-black/5 bg-white p-6 normal-case shadow-card">
                {leagues.map((league) => <div key={league.slug}><Link href={`/ligas/${league.slug}`} className="mb-2 block text-sm font-black text-pitch">{league.name}</Link>{league.clubs.slice(0, 4).map((club) => <Link key={club.slug} className="mb-1 block text-xs font-medium text-muted hover:text-ink" href={`/ligas/${league.slug}/${club.slug}`}>{club.name}</Link>)}</div>)}
              </div>}
            </div>
            <Link className="nav-link" href="/busca?q=oferta">Ofertas da semana</Link><Link className="nav-link" href="/busca?q=lançamento">Lançamentos</Link><Link className="nav-link" href="/rastreio">Rastreio</Link>
          </div>
        </nav>
      </header>
      {menuOpen && <div className="fixed inset-0 z-[60] bg-black/40 lg:hidden" onClick={() => setMenuOpen(false)}>
        <aside className="h-full w-[min(88vw,380px)] overflow-y-auto bg-white p-5" onClick={(event) => event.stopPropagation()}>
          <div className="mb-6 flex items-center justify-between"><span className="text-lg font-black text-pitch">NAVEGUE</span><button className="icon-button" onClick={() => setMenuOpen(false)} aria-label="Fechar menu"><X /></button></div>
          <button className="mobile-nav-link flex w-full items-center justify-between" onClick={() => setCategoryOpen(categoryOpen === "masculino" ? "" : "masculino")}>Masculino <ChevronDown size={16} /></button>
          {categoryOpen === "masculino" && <div className="mb-3 pl-4"><Link href="/masculino" className="block py-2 text-xs font-black">Ver tudo</Link>{maleCategories.map(([name, type]) => <Link key={type} href={`/masculino?tipo=${type}`} className="block py-2 text-xs text-muted">{name}</Link>)}</div>}
          <button className="mobile-nav-link flex w-full items-center justify-between" onClick={() => setCategoryOpen(categoryOpen === "feminino" ? "" : "feminino")}>Feminino <ChevronDown size={16} /></button>
          {categoryOpen === "feminino" && <div className="mb-3 pl-4"><Link href="/feminino" className="block py-2 text-xs font-black">Ver tudo</Link>{femaleCategories.map(([name, type], index) => <Link key={`${type}-${index}`} href={`/feminino?tipo=${type}`} className="block py-2 text-xs text-muted">{name}</Link>)}</div>}
          <button className="mobile-nav-link flex w-full items-center justify-between" onClick={() => setLeagueOpen(!leagueOpen)}>Ligas <ChevronDown size={16} /></button>
          {leagueOpen && <div className="mb-3 pl-4">{leagues.map((league) => <div key={league.slug} className="py-1"><Link href={`/ligas/${league.slug}`} className="text-sm font-bold text-pitch">{league.name}</Link><div className="flex flex-wrap gap-x-3">{league.clubs.slice(0, 3).map((club) => <Link key={club.slug} className="py-1 text-xs text-muted" href={`/ligas/${league.slug}/${club.slug}`}>{club.name}</Link>)}</div></div>)}</div>}
          <Link className="mobile-nav-link" href="/busca?q=oferta">Ofertas da semana</Link><Link className="mobile-nav-link" href="/busca?q=lançamento">Lançamentos</Link><Link className="mobile-nav-link" href="/rastreio">Rastreio de pedido</Link><Link className="mobile-nav-link" href="/login">Entre ou cadastre-se</Link>
        </aside>
      </div>}
    </>
  );
}
