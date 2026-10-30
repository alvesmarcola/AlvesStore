"use client";

import { useEffect, useState } from "react";
import { motion, useReducedMotion, AnimatePresence } from "framer-motion";
import { Star, Quote, MessageSquarePlus, X } from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { Avaliacao } from "@/lib/types";
import { AvaliacaoForm } from "@/components/avaliacao-form";

const fallbackReviews: Avaliacao[] = [
  {
    id: "fb-1",
    created_at: "2026-10-24T14:30:00Z",
    nome: "Douglas Nienow",
    cidade: "Nova Petrópolis, RS",
    nota: 5,
    comentario: "Qualidade top! Recebi a camisa do meu time e parece original. Recomendo demais!",
    aprovado: true,
  },
  {
    id: "fb-2",
    created_at: "2026-10-22T10:15:00Z",
    nome: "Yuri",
    cidade: "Picada Café, RS",
    nota: 5,
    comentario: "Fiz a personalização com meu nome e ficou top. O acabamento é igual ao original, superou as expectativas.",
    aprovado: true,
  },
  {
    id: "fb-3",
    created_at: "2026-10-19T18:40:00Z",
    nome: "Lucas M.",
    cidade: "Rio de Janeiro, RJ",
    nota: 5,
    comentario: "Comprei 3 camisas e o frete saiu grátis! Chegou rapidinho e todas vieram muito bem embaladas.",
    aprovado: true,
  },
  {
    id: "fb-4",
    created_at: "2026-10-15T09:20:00Z",
    nome: "Juliana R.",
    cidade: "Curitiba, PR",
    nota: 5,
    comentario: "Meu marido amou o presente! A camisa retrô ficou linda e o tecido é super confortável.",
    aprovado: true,
  },
  {
    id: "fb-5",
    created_at: "2026-10-11T16:00:00Z",
    nome: "Anderson P.",
    cidade: "Recife, PE",
    nota: 5,
    comentario: "Já é minha terceira compra aqui. Preço justo, qualidade top e atendimento nota 10!",
    aprovado: true,
  },
  {
    id: "fb-6",
    created_at: "2026-10-08T11:45:00Z",
    nome: "Fernanda L.",
    cidade: "Porto Alegre, RS",
    nota: 5,
    comentario: "Comprei a camisa da seleção feminina e recebi em duas semanas. Material excelente!",
    aprovado: true,
  },
];

function StarRating({ count }: { count: number }) {
  return (
    <div className="flex gap-0.5" aria-label={`${count} de 5 estrelas`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          size={14}
          className={i < Math.round(count) ? "fill-amber-400 text-amber-400" : "text-gray-300"}
        />
      ))}
    </div>
  );
}

function formatDate(dateStr: string) {
  try {
    const date = new Date(dateStr);
    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(date);
  } catch {
    return "";
  }
}

