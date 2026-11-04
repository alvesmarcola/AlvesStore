import { NextResponse } from "next/server";
import { describeSupabaseError, getSupabaseOrdersClient } from "@/lib/server/supabase-orders";
import { isRateLimited } from "@/lib/server/rate-limit";
import {
  publicReviewsPayload,
  reviewSubmissionSchema,
  sanitizeReviewText,
} from "@/lib/reviews";

export const runtime = "nodejs";

const PAGE_SIZE = 6;
const MAX_PAGE = 100;
const SUBMISSION_LIMIT = 3;
const SUBMISSION_WINDOW_MS = 10 * 60 * 1000;

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const requestedPage = Number(url.searchParams.get("page") ?? 0);
  const page = Number.isInteger(requestedPage) && requestedPage >= 0
    ? Math.min(requestedPage, MAX_PAGE)
    : 0;
  try {
    const supabase = getSupabaseOrdersClient();
    const [{ data, error, count }, { data: summary, error: summaryError }] = await Promise.all([
      supabase.from("avaliacoes")
        .select("created_at,nome,cidade,produto,nota,comentario,status", { count: "exact" })
        .eq("status", "approved")
        .order("created_at", { ascending: false })
        .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1),
      supabase.from("approved_review_summary").select("review_count,average_rating").single(),
    ]);
    if (error) throw error;
    if (summaryError) throw summaryError;
    const total = Number(summary.review_count ?? count ?? data?.length ?? 0);
    const payload = publicReviewsPayload(
      data ?? [],
      total,
      Number(summary.average_rating ?? 0),
      page,
      PAGE_SIZE,
    );
    return NextResponse.json({
      ...payload,
      reviews: payload.reviews.map(({ created_at, nome, cidade, produto, nota, comentario }) => ({
        created_at,
        nome,
        cidade,
        produto,
        nota,
        comentario,
      })),
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Falha ao carregar avaliações públicas:", describeSupabaseError(error));
    return jsonError("Não foi possível carregar as avaliações agora.", 503);
  }
}

export async function POST(request: Request) {
  if (isRateLimited(request, "review-submission", SUBMISSION_LIMIT, SUBMISSION_WINDOW_MS)) {
    return jsonError("Muitas avaliações foram enviadas deste dispositivo. Tente novamente mais tarde.", 429);
  }

  const input = reviewSubmissionSchema.safeParse(await request.json().catch(() => null));
  if (!input.success) return jsonError("Confira os campos. O comentário deve ter de 8 a 500 caracteres e a nota deve ser de 1 a 5.", 400);
  if (input.data.website.trim()) {
    return NextResponse.json({ submitted: true, message: "Sua avaliação foi enviada e aparecerá após aprovação." });
  }

  const review = {
    nome: sanitizeReviewText(input.data.nome).slice(0, 80),
    cidade: sanitizeReviewText(input.data.cidade).slice(0, 80),
    produto: sanitizeReviewText(input.data.produto).slice(0, 120) || "Avaliação geral",
    nota: input.data.nota,
    comentario: sanitizeReviewText(input.data.comentario).slice(0, 500),
    status: "pending" as const,
    aprovado: false,
  };
  if (review.nome.length < 2 || review.cidade.length < 2 || review.comentario.length < 8) {
    return jsonError("Após remover formatação, os campos precisam conter texto válido.", 400);
  }

  try {
    const { error } = await getSupabaseOrdersClient().from("avaliacoes").insert(review);
    if (error) throw error;
    return NextResponse.json({
      submitted: true,
      message: "Sua avaliação foi enviada e aparecerá após aprovação.",
    }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Falha ao receber avaliação:", describeSupabaseError(error));
    return jsonError("Não foi possível enviar sua avaliação agora. Tente novamente mais tarde.", 503);
  }
}
