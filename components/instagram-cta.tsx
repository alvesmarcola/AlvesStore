"use client";

import { motion, useReducedMotion } from "framer-motion";

function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect x="2" y="2" width="20" height="20" rx="5" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function InstagramCTA() {
  const reducedMotion = useReducedMotion();

  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-[#833ab4] via-[#fd1d1d] to-[#fcb045] py-16 sm:py-20" aria-label="Instagram">
      {/* Decorative blurred circles */}
      <div aria-hidden="true" className="absolute -left-20 -top-20 h-80 w-80 rounded-full bg-white/10 blur-3xl" />
      <div aria-hidden="true" className="absolute -bottom-20 -right-20 h-72 w-72 rounded-full bg-white/10 blur-3xl" />

      <div className="relative mx-auto max-w-7xl px-5 lg:px-8">
        <motion.div
          initial={reducedMotion ? false : { opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: reducedMotion ? 0 : 0.6, ease: [0.2, 0.7, 0.25, 1] }}
          className="flex flex-col items-center text-center text-white"
        >
          {/* Icon */}
          <motion.div
            className="mb-6 grid h-20 w-20 place-items-center rounded-2xl border border-white/30 bg-white/10 backdrop-blur-md sm:h-24 sm:w-24 sm:rounded-3xl"
            whileHover={reducedMotion ? undefined : { scale: 1.08, rotate: 4 }}
            transition={{ type: "spring", stiffness: 300, damping: 15 }}
          >
            <InstagramIcon className="h-10 w-10 sm:h-12 sm:w-12" />
          </motion.div>

          <p className="text-[10px] font-black uppercase tracking-[.3em] text-white/80 sm:text-xs">
            @alvesstore
          </p>

          <h2 className="mt-4 text-3xl font-black uppercase leading-tight tracking-tight sm:text-5xl">
            Siga-nos no Instagram
          </h2>

          <p className="mt-4 max-w-lg text-sm leading-6 text-white/85 sm:text-base sm:leading-7">
            Acompanhe os bastidores, lançamentos exclusivos e promoções relâmpago.
            Fique por dentro de tudo antes de todo mundo!
          </p>

          {/* CTA Button */}
          <motion.a
            href="https://www.instagram.com/imports_alvess/"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-8 inline-flex items-center gap-3 rounded-full border-2 border-white bg-white px-8 py-4 text-xs font-black uppercase tracking-wider text-[#833ab4] shadow-xl transition-all hover:bg-transparent hover:text-white hover:shadow-2xl sm:text-sm"
            whileHover={reducedMotion ? undefined : { scale: 1.04 }}
            whileTap={reducedMotion ? undefined : { scale: 0.97 }}
          >
            <InstagramIcon className="h-5 w-5" />
            Seguir no Instagram
          </motion.a>

          {/* Mini gallery placeholders */}
          <div className="mt-12 grid w-full max-w-3xl grid-cols-3 gap-2 sm:grid-cols-6 sm:gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <motion.div
                key={i}
                initial={reducedMotion ? false : { opacity: 0, scale: 0.85 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: reducedMotion ? 0 : 0.4, delay: reducedMotion ? 0 : i * 0.06 }}
                className="group relative aspect-square overflow-hidden rounded-lg border border-white/20 bg-white/10 backdrop-blur-sm"
              >
                <div className="absolute inset-0 flex items-center justify-center text-white/30 transition group-hover:text-white/60">
                  <InstagramIcon className="h-6 w-6" />
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}

