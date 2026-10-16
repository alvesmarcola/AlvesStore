"use client";

import Link from "next/link";
import { ArrowUpRight, Flag, Gauge, MoveUpRight } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";

function RacingCarArtwork() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 900 420"
      fill="none"
      className="f1-car-art absolute -bottom-2 left-1/2 w-[112%] max-w-none -translate-x-1/2 sm:bottom-0 sm:w-[105%]"
    >
      <defs>
        <linearGradient id="car-body" x1="208" x2="713" y1="176" y2="304" gradientUnits="userSpaceOnUse">
          <stop stopColor="#ff3b35" />
          <stop offset=".48" stopColor="#d90500" />
          <stop offset="1" stopColor="#790b0b" />
        </linearGradient>
        <linearGradient id="car-wing" x1="224" x2="681" y1="118" y2="144" gradientUnits="userSpaceOnUse">
          <stop stopColor="#f4f4f5" />
          <stop offset="1" stopColor="#74777d" />
        </linearGradient>
        <linearGradient id="tire" x1="0" x2="1" y1="0" y2="1">
          <stop stopColor="#34363b" />
          <stop offset="1" stopColor="#090a0c" />
        </linearGradient>
        <filter id="car-shadow" x="78" y="83" width="750" height="300" colorInterpolationFilters="sRGB" filterUnits="userSpaceOnUse">
          <feGaussianBlur stdDeviation="15" />
        </filter>
      </defs>

      <ellipse cx="459" cy="326" fill="#000" opacity=".75" rx="334" ry="29" filter="url(#car-shadow)" />
      <path d="M162 275h99l23 56h-93l-29-56ZM631 274h94l-23 57h-91l20-57Z" fill="#111216" stroke="#55575d" strokeWidth="4" />
      <path d="M169 277h100v13H175l-6-13ZM635 277h91l-5 13h-91v-13Z" fill="url(#car-wing)" />
      <path d="M181 258h-57l-16 15v9h84l-11-24ZM682 257h57l17 16v9h-85l11-25Z" fill="#d7d8da" />
      <path d="M278 263c27-18 63-28 105-33l53-45c16-14 35-21 58-21h43c20 0 40 8 55 21l40 36 83 22 46 25v15H255v-8l23-12Z" fill="url(#car-body)" stroke="#ff615c" strokeWidth="3" />
      <path d="m419 229 30-36c11-13 24-20 43-20h31c16 0 29 5 41 16l42 40-112-9-75 9Z" fill="#141519" stroke="#777a80" strokeWidth="4" />
      <path d="M450 193c19-8 37-10 57-8l-12 37h-79l34-29Z" fill="#272a30" />
      <path d="M497 184c14-3 28-2 42 4l29 24-71 7 12-35Z" fill="#0d0e11" />
      <path d="M487 189c1-22 11-33 31-33 20 0 31 12 33 34" stroke="#c9cbd0" strokeLinecap="round" strokeWidth="7" />
      <path d="m351 235 28-6-17 34h-34l23-28ZM599 234l31 5 27 24h-42l-16-29Z" fill="#f1f1f1" opacity=".9" />
      <path d="m462 250 39-9 35 10-31 8-43-9Z" fill="#f8f8f8" opacity=".92" />
      <path d="m238 268 72-11 34 14-92 10-14-13ZM634 270l31-15 73 12-15 14-89-11Z" fill="#a80b0b" />
      <path d="M150 292c14-7 37-8 51-3l15 55h-74l8-52ZM675 289c15-6 39-5 53 3l7 52h-75l15-55Z" fill="url(#tire)" stroke="#565960" strokeWidth="5" />
      <path d="M169 301v37m15-42 10 41m500-36v37m-16-42-10 41" stroke="#858890" strokeWidth="3" />
      <path d="M276 267h35m338 0h35" stroke="#fff" strokeLinecap="round" strokeWidth="4" opacity=".8" />
      <path d="m286 304 30-7m290 8 30 7" stroke="#ffb4b1" strokeLinecap="round" strokeWidth="4" opacity=".6" />
      <path d="m101 302-50 9m59 5-65 12m741-19 53 6m-59 8 71 12" stroke="#e10600" strokeLinecap="round" strokeWidth="3" opacity=".65" />
    </svg>
  );
}

