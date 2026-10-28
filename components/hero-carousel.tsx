"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
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
    image: "https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=1920&q=80&auto=format&fit=crop",
    imageAlt: "Estádio de futebol lotado com iluminação noturna",
  },
  {
    eyebrow: "Paixão sem fronteiras",
    title: ["Sua torcida.", "O mundo", "todo."],
    accent: 2,
    copy: "Uma só paixão. Histórias de clubes e seleções de todos os cantos do jogo.",
    cta: "Conheça as ligas",
    href: "/ligas/brasileirao-serie-a",
    label: "LIGAS DO MUNDO",
    image: "https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=1920&q=80&auto=format&fit=crop",
    imageAlt: "Torcida vibrante em estádio de futebol",
  },
  {
    eyebrow: "Histórias que ficam",
    title: ["O jogo", "passa.", "A paixão fica."],
    accent: 2,
    copy: "Clássicos inspirados por outras épocas para quem carrega o futebol no peito.",
    cta: "Ver coleção retrô",
    href: "/retro",
    label: "CLÁSSICOS RETRÔ",
    image: "https://images.unsplash.com/photo-1431324155629-1a6deb1dec8d?w=1920&q=80&auto=format&fit=crop",
    imageAlt: "Gramado de futebol com iluminação dramática",
  },
];

const AUTO_PLAY_MS = 6000;

