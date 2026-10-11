"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";

const slides = [
  {
    kicker: "Sua paixão em campo",
    headline: <>VISTA A<br />PAIXÃO.<br /><span className="text-lime">JOGUE JUNTO.</span></>,
    copy: "Camisas para quem leva a torcida no peito. Encontre sua próxima camisa titular.",
    cta: "Escolha seu manto",
    href: "/masculino",
    image: "stadium-night",
    imageAlt: "Estádio iluminado em noite de jogo",
    label: "COLEÇÃO 25/26",
  },
  {
    kicker: "Paixão sem fronteiras",
    headline: <>SUA TORCIDA.<br /><span className="text-lime">O MUNDO TODO.</span></>,
    copy: "Do Brasileirão às grandes ligas: descubra camisas para torcer por cada história.",
    cta: "Explore as ligas",
    href: "/ligas/brasileirao",
    image: "football-stadium",
    imageAlt: "Campo de futebol iluminado",
    label: "LIGAS DO MUNDO",
  },
  {
    kicker: "Histórias que ficam",
    headline: <>O JOGO PASSA.<br /><span className="text-lime">A PAIXÃO FICA.</span></>,
    copy: "Modelos retrô para quem carrega os grandes momentos sempre por perto.",
    cta: "Ver coleção retrô",
    href: "/busca?q=retro",
    image: "football-classic",
    imageAlt: "Coleção esportiva de inspiração clássica",
    label: "CLÁSSICOS RETRÔ",
  },
];

export function HeroCarousel() {
  const [active, setActive] = useState(0);
  const slide = slides[active];
  const move = (direction: number) => setActive((index) => (index + direction + slides.length) % slides.length);
  return <section className="relative isolate overflow-hidden bg-pitch text-white" aria-label="Destaques da loja">
    <div className="absolute inset-0 -z-10 opacity-30"><Image src={`https://picsum.photos/seed/${slide.image}/1800/900`} alt="" fill priority sizes="100vw" className="object-cover" /></div>
    <div className="mx-auto grid min-h-[440px] max-w-7xl items-center gap-8 px-5 py-14 sm:min-h-[500px] sm:grid-cols-2 lg:px-8">
      <div className="max-w-xl"><span className="inline-flex rounded-full bg-lime px-3 py-1.5 text-[10px] font-black uppercase tracking-[.2em] text-ink">{slide.kicker}</span><h1 className="mt-5 text-5xl font-black uppercase leading-[.96] tracking-tight sm:text-6xl lg:text-7xl">{slide.headline}</h1><p className="mt-5 max-w-md text-sm leading-6 text-white/75 sm:text-base">{slide.copy}</p><Link href={slide.href} className="mt-7 inline-flex items-center gap-3 rounded bg-lime px-6 py-3.5 text-xs font-black uppercase tracking-wider text-ink hover:bg-white">{slide.cta} <ArrowRight size={16} /></Link></div>
      <div className="relative mx-auto hidden aspect-[.92] w-full max-w-md sm:block"><Image src={`https://picsum.photos/seed/${slide.image}-feature/680/760`} alt={slide.imageAlt} fill priority sizes="(max-width: 1024px) 45vw, 420px" className="object-cover" /><span className="absolute -bottom-4 -left-4 rounded bg-white px-4 py-3 text-xs font-black text-ink">{slide.label} <span className="ml-2 text-blue-600">EM CAMPO</span></span></div>
    </div>
    <div className="absolute bottom-5 right-5 flex items-center gap-2">
      <button aria-label="Banner anterior" onClick={() => move(-1)} className="grid h-9 w-9 place-items-center rounded-full border border-white/50 hover:bg-white/15"><ChevronLeft size={17} /></button>
      <span className="px-1 text-xs font-bold" aria-live="polite">{active + 1} / {slides.length}</span>
      <button aria-label="Próximo banner" onClick={() => move(1)} className="grid h-9 w-9 place-items-center rounded-full border border-white/50 hover:bg-white/15"><ChevronRight size={17} /></button>
    </div>
  </section>;
}
