"use client";

import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Star, Quote, MessageSquarePlus } from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { Avaliacao } from "@/lib/types";
import { AvaliacaoForm } from "@/components/avaliacao-form";

const PAGE_SIZE = 6;

function StarRating({ count }: { count: number }) {
  return (
    <div className="flex gap-0.5" aria-label={`${count} de 5 estrelas`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          size={14}
          className={i < Math.round(count) ? "fill-amber-400 text-amber-400" : "text-zinc-300"}
        />
      ))}
    </div>
  );
}

function formatDate(dateStr?: string) {
  if (!dateStr) return "";
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return "";
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
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [totalCount, setTotalCount] = useState<number | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadInitialReviews() {
      try {
        // Busca dinâmica de avaliações aprovadas ordenadas por created_at desc (lote inicial de 6)
        const { data, count, error } = await supabase
          .from("avaliacoes")
          .select("id, created_at, nome, cidade, nota, comentario, aprovado", { count: "exact" })
          .eq("aprovado", true)
          .order("created_at", { ascending: false })
          .range(0, PAGE_SIZE - 1);

        if (error) {
          console.warn("Aviso ao carregar avaliações do Supabase:", error.message || error);
          return;
        }

        if (isMounted && data) {
          setReviews(data);
          const total = typeof count === "number" ? count : data.length;
          setTotalCount(total);
          setHasMore(data.length < total);
        }
      } catch (err) {
        console.warn("Aviso ao buscar avaliações:", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadInitialReviews();

    return () => {
      isMounted = false;
    };
  }, []);

  async function handleLoadMore() {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);

    try {
      const from = reviews.length;
      const to = from + PAGE_SIZE - 1;

      const { data, count, error } = await supabase
        .from("avaliacoes")
        .select("id, created_at, nome, cidade, nota, comentario, aprovado", { count: "exact" })
        .eq("aprovado", true)
        .order("created_at", { ascending: false })
        .range(from, to);

      if (error) {
        console.warn("Aviso ao carregar mais avaliações:", error.message || error);
        return;
      }

      if (data && data.length > 0) {
        const nextReviews = [...reviews, ...data];
        setReviews(nextReviews);
        const total = typeof count === "number" ? count : (totalCount ?? nextReviews.length);
        setTotalCount(total);
        setHasMore(nextReviews.length < total);
      } else {
        setHasMore(false);
      }
    } catch (err) {
      console.warn("Erro ao carregar mais avaliações:", err);
    } finally {
      setLoadingMore(false);
    }
  }

  const averageRating = reviews.length > 0
    ? (reviews.reduce((sum, r) => sum + (Number(r.nota) || 5), 0) / reviews.length).toFixed(1)
    : null;

  const totalReviewsCount = totalCount ?? reviews.length;

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
          <h2 id="reviews-title" className="mt-2 text-3xl font-black uppercase tracking-tight sm:text-5xl text-zinc-950">
            O que dizem nossos clientes
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-sm text-zinc-600 sm:text-base">
            Depoimentos reais de torcedores que vestem as camisas da Alves Store.
          </p>

          {/* Rating Summary Dinâmico (somente quando há avaliações aprovadas) */}
          {reviews.length > 0 && averageRating && (
            <div className="mt-5 inline-flex items-center gap-3 rounded-full border border-zinc-200 bg-white px-5 py-2 shadow-sm">
              <div className="flex gap-0.5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} size={16} className="fill-amber-400 text-amber-400" />
                ))}
              </div>
              <span className="text-sm font-bold text-zinc-900">{averageRating}</span>
              <span className="text-xs text-zinc-500">
                baseado em {totalReviewsCount} {totalReviewsCount === 1 ? "avaliação real" : "avaliações reais"}
              </span>
            </div>
          )}

          {/* Botão de rolagem para o formulário */}
          <div className="mt-6 flex justify-center">
            <a
              href="#avaliacao-form-section"
              className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-zinc-800 bg-zinc-950 px-5 py-2.5 text-xs font-black uppercase tracking-wider text-white transition hover:bg-zinc-800 hover:border-zinc-700 shadow-sm"
            >
              <MessageSquarePlus size={15} />
              <span>Avaliar minha compra</span>
            </a>
          </div>
        </motion.div>

        {/* Lista de Avaliações */}
        {loading ? (
          /* Skeletons de carregamento inicial */
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <div
                key={n}
                className="flex h-56 flex-col justify-between rounded-xl border border-zinc-200 bg-white p-6 shadow-sm"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <div className="h-5 w-5 rounded bg-zinc-200/70 skeleton-shimmer" />
                    <div className="h-4 w-28 rounded bg-zinc-200/70 skeleton-shimmer" />
                  </div>
                  <div className="mt-5 space-y-2">
                    <div className="h-3 w-full rounded bg-zinc-200/70 skeleton-shimmer" />
                    <div className="h-3 w-4/5 rounded bg-zinc-200/70 skeleton-shimmer" />
                    <div className="h-3 w-2/3 rounded bg-zinc-200/70 skeleton-shimmer" />
                  </div>
                </div>
                <div className="flex items-center gap-3 border-t border-zinc-100 pt-4">
                  <div className="h-9 w-9 rounded-full bg-zinc-200/70 skeleton-shimmer" />
                  <div className="space-y-1.5">
                    <div className="h-3 w-24 rounded bg-zinc-200/70 skeleton-shimmer" />
                    <div className="h-2.5 w-16 rounded bg-zinc-200/70 skeleton-shimmer" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : reviews.length === 0 ? (
          /* Estado Vazio elegante: sem avaliações aprovadas ainda */
          <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-8 text-center sm:p-12 shadow-sm">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-zinc-100 text-zinc-600">
              <Quote size={24} className="text-zinc-500" />
            </div>
            <h3 className="mt-4 text-base font-bold text-zinc-900 sm:text-lg">
              Ainda não há avaliações aprovadas
            </h3>
            <p className="mx-auto mt-1 max-w-md text-xs text-zinc-500 sm:text-sm">
              Comprou na Alves Store? Seja o primeiro a compartilhar sua experiência preenchendo o formulário abaixo!
            </p>
          </div>
        ) : (
          /* Grid de Avaliações Reais do Supabase */
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {reviews.map((testimonial, index) => (
              <motion.article
                key={testimonial.id}
                initial={reducedMotion ? false : { opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.2 }}
                transition={{
                  duration: reducedMotion ? 0 : 0.45,
                  delay: reducedMotion ? 0 : (index % 3) * 0.08,
                }}
                className="group relative flex flex-col justify-between overflow-hidden rounded-xl border border-zinc-200 bg-white p-6 shadow-sm transition hover:border-zinc-400 hover:shadow-md"
              >
                <div>
                  {/* Header do Card: Quote + Estrelas + Data Formatada */}
                  <div className="mb-3 flex items-center justify-between">
                    <Quote size={24} className="text-zinc-300" />
                    <div className="flex items-center gap-2">
                      <StarRating count={testimonial.nota} />
                      {testimonial.created_at && (
                        <span className="text-[11px] font-medium text-zinc-400">
                          {formatDate(testimonial.created_at)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Comentário */}
                  <p className="text-sm leading-6 text-zinc-800">
                    &ldquo;{testimonial.comentario}&rdquo;
                  </p>
                </div>

                {/* Autor: Avatar + Nome + Cidade + Badge */}
                <div className="mt-5 flex items-center gap-3 border-t border-zinc-100 pt-4">
                  <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-zinc-900 text-xs font-black text-white">
                    {testimonial.nome ? testimonial.nome.charAt(0).toUpperCase() : "A"}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-xs font-bold text-zinc-900">{testimonial.nome}</p>
                    <p className="truncate text-[10px] text-zinc-500">{testimonial.cidade}</p>
                  </div>
                  <span className="ml-auto shrink-0 rounded-full bg-green-50 px-2 py-0.5 text-[9px] font-bold text-green-700">
                    ✓ Compra verificada
                  </span>
                </div>
              </motion.article>
            ))}
          </div>
        )}

        {/* Botão Carregar Mais Avaliações (oculto quando não há mais registros) */}
        {hasMore && (
          <div className="mt-10 flex justify-center">
            <button
              type="button"
              onClick={handleLoadMore}
              disabled={loadingMore}
              className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-full border border-zinc-700 bg-zinc-900 px-8 py-3 text-xs font-black uppercase tracking-wider text-white transition hover:bg-zinc-800 hover:border-zinc-600 disabled:cursor-not-allowed disabled:opacity-50 shadow-sm"
            >
              {loadingMore ? (
                <span>Carregando...</span>
              ) : (
                <span>Carregar mais avaliações</span>
              )}
            </button>
          </div>
        )}

        {/* Formulário de Envio de Avaliação */}
        <div id="avaliacao-form-section" className="mt-14 sm:mt-16 pt-10 border-t border-zinc-200">
          <div className="mx-auto max-w-2xl">
            <AvaliacaoForm />
          </div>
        </div>
      </div>
    </section>
  );
}