export function HeroCarousel() {
  const [active, setActive] = useState(0);
  const [direction, setDirection] = useState(1);
  const [isPaused, setIsPaused] = useState(false);
  const [mounted, setMounted] = useState(false);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    setMounted(true);
  }, []);

  const move = useCallback(
    (dir: number) => {
      setDirection(dir);
      setActive((index) => (index + dir + slides.length) % slides.length);
    },
    [],
  );

  const goTo = useCallback(
    (index: number) => {
      setDirection(index > active ? 1 : -1);
      setActive(index);
    },
    [active],
  );

  /* Auto-play */
  useEffect(() => {
    if (!mounted || isPaused || reducedMotion) return;
    const timer = setInterval(() => move(1), AUTO_PLAY_MS);
    return () => clearInterval(timer);
  }, [mounted, isPaused, reducedMotion, move]);

  const slide = slides[active];
  const shouldAnimate = mounted && !reducedMotion;

  const slideVariants = {
    enter: (d: number) => ({ opacity: 0, x: d > 0 ? 50 : -50 }),
    center: { opacity: 1, x: 0 },
    exit: (d: number) => ({ opacity: 0, x: d > 0 ? -50 : 50 }),
  };

  return (
    <section
      className="arena-hero relative isolate overflow-hidden bg-ink text-white"
      aria-label="Destaques da loja"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      {/* Background cross-fade per slide */}
      <div className="absolute inset-0 -z-20">
        <AnimatePresence initial={false}>
          <motion.div
            key={`bg-${active}`}
            className="absolute inset-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: shouldAnimate ? 0.7 : 0 }}
          >
            <Image
              src={slide.image}
              alt={slide.imageAlt}
              fill
              priority={active === 0}
              unoptimized={slide.image.startsWith("http")}
              sizes="100vw"
              className="arena-hero-photo object-cover"
              style={{ objectPosition: "center 30%" }}
            />
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="arena-hero-shade absolute inset-0 -z-10" />
      <div className="arena-pitch-lines pointer-events-none absolute inset-0 -z-10" aria-hidden="true" />
      <span className="hero-outline pointer-events-none absolute bottom-8 right-[-.06em] -z-10 select-none text-[21vw] font-black uppercase leading-none tracking-tighter text-transparent" aria-hidden="true">EM CAMPO</span>

      <div className="mx-auto flex min-h-[100svh] max-w-7xl flex-col justify-center px-5 pb-28 pt-28 lg:px-8">
        <AnimatePresence mode="wait" custom={direction} initial={false}>
          <motion.div
            key={active}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: shouldAnimate ? 0.45 : 0, ease: [0.2, 0.7, 0.25, 1] }}
            className="max-w-4xl"
          >
            <span className="inline-flex items-center gap-3 text-[10px] font-black uppercase tracking-[.26em] text-blue-200 sm:text-xs">
              <span className="h-px w-8 bg-action" />
              {slide.eyebrow}
            </span>
            <h1 aria-label={slide.title.join(" ")} className="mt-7 max-w-full text-[clamp(3rem,9vw,8.3rem)] font-black uppercase leading-[.88] tracking-[-.055em]">
              {slide.title.map((line, index) => (
                <motion.span
                  key={`${active}-${line}`}
                  aria-hidden="true"
                  className={`block ${index === slide.accent ? "text-action" : ""}`}
                  initial={shouldAnimate ? { opacity: 0, y: 28 } : false}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: shouldAnimate ? 0.5 : 0, delay: shouldAnimate ? 0.06 + index * 0.09 : 0, ease: [0.2, 0.7, 0.25, 1] }}
                >
                  {line}
                </motion.span>
              ))}
            </h1>
            <p className="mt-7 max-w-lg text-sm leading-6 text-white/75 sm:text-base">{slide.copy}</p>
            <MagneticLink href={slide.href} className="magnetic-cta mt-8 inline-flex items-center gap-3 rounded-lg bg-action px-6 py-4 text-xs font-black uppercase tracking-wider text-white transition-colors hover:bg-action-hover">
              {slide.cta}
              <ArrowRight size={16} />
            </MagneticLink>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Label bottom-left */}
      <div className="absolute bottom-7 left-5 flex items-center gap-3 text-[10px] font-black uppercase tracking-[.18em] text-white/60 sm:left-8">
        <span className="h-px w-10 bg-action" />
        {slide.label}
      </div>

      {/* Controls bottom-right: arrows + dots */}
      <div className="absolute bottom-5 right-5 flex items-center gap-3 sm:bottom-7 sm:right-8">
        {/* Dots */}
        <div className="flex items-center gap-2">
          {slides.map((_, index) => (
            <button
              key={index}
              onClick={() => goTo(index)}
              aria-label={`Ir para slide ${index + 1}`}
              className="group relative flex h-6 w-6 items-center justify-center"
            >
              <span
                className={`block rounded-full transition-all duration-300 ${
                  index === active
                    ? "h-2.5 w-2.5 bg-action shadow-[0_0_8px_rgba(37,99,235,.5)]"
                    : "h-2 w-2 bg-white/40 group-hover:bg-white/70"
                }`}
              />
              {/* Progress ring for active dot */}
              {mounted && index === active && !isPaused && !reducedMotion && (
                <svg className="absolute inset-0 h-6 w-6 -rotate-90 pointer-events-none" viewBox="0 0 24 24">
                  <circle
                    cx="12"
                    cy="12"
                    r="10"
                    fill="none"
                    stroke="rgba(37,99,235,.4)"
                    strokeWidth="1.5"
                    strokeDasharray="62.83"
                    strokeDashoffset="0"
                    className="hero-dot-progress"
                    style={{ animation: `hero-dot-fill ${AUTO_PLAY_MS}ms linear forwards` }}
                  />
                </svg>
              )}
            </button>
          ))}
        </div>

        {/* Arrow buttons */}
        <button aria-label="Banner anterior" onClick={() => move(-1)} className="hero-control grid h-10 w-10 place-items-center rounded-full border border-white/25 bg-black/30 backdrop-blur-sm transition hover:bg-white hover:text-ink">
          <ChevronLeft size={17} />
        </button>
        <button aria-label="Próximo banner" onClick={() => move(1)} className="hero-control grid h-10 w-10 place-items-center rounded-full border border-white/25 bg-black/30 backdrop-blur-sm transition hover:bg-white hover:text-ink">
          <ChevronRight size={17} />
        </button>
      </div>
    </section>
  );
}
