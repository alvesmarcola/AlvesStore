"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Star, Quote } from "lucide-react";

interface Testimonial {
  name: string;
  location: string;
  stars: number;
  text: string;
}

const testimonials: Testimonial[] = [
  {
    name: "Rafael S.",
    location: "São Paulo, SP",
    stars: 5,
    text: "Qualidade impressionante! Recebi a camisa do meu time e parece original. Recomendo demais!",
  },
  {
    name: "Camila O.",
    location: "Belo Horizonte, MG",
    stars: 5,
    text: "Fiz a personalização com meu nome e ficou perfeita. O acabamento é impecável, superou as expectativas.",
  },
  {
    name: "Lucas M.",
    location: "Rio de Janeiro, RJ",
    stars: 5,
    text: "Comprei 3 camisas e o frete saiu grátis! Chegou rapidinho e todas vieram muito bem embaladas.",
  },
  {
    name: "Juliana R.",
    location: "Curitiba, PR",
    stars: 5,
    text: "Meu marido amou o presente! A camisa retrô ficou linda e o tecido é super confortável.",
  },
  {
    name: "Anderson P.",
    location: "Recife, PE",
    stars: 5,
    text: "Já é minha terceira compra aqui. Preço justo, qualidade top e atendimento nota 10!",
  },
  {
    name: "Fernanda L.",
    location: "Porto Alegre, RS",
    stars: 5,
    text: "Comprei a camisa da seleção feminina e recebi em menos de uma semana. Material excelente!",
  },
];

function StarRating({ count }: { count: number }) {
  return (
    <div className="flex gap-0.5" aria-label={`${count} de 5 estrelas`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          size={14}
          className={i < count ? "fill-amber-400 text-amber-400" : "text-gray-300"}
        />
      ))}
    </div>
  );
}

export function CustomerReviews() {
  const reducedMotion = useReducedMotion();

  return (
    <section className="bg-[#FAFAFA] py-16 sm:py-20" aria-labelledby="reviews-title">
      <div className="mx-auto max-w-7xl px-5 lg:px-8">
        {/* Header */}
        <motion.div
          initial={reducedMotion ? false : { opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: reducedMotion ? 0 : 0.55 }}
          className="mb-10 text-center sm:mb-14"
        >
          <p className="text-[10px] font-black uppercase tracking-[.2em] text-action sm:text-xs">
            Prova social
          </p>
          <h2 id="reviews-title" className="mt-2 text-3xl font-black uppercase tracking-tight sm:text-5xl">
            O que dizem nossos clientes
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-sm text-muted sm:text-base">
            Milhares de torcedores já vestem a camisa do seu time com a gente. Veja o que estão falando.
          </p>

          {/* Summary rating */}
          <div className="mt-5 inline-flex items-center gap-3 rounded-full border border-border bg-white px-5 py-2 shadow-sm">
            <div className="flex gap-0.5">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star key={i} size={18} className="fill-amber-400 text-amber-400" />
              ))}
            </div>
            <span className="text-sm font-bold text-ink">4.9</span>
            <span className="text-xs text-muted">baseado em +500 avaliações</span>
          </div>
        </motion.div>

        {/* Testimonials grid */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {testimonials.map((testimonial, index) => (
            <motion.article
              key={testimonial.name}
              initial={reducedMotion ? false : { opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: reducedMotion ? 0 : 0.45, delay: reducedMotion ? 0 : (index % 3) * 0.08 }}
              className="group relative overflow-hidden rounded-xl border border-border bg-white p-6 shadow-sm transition hover:border-action/30 hover:shadow-md"
            >
              {/* Quote icon */}
              <Quote size={28} className="mb-3 text-action/20" />

              {/* Stars */}
              <StarRating count={testimonial.stars} />

              {/* Text */}
              <p className="mt-3 text-sm leading-6 text-ink/80">
                &ldquo;{testimonial.text}&rdquo;
              </p>

              {/* Author */}
              <div className="mt-5 flex items-center gap-3 border-t border-border pt-4">
                {/* Avatar placeholder */}
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-action/10 text-xs font-black text-action">
                  {testimonial.name.charAt(0)}
                </div>
                <div>
                  <p className="text-xs font-bold text-ink">{testimonial.name}</p>
                  <p className="text-[10px] text-muted">{testimonial.location}</p>
                </div>
                <span className="ml-auto rounded-full bg-green-50 px-2 py-0.5 text-[9px] font-bold text-green-700">
                  ✓ Compra verificada
                </span>
              </div>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  );
}

