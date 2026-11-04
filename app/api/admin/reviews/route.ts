import { z } from "zod";
import { NextResponse } from "next/server";
import { ADMIN_PRIVATE_HEADERS, getAdminAuthFailure } from "@/lib/server/admin-auth";
import {
  describeSupabaseError,
  getSupabaseOrdersClient,
  SupabaseOrdersConfigurationError,
} from "@/lib/server/supabase-orders";
import { reviewStatusSchema } from "@/lib/reviews";

export const runtime = "nodejs";

const updateSchema = z.object({
  id: z.string().uuid(),
  status: reviewStatusSchema,
}).strict();
const deleteSchema = z.object({ id: z.string().uuid() }).strict();
const statuses = ["pending", "approved", "rejected"] as const;

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, {
    status,
    headers: ADMIN_PRIVATE_HEADERS,
  });
}

function reportFailure(operation: string, error: unknown) {
  const details = describeSupabaseError(error);
  console.error(operation, details);
  return error instanceof SupabaseOrdersConfigurationError
    ? "Supabase não configurado neste ambiente. Verifique as variáveis de ambiente do servidor."
    : undefined;
}

export async function GET(request: Request) {
  const authFailure = getAdminAuthFailure(request);
  if (authFailure) return jsonError(authFailure.message, authFailure.status);
  const requested = new URL(request.url).searchParams.get("status") ?? "pending";
  const parsedStatus = reviewStatusSchema.safeParse(requested);
  if (!parsedStatus.success) return jsonError("Filtro de avaliações inválido.", 400);

  try {
    const supabase = getSupabaseOrdersClient();
    const [reviewsResult, ...countResults] = await Promise.all([
      supabase.from("avaliacoes")
        .select("id,created_at,nome,cidade,produto,nota,comentario,status,moderated_at,moderated_by")
        .eq("status", parsedStatus.data)
        .order("created_at", { ascending: false })
        .limit(200),
      ...statuses.map((status) => supabase.from("avaliacoes")
        .select("id", { count: "exact", head: true })
        .eq("status", status)),
    ]);
    if (reviewsResult.error) throw reviewsResult.error;
    const countError = countResults.find((result) => result.error)?.error;
    if (countError) throw countError;
    const counts = Object.fromEntries(statuses.map((status, index) => [status, countResults[index].count ?? 0]));
    return NextResponse.json({ reviews: reviewsResult.data ?? [], counts }, {
      headers: ADMIN_PRIVATE_HEADERS,
    });
  } catch (error) {
    const configurationError = reportFailure("Falha ao carregar avaliações para moderação:", error);
    return jsonError(configurationError ?? "Não foi possível carregar as avaliações. Verifique a migração de moderação.", 503);
  }
}

export async function PATCH(request: Request) {
  const authFailure = getAdminAuthFailure(request);
  if (authFailure) return jsonError(authFailure.message, authFailure.status);
  const input = updateSchema.safeParse(await request.json().catch(() => null));
  if (!input.success) return jsonError("Informe uma avaliação e um status válido.", 400);
  try {
    const { data, error } = await getSupabaseOrdersClient().from("avaliacoes")
      .update({
        status: input.data.status,
        aprovado: input.data.status === "approved",
        moderated_at: new Date().toISOString(),
        moderated_by: "admin",
      })
      .eq("id", input.data.id)
      .select("id,status,moderated_at,moderated_by")
      .maybeSingle();
    if (error) throw error;
    if (!data) return jsonError("Avaliação não encontrada.", 404);
    return NextResponse.json({ review: data }, { headers: ADMIN_PRIVATE_HEADERS });
  } catch (error) {
    const configurationError = reportFailure("Falha ao moderar avaliação:", error);
    return jsonError(configurationError ?? "Não foi possível atualizar a avaliação.", 503);
  }
}

export async function DELETE(request: Request) {
  const authFailure = getAdminAuthFailure(request);
  if (authFailure) return jsonError(authFailure.message, authFailure.status);
  const input = deleteSchema.safeParse(await request.json().catch(() => null));
  if (!input.success) return jsonError("Informe uma avaliação válida para excluir.", 400);
  try {
    const { data, error } = await getSupabaseOrdersClient().from("avaliacoes")
      .delete()
      .eq("id", input.data.id)
      .select("id")
      .maybeSingle();
    if (error) throw error;
    if (!data) return jsonError("Avaliação não encontrada.", 404);
    return NextResponse.json({ deleted: true }, { headers: ADMIN_PRIVATE_HEADERS });
  } catch (error) {
    const configurationError = reportFailure("Falha ao excluir avaliação:", error);
    return jsonError(configurationError ?? "Não foi possível excluir a avaliação.", 503);
  }
}
