"use client";

import Image from "next/image";
import Link from "next/link";
import { images } from "@/data/images";
import type { CatalogLeague } from "@/lib/catalog-taxonomy";

export function StickyLeagueRail({ leagues }: { leagues: CatalogLeague[] }) {
  return (
    <section
      aria-label="Ligas e competições"
      className="bg-ink py-14 text-white"
    >
      <div className="mx-auto max-w-7xl px-5 lg:px-8">
        <div className="mb-7 flex items-end justify-between gap-6">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[.2em] text-action">A paixão não tem fronteiras</p>
            <h2 className="mt-2 text-3xl font-black uppercase sm:text-5xl">Jogue em qualquer arena</h2>
          </div>
          <span className="hidden text-xs font-bold uppercase tracking-widest text-white/50 sm:block">Deslize para explorar <span aria-hidden="true">→</span></span>
        </div>
        <div className="league-rail flex snap-x snap-mandatory gap-4 overflow-x-auto overflow-y-hidden pb-12" tabIndex={0} aria-label="Navegue pelos cards de ligas na horizontal">
          {leagues.map((league, index) => {
            const cover = league.coverImage ?? images.categories.leagues.src;
            return (
              <Link
                key={league.slug}
                href={`/ligas/${league.slug}`}
                className={`league-rail-card group relative isolate flex h-[52vh] min-h-[320px] max-h-[520px] w-[76vw] max-w-[410px] shrink-0 snap-start items-end overflow-hidden rounded-lg border p-5 sm:w-[36vw] sm:p-7 lg:w-[30vw] ${index % 2 ? "sm:translate-y-10" : ""}`}
              >
                <Image
                  src={cover}
                  alt={`Produtos de ${league.nome}`}
                  fill
                  sizes="(max-width: 640px) 76vw, (max-width: 1024px) 36vw, 30vw"
                  className="league-cover object-cover"
                />
                <span className="absolute inset-0 -z-10 bg-gradient-to-t from-black via-black/20 to-blue-900/15" />
                <span className="pointer-events-none absolute -right-4 top-4 -z-10 text-[7rem] font-black uppercase leading-none tracking-tighter text-white/10 sm:text-[10rem]">{String(index + 1).padStart(2, "0")}</span>
                <span className="relative z-10">
                  <span className="mb-2 block text-[10px] font-black uppercase tracking-[.24em] text-action">Catálogo atualizado</span>
                  <span className="block max-w-[16ch] text-3xl font-black uppercase leading-none sm:text-4xl">{league.nome}</span>
                  <span className="mt-3 block text-xs font-semibold text-white/70">{league.productCount} produtos · {league.clubes.length} clubes</span>
                </span>
                <span className="absolute right-5 top-5 z-10 grid h-10 w-10 place-items-center rounded-full border border-white/35 text-lg transition duration-200 group-hover:-translate-y-1 group-hover:translate-x-1 group-hover:bg-action">↗</span>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
