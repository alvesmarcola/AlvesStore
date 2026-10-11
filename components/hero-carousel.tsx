"use client";

import Image from "next/image";
import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import { images } from "@/data/images";
import { MagneticLink } from "@/components/motion-effects";

const slides = [
  {
    eyebrow: "Uma nova temporada começa",
    title: ["Vista a", "paixão.", "Jogue junto."],
    accent: 2,
    copy: "Vista a energia do futebol, da arquibancada ao último minuto.",
    cta: "Explore a coleção",
    href: "/masculino",
    label: "ALVES STORE · EM CAMPO",
  },
  {
    eyebrow: "Paixão sem fronteiras",
    title: ["Sua torcida.", "O mundo", "todo."],
    accent: 2,
    copy: "Uma só paixão. Histórias de clubes e seleções de todos os cantos do jogo.",
    cta: "Conheça as ligas",
    href: "/ligas/brasileirao-serie-a",
    label: "LIGAS DO MUNDO",
  },
  {
    eyebrow: "Histórias que ficam",
    title: ["O jogo", "passa.", "A paixão fica."],
    accent: 2,
    copy: "Clássicos inspirados por outras épocas para quem carrega o futebol no peito.",
    cta: "Ver coleção retrô",
    href: "/busca?q=retro",
    label: "CLÁSSICOS RETRÔ",
  },
];

export function HeroCarousel() {
  const [active, setActive] = useState(0);
  const slide = slides[active];
  const reducedMotion = useReducedMotion();
  const move = (direction: number) => setActive((index) => (index + direction + slides.length) % slides.length);
  const hero = images.home.hero;

  return (
    <section className="arena-hero relative isolate overflow-hidden bg-ink text-white" aria-label="Destaques da loja">
      <motion.div
        className="absolute inset-0 -z-20"
        animate={reducedMotion ? undefined : { scale: [1, 1.055] }}
        transition={reducedMotion ? undefined : { duration: 22, ease: "linear", repeat: Infinity, repeatType: "reverse" }}
      >
        <Image
          src={hero.src}
          alt={hero.alt}
          fill
          priority
          sizes="100vw"
          placeholder="blur"
          blurDataURL={hero.blurDataURL}
          className="arena-hero-photo object-cover"
          style={{ objectPosition: `${hero.focalPoint.x}% ${hero.focalPoint.y}%` }}
        />
      </motion.div>
      <div className="arena-hero-shade absolute inset-0 -z-10" />
      <div className="arena-pitch-lines pointer-events-none absolute inset-0 -z-10" aria-hidden="true" />
      <span className="hero-outline pointer-events-none absolute bottom-8 right-[-.06em] -z-10 select-none text-[21vw] font-black uppercase leading-none tracking-tighter text-transparent" aria-hidden="true">EM CAMPO</span>

      <div className="mx-auto flex min-h-[100svh] max-w-7xl flex-col justify-center px-5 pb-24 pt-28 lg:px-8">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={active}
            className="max-w-4xl"
            initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: reducedMotion ? 0 : -10 }}
            transition={{ duration: reducedMotion ? 0 : 0.45, ease: "easeOut" }}
          >
            <span className="inline-flex items-center gap-3 text-[10px] font-black uppercase tracking-[.26em] text-blue-200 sm:text-xs"><span className="h-px w-8 bg-action" />{slide.eyebrow}</span>
            <h1 className="mt-7 max-w-full text-[clamp(3rem,9vw,8.3rem)] font-black uppercase leading-[.88] tracking-[-.055em]">
              <span className="sr-only">{slide.title.join(" ")}</span>
              {slide.title.map((line, index) => (
                <motion.span
                  key={`${active}-${line}`}
                  aria-hidden="true"
                  className={`block ${index === slide.accent ? "text-action" : ""}`}
                  initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 34 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: reducedMotion ? 0 : 0.55, delay: reducedMotion ? 0 : 0.08 + index * 0.11, ease: [0.2, 0.7, 0.25, 1] }}
                >
                  {line}
                </motion.span>
              ))}
            </h1>
            <p className="mt-7 max-w-lg text-sm leading-6 text-white/75 sm:text-base">{slide.copy}</p>
            <MagneticLink href={slide.href} className="magnetic-cta mt-8 inline-flex items-center gap-3 rounded-lg bg-action px-6 py-4 text-xs font-black uppercase tracking-wider text-white transition-colors hover:bg-action-hover">
              {slide.cta}<ArrowRight size={16} />
            </MagneticLink>
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="absolute bottom-7 left-5 flex items-center gap-3 text-[10px] font-black uppercase tracking-[.18em] text-white/60 sm:left-8">
        <span className="h-px w-10 bg-action" />{slide.label}
      </div>
      <div className="absolute bottom-5 right-5 flex items-center gap-2 sm:bottom-7 sm:right-8">
        <button aria-label="Banner anterior" onClick={() => move(-1)} className="hero-control grid h-10 w-10 place-items-center rounded-full border border-white/40 bg-black/20 transition hover:bg-white hover:text-ink"><ChevronLeft size={17} /></button>
        <span className="min-w-12 text-center text-xs font-bold tabular-nums" aria-live="polite">{active + 1} / {slides.length}</span>
        <button aria-label="Próximo banner" onClick={() => move(1)} className="hero-control grid h-10 w-10 place-items-center rounded-full border border-white/40 bg-black/20 transition hover:bg-white hover:text-ink"><ChevronRight size={17} /></button>
      </div>
    </section>
  );
}
