"use client";

import React, { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Star, Quote, X } from "lucide-react";
import type { Avaliacao } from "@/lib/types";
import { AvaliacaoForm } from "@/components/avaliacao-form";
import { SITE_NAME } from "@/lib/site";

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

export interface CustomerReviewsProps {
  initialReviews?: {
    reviews: Avaliacao[];
    total?: number;
    average?: number | null;
  };
}

export function CustomerReviews(props: CustomerReviewsProps = {}) {
  const { initialReviews } = props;
  const reducedMotion = useReducedMotion();
  const [reviews, setReviews] = useState<Avaliacao[]>(initialReviews?.reviews ?? []);
  const [loading, setLoading] = useState(!initialReviews);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [totalCount, setTotalCount] = useState<number | null>(initialReviews?.total ?? null);
  const [averageRating, setAverageRating] = useState<number | null>(initialReviews?.average ?? null);
  const [loadError, setLoadError] = useState("");
  const [expandedPhoto, setExpandedPhoto] = useState<{ url: string; name: string } | null>(null);
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!expandedPhoto) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setExpandedPhoto(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [expandedPhoto]);

  useEffect(() => {
    if (initialReviews) return;
    let isMounted = true;

    async function loadInitialReviews() {
      try {
        const response = await fetch("/api/reviews?page=0", { cache: "no-store" });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error ?? "Não foi possível carregar as avaliações.");
        if (isMounted) {
          setReviews(result.reviews as Avaliacao[]);
          setTotalCount(Number(result.total));
          setAverageRating(Number(result.average) || null);
          setHasMore(Boolean(result.hasMore));
        }
      } catch (err) {
        console.warn("Aviso ao buscar avaliações:", err);
        if (isMounted) setLoadError("As avaliações não puderam ser carregadas agora.");
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadInitialReviews();

    return () => {
      isMounted = false;
    };
  }, [initialReviews]);

  async function handleLoadMore() {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);

    try {
      const page = Math.floor(reviews.length / PAGE_SIZE);
      const response = await fetch(`/api/reviews?page=${page}`, { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Não foi possível carregar mais avaliações.");
      const data = result.reviews as Avaliacao[];
      if (data.length > 0) {
        const nextReviews = [...reviews, ...data];
        setReviews(nextReviews);
        setHasMore(Boolean(result.hasMore));
      } else {
        setHasMore(false);
      }
    } catch (err) {
      console.warn("Erro ao carregar mais avaliações:", err);
      setLoadError("Não foi possível carregar mais avaliações. Tente novamente.");
    } finally {
      setLoadingMore(false);
    }
  }

  const totalReviewsCount = (totalCount !== null && totalCount > 0) ? totalCount : reviews.length;
  const derivedAverage = averageRating && averageRating > 0
    ? averageRating
    : reviews.length > 0
    ? reviews.reduce((sum, r) => sum + (Number(r.nota) || 5), 0) / reviews.length
    : null;

  return (
    <section className="bg-[#FAFAFA] py-16 sm:py-20" aria-labelledby="reviews-title">
      <div className="mx-auto max-w-7xl px-5 lg:px-8">
        {/* 1. Sessão de Avaliar Compra (Formulário no topo) */}
        <div id="avaliacao-form-section" className="mb-14 sm:mb-20">
          <div className="mx-auto max-w-2xl">
            <AvaliacaoForm />
          </div>
        </div>

        {/* 2. Sessão de Avaliações (Abaixo da sessão de avaliar) */}
        <div className="border-t border-zinc-200 pt-12 sm:pt-16">
          {/* Header das Avaliações */}
          <motion.div
            initial={reducedMotion ? false : { opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: reducedMotion ? 0 : 0.55 }}
            className="mb-10 text-center sm:mb-14"
          >
            <p className="text-[10px] font-bold uppercase tracking-wider text-action sm:text-xs">
              Prova social
            </p>
            <h2 id="reviews-title" className="mt-2 text-3xl font-bold uppercase tracking-normal sm:text-4xl text-zinc-950">
              O que dizem nossos clientes
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-sm text-zinc-600 sm:text-base">
              Depoimentos reais de torcedores que vestem as camisas da {SITE_NAME}.
            </p>

            {/* Rating Summary Dinâmico (somente quando há avaliações aprovadas) */}
            {reviews.length > 0 && derivedAverage !== null && (
              <div className="mt-5 inline-flex items-center gap-3 rounded-full border border-zinc-200 bg-white px-5 py-2 shadow-sm">
                <div className="flex gap-0.5">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} size={16} className="fill-amber-400 text-amber-400" />
                  ))}
                </div>
                <span className="text-sm font-bold text-zinc-900">{derivedAverage.toFixed(1)}</span>
                <span className="text-xs text-zinc-500">
                  baseado em {totalReviewsCount === 1 ? "1 avaliação real" : `${totalReviewsCount} avaliações reais`}
                </span>
              </div>
            )}
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
          ) : loadError ? (
            <div role="status" className="rounded-2xl border border-red-200 bg-white p-8 text-center text-sm text-red-800 shadow-sm">
              {loadError}
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
                Comprou na {SITE_NAME}? Seja o primeiro a compartilhar sua experiência preenchendo o formulário acima!
              </p>
            </div>
          ) : (
            /* Grid de Avaliações Reais do Supabase */
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {reviews.map((testimonial, index) => (
                <motion.article
                  key={testimonial.id || `${testimonial.nome}-${testimonial.created_at || index}`}
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

                    {/* Foto enviada pelo cliente (opcional) */}
                    {testimonial.imagem_url && !failedImages[testimonial.imagem_url] && (
                      <div className="mt-3.5">
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedPhoto({
                              url: testimonial.imagem_url!,
                              name: testimonial.nome,
                            })
                          }
                          className="group relative block h-16 w-16 overflow-hidden rounded-lg border border-zinc-200 transition hover:border-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-900"
                          aria-label={`Ampliar foto enviada por ${testimonial.nome}`}
                        >
                          <img
                            src={testimonial.imagem_url}
                            alt={`Foto enviada por ${testimonial.nome}`}
                            loading="lazy"
                            width={64}
                            height={64}
                            onError={() => {
                              setFailedImages((prev) => ({ ...prev, [testimonial.imagem_url!]: true }));
                            }}
                            className="h-16 w-16 object-cover transition duration-200 group-hover:scale-105"
                          />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Autor: Avatar + Nome + Cidade + Badge */}
                  <div className="mt-5 flex items-center gap-3 border-t border-zinc-100 pt-4">
                    <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-zinc-900 text-xs font-bold text-white">
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
                className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-full border border-zinc-700 bg-zinc-900 px-8 py-3 text-xs font-bold uppercase tracking-wider text-white transition hover:bg-zinc-800 hover:border-zinc-600 disabled:cursor-not-allowed disabled:opacity-50 shadow-sm"
              >
                {loadingMore ? (
                  <span>Carregando...</span>
                ) : (
                  <span>Carregar mais avaliações</span>
                )}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Lightbox / Modal de ampliação de foto de cliente */}
      {expandedPhoto && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Foto enviada por ${expandedPhoto.name}`}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm"
          onClick={() => setExpandedPhoto(null)}
        >
          <div
            className="relative max-h-[90vh] max-w-[90vw] overflow-hidden rounded-2xl bg-zinc-950 p-2 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setExpandedPhoto(null)}
              className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-zinc-900/90 text-white transition hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-white"
              aria-label="Fechar ampliação"
            >
              <X size={18} />
            </button>
            <img
              src={expandedPhoto.url}
              alt={`Foto enviada por ${expandedPhoto.name}`}
              className="max-h-[82vh] max-w-[85vw] rounded-xl object-contain"
            />
            <p className="mt-2 text-center text-xs text-zinc-300">
              Foto enviada por <strong className="text-white">{expandedPhoto.name}</strong>
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
