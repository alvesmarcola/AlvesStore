import { SITE_NAME } from "@/lib/site";

export interface InstagramPost {
  id: string;
  caption?: string;
  media_type?: "IMAGE" | "VIDEO" | "CAROUSEL_ALBUM";
  media_url: string;
  permalink: string;
  thumbnail_url?: string;
  timestamp?: string;
}

export const INSTAGRAM_PROFILE_URL = "https://www.instagram.com/imports_alvess/";
export const INSTAGRAM_HANDLE = "@imports_alvess";

export const FALLBACK_INSTAGRAM_POSTS: InstagramPost[] = [
  {
    id: "fallback-flamengo-25-26",
    caption: `Manto titular 25/26 com acabamento premium e tecnologia de respirabilidade. Garanta já o seu na ${SITE_NAME}! 🔥⚽`,
    media_type: "IMAGE",
    media_url: "/otimizadas/camisa-jogador-brasileirao-flamengo-25-26/01-800.webp",
    permalink: INSTAGRAM_PROFILE_URL,
    timestamp: "2026-03-20T14:00:00Z",
  },
  {
    id: "fallback-corinthians-25-26",
    caption: "Detalhes de alto padrão: caimento atlético, costuras reforçadas e tecido ultra-leve. Qualidade tailandesa 1:1 impecável. 🚀",
    media_type: "IMAGE",
    media_url: "/otimizadas/camisa-jogador-brasileirao-corinthians-25-26/01-800.webp",
    permalink: INSTAGRAM_PROFILE_URL,
    timestamp: "2026-03-18T18:30:00Z",
  },
  {
    id: "fallback-palmeiras-25-26",
    caption: "Edição especial disponível na loja. Peças selecionadas para os verdadeiros apaixonados pelo futebol. 🏆",
    media_type: "IMAGE",
    media_url: "/otimizadas/camisa-jogador-brasileirao-palmeiras-25-26/01-800.webp",
    permalink: INSTAGRAM_PROFILE_URL,
    timestamp: "2026-03-15T12:15:00Z",
  },
  {
    id: "fallback-botafogo-24-25",
    caption: "Manto tradicional com detalhes texturizados. Enviamos para todo o Brasil com código de rastreamento! 📦✨",
    media_type: "IMAGE",
    media_url: "/otimizadas/camisa-jogador-brasileirao-botafogo-24-25/01-800.webp",
    permalink: INSTAGRAM_PROFILE_URL,
    timestamp: "2026-03-12T16:45:00Z",
  },
  {
    id: "fallback-atletico-mineiro-26-27",
    caption: "Versão jogador com caimento justo e máxima ventilação para seu estilo dentro e fora dos estádios. ⚡",
    media_type: "IMAGE",
    media_url: "/otimizadas/camisa-jogador-brasileirao-atletico-mineiro-26-27/01-800.webp",
    permalink: INSTAGRAM_PROFILE_URL,
    timestamp: "2026-03-09T20:00:00Z",
  },
  {
    id: "fallback-fluminense-26-27",
    caption: "Vista as cores da sua torcida com orgulho. Acompanhe nossos stories e lançamentos por aqui! 🥇",
    media_type: "IMAGE",
    media_url: "/otimizadas/camisa-jogador-brasileirao-fluminense-26-27/01-800.webp",
    permalink: INSTAGRAM_PROFILE_URL,
    timestamp: "2026-03-05T15:20:00Z",
  },
];

export interface InstagramFeedResponse {
  posts: InstagramPost[];
  isLive: boolean;
  error?: string;
}

/**
 * Busca os posts mais recentes do Instagram através da Instagram Graph API.
 * Se INSTAGRAM_ACCESS_TOKEN não estiver configurado, retorna posts de fallback elegantes da loja.
 */
export async function getInstagramFeed(limit = 6): Promise<InstagramFeedResponse> {
  const token = process.env.INSTAGRAM_ACCESS_TOKEN?.trim();
  const userId = process.env.INSTAGRAM_USER_ID?.trim();

  // Sem token configurado: retorna fallback local sem quebrar a interface
  if (!token) {
    return {
      posts: FALLBACK_INSTAGRAM_POSTS.slice(0, limit),
      isLive: false,
    };
  }

  try {
    const baseUrl = userId
      ? `https://graph.instagram.com/${userId}/media`
      : `https://graph.instagram.com/me/media`;

    const url = new URL(baseUrl);
    url.searchParams.set("fields", "id,caption,media_type,media_url,permalink,thumbnail_url,timestamp");
    url.searchParams.set("limit", String(Math.max(limit, 6)));

    const res = await fetch(url.toString(), {
      next: { revalidate: 3600 }, // Cache de 1 hora
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      console.warn(`[Instagram API] Falha na requisição (HTTP ${res.status}).`);
      return {
        posts: FALLBACK_INSTAGRAM_POSTS.slice(0, limit),
        isLive: false,
        error: `HTTP ${res.status}`,
      };
    }

    const data = (await res.json()) as { data?: unknown[] };
    if (!data || !Array.isArray(data.data) || data.data.length === 0) {
      return {
        posts: FALLBACK_INSTAGRAM_POSTS.slice(0, limit),
        isLive: false,
      };
    }

    const posts: InstagramPost[] = data.data
      .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
      .map((item) => {
        const id = String(item.id ?? Math.random().toString(36));
        const caption = typeof item.caption === "string" ? item.caption : "";
        const mediaType = (item.media_type as InstagramPost["media_type"]) || "IMAGE";
        const mediaUrl = typeof item.media_url === "string" ? item.media_url : "";
        const thumbnailUrl = typeof item.thumbnail_url === "string" ? item.thumbnail_url : undefined;
        const permalink = typeof item.permalink === "string" ? item.permalink : INSTAGRAM_PROFILE_URL;
        const timestamp = typeof item.timestamp === "string" ? item.timestamp : undefined;

        return {
          id,
          caption,
          media_type: mediaType,
          media_url: mediaUrl || thumbnailUrl || "",
          permalink,
          thumbnail_url: thumbnailUrl,
          timestamp,
        };
      })
      .filter((p) => Boolean(p.media_url))
      .slice(0, limit);

    if (posts.length === 0) {
      return {
        posts: FALLBACK_INSTAGRAM_POSTS.slice(0, limit),
        isLive: false,
      };
    }

    return {
      posts,
      isLive: true,
    };
  } catch {
    console.error("[Instagram API] Erro inesperado ao buscar feed.");
    return {
      posts: FALLBACK_INSTAGRAM_POSTS.slice(0, limit),
      isLive: false,
      error: "Feed temporariamente indisponível.",
    };
  }
}