export function FormulaOneShowcase({ href = "/f1" }: { href?: string }) {
  const reduceMotion = useReducedMotion();

  return (
    <section className="f1-showcase relative isolate overflow-hidden bg-[#090a0c] text-white" aria-labelledby="f1-title">
      <div aria-hidden="true" className="f1-grid absolute inset-0 -z-20" />
      <div aria-hidden="true" className="f1-red-glow absolute -right-36 top-[-10rem] -z-10 h-[34rem] w-[34rem] rounded-full" />
      <div aria-hidden="true" className="f1-track absolute -right-28 top-1/2 -z-10 hidden h-[38rem] w-[38rem] -translate-y-1/2 rounded-full border border-white/[.08] lg:block" />
      <div aria-hidden="true" className="f1-track f1-track-inner absolute -right-8 top-1/2 -z-10 hidden h-[27rem] w-[27rem] -translate-y-1/2 rounded-full border border-white/[.06] lg:block" />

      <div className="mx-auto max-w-7xl px-5 py-16 sm:py-20 lg:px-8 lg:py-28">
        <div className="grid items-center gap-10 lg:grid-cols-[.82fr_1.18fr] lg:gap-8">
          <motion.div
            initial={reduceMotion ? false : { opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: reduceMotion ? 0 : 0.65, ease: [0.2, 0.7, 0.25, 1] }}
            className="relative z-10"
          >
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[.04] px-3 py-2 text-[9px] font-black uppercase tracking-[.22em] text-white/65 sm:text-[10px]">
              <span className="relative flex h-2 w-2"><span className="f1-live-pulse absolute inline-flex h-full w-full rounded-full bg-[#e10600] opacity-70" /><span className="relative inline-flex h-2 w-2 rounded-full bg-[#ff3933]" /></span>
              Universo motorsport <span className="text-white/25">/</span> Fórmula 1
            </div>

            <p className="mb-3 flex items-center gap-2 text-[10px] font-black uppercase tracking-[.3em] text-[#ff5550]">
              <span className="h-px w-7 bg-[#e10600]" /> Paixão em alta rotação
            </p>
            <h2 id="f1-title" className="max-w-full text-[clamp(2.75rem,7.2vw,5.75rem)] font-black uppercase leading-[.96] tracking-[-.025em]">
              Sinta a <span className="f1-title-outline block whitespace-nowrap text-transparent">velocidade.</span>
            </h2>
            <p className="mt-6 max-w-md text-sm leading-6 text-white/60 sm:text-base sm:leading-7">
              O rugido antes da largada. A precisão em cada curva. Uma homenagem a quem vive o esporte no limite.
            </p>

            <Link
              href={href}
              className="f1-cta mt-8 inline-flex min-h-12 items-center gap-5 rounded-sm bg-[#e10600] px-5 py-3 text-[10px] font-black uppercase tracking-[.14em] text-white transition duration-300 hover:bg-[#ff2019] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#ff514b]"
            >
              Explorar coleção F1 <ArrowUpRight size={15} strokeWidth={2.5} />
            </Link>

            <div className="mt-10 flex max-w-md items-center gap-5 border-t border-white/10 pt-5">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-white/10 bg-white/[.04] text-[#ff514b]"><Flag size={16} /></div>
              <p className="text-[9px] font-bold uppercase leading-5 tracking-[.18em] text-white/45 sm:text-[10px]">
                Do primeiro sinal verde<br /><span className="text-white/75">até a bandeirada final</span>
              </p>
              <MoveUpRight className="ml-auto text-white/30" size={16} />
            </div>
          </motion.div>

          <motion.div
            initial={reduceMotion ? false : { opacity: 0, x: 28, scale: .97 }}
            whileInView={{ opacity: 1, x: 0, scale: 1 }}
            viewport={{ once: true, amount: 0.18 }}
            transition={{ duration: reduceMotion ? 0 : .85, delay: reduceMotion ? 0 : .12, ease: [0.2, 0.7, 0.25, 1] }}
            className="relative mx-auto aspect-[1.2/1] w-full max-w-[680px]"
          >
            <div className="f1-visual-panel absolute inset-0 overflow-hidden rounded-sm border border-white/[.09] bg-[#111215]">
              <div aria-hidden="true" className="f1-panel-grid absolute inset-0 opacity-60" />
              <div aria-hidden="true" className="f1-light-streak absolute left-[-15%] top-[38%] h-px w-[82%] rotate-[-13deg] bg-gradient-to-r from-transparent via-[#ff3933]/70 to-transparent" />
              <div aria-hidden="true" className="f1-light-streak f1-light-streak-two absolute left-[4%] top-[47%] h-px w-[66%] rotate-[-13deg] bg-gradient-to-r from-transparent via-white/30 to-transparent" />
              <div aria-hidden="true" className="absolute inset-x-0 bottom-0 h-[38%] bg-gradient-to-t from-black/80 to-transparent" />
              <div className="absolute left-5 top-5 flex items-center gap-2 text-[8px] font-black uppercase tracking-[.2em] text-white/45 sm:left-7 sm:top-7 sm:text-[9px]">
                <Gauge size={13} className="text-[#ff3933]" /> Motorsport editorial <span className="text-white/20">—</span> 01
              </div>
              <span aria-hidden="true" className="f1-visual-word absolute right-[-.04em] top-[15%] select-none text-[clamp(6rem,19vw,15rem)] font-black italic leading-none tracking-[-.11em] text-white/[.035]">F1</span>
              <motion.div
                aria-hidden="true"
                className="absolute inset-x-0 bottom-[10%] h-[72%]"
                animate={reduceMotion ? undefined : { y: [0, -5, 0] }}
                transition={reduceMotion ? undefined : { duration: 5, ease: "easeInOut", repeat: Infinity }}
              >
                <RacingCarArtwork />
              </motion.div>
              <div className="absolute bottom-4 left-5 right-5 flex items-end justify-between border-t border-white/10 pt-3 sm:bottom-6 sm:left-7 sm:right-7 sm:pt-4">
                <div><p className="text-[8px] font-bold uppercase tracking-[.24em] text-white/35">A emoção da corrida</p><p className="mt-1 text-xs font-black uppercase tracking-[.1em] sm:text-sm">Na linha de largada</p></div>
                <span className="f1-signal h-1 w-12 bg-[#e10600] sm:w-16" />
              </div>
            </div>
            <div aria-hidden="true" className="absolute -bottom-3 -right-3 -z-10 h-full w-full border border-[#e10600]/50" />
            <span aria-hidden="true" className="absolute -right-2 top-8 h-12 w-[3px] bg-[#e10600] sm:-right-4 sm:top-12 sm:h-16" />
          </motion.div>
        </div>
      </div>
      <div aria-hidden="true" className="f1-bottom-ribbon h-1 w-full" />
    </section>
  );
}