export function CustomerReviews() {
  const reducedMotion = useReducedMotion();
  const [reviews, setReviews] = useState<Avaliacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function loadApprovedReviews() {
      try {
        // Busca dinâmica filtrada estritamente por aprovado = true e ordenada por created_at decrescente
        const { data, error } = await supabase
          .from("avaliacoes")
          .select("id, created_at, nome, cidade, nota, comentario, aprovado")
          .eq("aprovado", true)
          .order("created_at", { ascending: false });

        if (error) {
          console.error("Erro ao carregar avaliações do Supabase:", error);
          return;
        }

        if (isMounted && data && data.length > 0) {
          setReviews(data);
        }
      } catch (err) {
        console.error("Erro ao buscar avaliações:", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadApprovedReviews();

    return () => {
      isMounted = false;
    };
  }, []);

  const displayReviews = reviews.length > 0 ? reviews : fallbackReviews;
  const isDynamic = reviews.length > 0;

  const averageRating = isDynamic
    ? (reviews.reduce((sum, r) => sum + r.nota, 0) / reviews.length).toFixed(1)
    : "4.9";

  const ratingCountText = isDynamic
    ? `baseado em ${reviews.length} ${reviews.length === 1 ? "avaliação real" : "avaliações reais"}`
    : "baseado em +500 avaliações";

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
            <span className="text-sm font-bold text-ink">{averageRating}</span>
            <span className="text-xs text-muted">{ratingCountText}</span>
          </div>

          {/* Botão para abrir/fechar formulário de avaliação */}
          <div className="mt-6 flex justify-center">
            <button
              type="button"
              onClick={() => setShowForm((prev) => !prev)}
              className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-ink bg-ink px-5 py-2.5 text-xs font-black uppercase tracking-wider text-white transition hover:bg-action hover:border-action"
            >
              {showForm ? (
                <>
                  <X size={15} />
                  <span>Fechar formulário</span>
                </>
              ) : (
                <>
                  <MessageSquarePlus size={15} />
                  <span>Avaliar minha compra</span>
                </>
              )}
            </button>
          </div>
        </motion.div>

        {/* Formulário de Avaliação (exibição condicional suave) */}
        <AnimatePresence>
          {showForm && (
            <motion.div
              initial={reducedMotion ? false : { opacity: 0, height: 0, y: -10 }}
              animate={{ opacity: 1, height: "auto", y: 0 }}
              exit={{ opacity: 0, height: 0, y: -10 }}
              transition={{ duration: 0.35, ease: "easeOut" }}
              className="mb-12 overflow-hidden"
            >
              <div className="mx-auto max-w-2xl">
                <AvaliacaoForm />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Testimonials grid */}
        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((n) => (
              <div
                key={n}
                className="flex h-56 flex-col justify-between rounded-xl border border-border bg-white p-6 shadow-sm"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <div className="h-5 w-5 rounded bg-muted/10 skeleton-shimmer" />
                    <div className="h-4 w-28 rounded bg-muted/10 skeleton-shimmer" />
                  </div>
                  <div className="mt-5 space-y-2">
                    <div className="h-3 w-full rounded bg-muted/10 skeleton-shimmer" />
                    <div className="h-3 w-4/5 rounded bg-muted/10 skeleton-shimmer" />
                    <div className="h-3 w-2/3 rounded bg-muted/10 skeleton-shimmer" />
                  </div>
                </div>
                <div className="flex items-center gap-3 border-t border-border pt-4">
                  <div className="h-9 w-9 rounded-full bg-muted/10 skeleton-shimmer" />
                  <div className="space-y-1.5">
                    <div className="h-3 w-24 rounded bg-muted/10 skeleton-shimmer" />
                    <div className="h-2.5 w-16 rounded bg-muted/10 skeleton-shimmer" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {displayReviews.map((testimonial, index) => (
              <motion.article
                key={testimonial.id}
                initial={reducedMotion ? false : { opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.2 }}
                transition={{ duration: reducedMotion ? 0 : 0.45, delay: reducedMotion ? 0 : (index % 3) * 0.08 }}
                className="group relative flex flex-col justify-between overflow-hidden rounded-xl border border-border bg-white p-6 shadow-sm transition hover:border-action/30 hover:shadow-md"
              >
                <div>
                  {/* Header do Card: Quote + Estrelas + Data Formatada */}
                  <div className="mb-3 flex items-center justify-between">
                    <Quote size={24} className="text-action/25" />
                    <div className="flex items-center gap-2">
                      <StarRating count={testimonial.nota} />
                      {testimonial.created_at && (
                        <span className="text-[11px] font-medium text-muted">
                          {formatDate(testimonial.created_at)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Comentário */}
                  <p className="text-sm leading-6 text-ink/80">
                    &ldquo;{testimonial.comentario}&rdquo;
                  </p>
                </div>

                {/* Autor: Avatar + Nome + Cidade + Badge */}
                <div className="mt-5 flex items-center gap-3 border-t border-border pt-4">
                  <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-action/10 text-xs font-black text-action">
                    {testimonial.nome.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-xs font-bold text-ink">{testimonial.nome}</p>
                    <p className="truncate text-[10px] text-muted">{testimonial.cidade}</p>
                  </div>
                  <span className="ml-auto shrink-0 rounded-full bg-green-50 px-2 py-0.5 text-[9px] font-bold text-green-700">
                    ✓ Compra verificada
                  </span>
                </div>
              </motion.article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
