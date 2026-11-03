"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { motion, useReducedMotion } from "framer-motion";
import {
  FALLBACK_INSTAGRAM_POSTS,
  INSTAGRAM_HANDLE,
  INSTAGRAM_PROFILE_URL,
  type InstagramPost,
} from "@/lib/instagram";

function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <rect x="2" y="2" width="20" height="20" rx="5" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="17.5" cy="6.5" r="1.2" fill="currentColor" stroke="none" />
    </svg>
  );
}

function VideoIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M8 5.14v13.72a1 1 0 0 0 1.5.86l11-6.86a1 1 0 0 0 0-1.72l-11-6.86A1 1 0 0 0 8 5.14z" />
    </svg>
  );
}

function AlbumIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <rect x="7" y="3" width="14" height="14" rx="2" />
      <path d="M3 7v12a2 2 0 0 0 2 2h12" />
    </svg>
  );
}

export function InstagramCTA() {
  const reducedMotion = useReducedMotion();
  const [posts, setPosts] = useState<InstagramPost[]>(FALLBACK_INSTAGRAM_POSTS);
  const [failedImages, setFailedImages] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    let isMounted = true;

    async function fetchInstagramFeed() {
      try {
        const res = await fetch("/api/instagram?limit=6", {
          headers: { Accept: "application/json" },
        });

        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }

        const data = await res.json();
        if (isMounted && data?.posts && Array.isArray(data.posts) && data.posts.length > 0) {
          setPosts(data.posts);
        }
      } catch (err) {
        console.warn("[Instagram CTA] Usando feed de fallback:", err);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    fetchInstagramFeed();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleImageError = (postId: string, index: number) => {
    // Caso a URL da CDN expire ou falhe, substitui com imagem local da loja
    const fallback = FALLBACK_INSTAGRAM_POSTS[index % FALLBACK_INSTAGRAM_POSTS.length].media_url;
    setFailedImages((prev) => ({ ...prev, [postId]: fallback }));
  };

  return (
    <section
      className="relative overflow-hidden bg-gradient-to-br from-[#833ab4] via-[#fd1d1d] to-[#fcb045] py-16 sm:py-20"
      aria-label="Instagram da Alves Imports"
    >
      {/* Elementos decorativos de fundo */}
      <div aria-hidden="true" className="pointer-events-none absolute -left-20 -top-20 h-80 w-80 rounded-full bg-white/10 blur-3xl" />
      <div aria-hidden="true" className="pointer-events-none absolute -bottom-20 -right-20 h-72 w-72 rounded-full bg-white/10 blur-3xl" />

      <div className="relative mx-auto max-w-7xl px-5 lg:px-8">
        <motion.div
          initial={reducedMotion ? false : { opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: reducedMotion ? 0 : 0.6, ease: [0.2, 0.7, 0.25, 1] }}
          className="flex flex-col items-center text-center text-white"
        >
          {/* Logo / Ícone clicável direcionando para o perfil oficial */}
          <motion.a
            href={INSTAGRAM_PROFILE_URL}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Visitar perfil oficial da Alves Imports no Instagram (@imports_alvess)"
            className="mb-6 grid h-20 w-20 place-items-center rounded-2xl border border-white/30 bg-white/10 shadow-lg backdrop-blur-md transition-colors hover:border-white/50 hover:bg-white/20 sm:h-24 sm:w-24 sm:rounded-3xl"
            whileHover={reducedMotion ? undefined : { scale: 1.08, rotate: 3 }}
            whileTap={reducedMotion ? undefined : { scale: 0.95 }}
            transition={{ type: "spring", stiffness: 300, damping: 15 }}
          >
            <InstagramIcon className="h-10 w-10 text-white drop-shadow sm:h-12 sm:w-12" />
          </motion.a>

          {/* Handle clicável */}
          <motion.a
            href={INSTAGRAM_PROFILE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-bold uppercase tracking-widest text-white/90 transition-colors hover:text-white hover:underline sm:text-sm"
          >
            {INSTAGRAM_HANDLE}
          </motion.a>

          <h2 className="mt-3 text-3xl font-bold uppercase leading-tight tracking-normal sm:text-4xl">
            Siga-nos no Instagram
          </h2>

          <p className="mt-4 max-w-lg text-sm leading-6 text-white/90 sm:text-base sm:leading-7">
            Acompanhe os bastidores, novidades de lançamentos esportivos e promoções exclusivas.
            Fique por dentro de tudo antes de todo mundo!
          </p>

          {/* Botão de Seguir */}
          <motion.a
            href={INSTAGRAM_PROFILE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-7 inline-flex items-center gap-3 rounded-full border-2 border-white bg-white px-8 py-3.5 text-xs font-bold uppercase tracking-wider text-[#833ab4] shadow-xl transition-all hover:bg-transparent hover:text-white hover:shadow-2xl sm:text-sm"
            whileHover={reducedMotion ? undefined : { scale: 1.04 }}
            whileTap={reducedMotion ? undefined : { scale: 0.97 }}
          >
            <InstagramIcon className="h-5 w-5" />
            Seguir no Instagram
          </motion.a>

          {/* Grid de Publicações Reais:
              - Mobile: estritamente os 3 posts mais recentes (1 linha com 3 colunas compactas)
              - Desktop: os 6 posts mais recentes (6 colunas alinhadas)
          */}
          <div className="mt-12 w-full max-w-5xl">
            <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-6 sm:gap-3.5">
              {posts.slice(0, 6).map((post, i) => {
                const isExtraOnMobile = i >= 3;
                const imageUrl = failedImages[post.id] || post.thumbnail_url || post.media_url;
                const permalink = post.permalink || INSTAGRAM_PROFILE_URL;

                return (
                  <motion.a
                    key={post.id || i}
                    href={permalink}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={
                      post.caption
                        ? `Ver post no Instagram: ${post.caption.slice(0, 60)}`
                        : "Ver post no Instagram da Alves Imports"
                    }
                    initial={reducedMotion ? false : { opacity: 0, scale: 0.9 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    viewport={{ once: true }}
                    transition={{
                      duration: reducedMotion ? 0 : 0.35,
                      delay: reducedMotion ? 0 : i * 0.05,
                    }}
                    className={`group relative aspect-square overflow-hidden rounded-xl border border-white/25 bg-black/20 shadow-md backdrop-blur-sm transition-all duration-300 hover:border-white/70 hover:shadow-xl hover:-translate-y-1 ${
                      isExtraOnMobile ? "hidden sm:block" : "block"
                    }`}
                  >
                    {/* Imagem ou capa real da publicação */}
                    {isLoading ? (
                      <div className="h-full w-full animate-pulse bg-white/20" />
                    ) : (
                      <Image
                        src={imageUrl}
                        alt={post.caption ? post.caption.slice(0, 80) : "Publicação Alves Imports"}
                        fill
                        sizes="(max-width: 640px) 33vw, 16vw"
                        unoptimized
                        className="object-cover transition-transform duration-500 will-change-transform group-hover:scale-110"
                        onError={() => handleImageError(post.id, i)}
                      />
                    )}

                    {/* Indicador de mídia (Vídeo / Carrossel) */}
                    {post.media_type === "VIDEO" && (
                      <div className="absolute right-2 top-2 z-10 rounded-md bg-black/60 p-1 text-white shadow backdrop-blur-sm">
                        <VideoIcon className="h-3.5 w-3.5" />
                      </div>
                    )}
                    {post.media_type === "CAROUSEL_ALBUM" && (
                      <div className="absolute right-2 top-2 z-10 rounded-md bg-black/60 p-1 text-white shadow backdrop-blur-sm">
                        <AlbumIcon className="h-3.5 w-3.5" />
                      </div>
                    )}

                    {/* Overlay com hover discreto no desktop */}
                    <div className="pointer-events-none absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/55 p-2 text-center opacity-0 transition-opacity duration-300 group-hover:opacity-100 sm:pointer-events-auto">
                      <InstagramIcon className="h-6 w-6 text-white drop-shadow" />
                      <span className="mt-1 text-[11px] font-bold uppercase tracking-wider text-white drop-shadow">
                        Ver Post
                      </span>
                    </div>
                  </motion.a>
                );
              })}
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
