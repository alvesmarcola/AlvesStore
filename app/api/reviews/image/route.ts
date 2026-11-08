import { NextResponse } from "next/server";
import { describeSupabaseError, getSupabaseOrdersClient } from "@/lib/server/supabase-orders";
import { ADMIN_PRIVATE_HEADERS, getAdminRole } from "@/lib/server/admin-auth";

export const runtime = "nodejs";

const SAFE_FILENAME_REGEX = /^[a-f0-9-]+\.(webp|jpg|jpeg|png)$/i;

const MIME_MAP: Record<string, string> = {
  webp: "image/webp",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
};

export async function GET(request: Request) {
  const url = new URL(request.url);
  const path = url.searchParams.get("path")?.trim() || "";

  if (!path || !SAFE_FILENAME_REGEX.test(path)) {
    return new NextResponse("Caminho de imagem inválido.", {
      status: 400,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  const ext = path.split(".").pop()?.toLowerCase() || "webp";
  const contentType = MIME_MAP[ext] || "image/webp";

  try {
    const supabase = getSupabaseOrdersClient();

    // 1. Verificar se a imagem pertence a uma avaliação aprovada
    const { data: approvedReview, error: dbError } = await supabase
      .from("avaliacoes")
      .select("id,status")
      .eq("imagem_path", path)
      .eq("status", "approved")
      .maybeSingle();

    if (dbError) {
      console.error("Falha ao checar status da avaliação para a imagem:", describeSupabaseError(dbError));
      return new NextResponse("Erro interno ao validar imagem.", { status: 500 });
    }

    // 2. Se a avaliação estiver aprovada, serve publicamente com cache seguro
    if (approvedReview) {
      const { data: fileBlob, error: downloadError } = await supabase.storage
        .from("avaliacoes")
        .download(path);

      if (downloadError || !fileBlob) {
        return new NextResponse("Imagem não encontrada.", { status: 404 });
      }

      const buffer = await fileBlob.arrayBuffer();
      return new NextResponse(buffer, {
        status: 200,
        headers: {
          "Content-Type": contentType,
          "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
          "X-Content-Type-Options": "nosniff",
        },
      });
    }

    // 3. Se NÃO estiver aprovada, somente usuário com papel administrativo pode visualizar (prévia de moderação)
    const isAdmin = getAdminRole(request) !== null;
    if (isAdmin) {
      const { data: fileBlob, error: downloadError } = await supabase.storage
        .from("avaliacoes")
        .download(path);

      if (downloadError || !fileBlob) {
        return new NextResponse("Imagem não encontrada.", { status: 404 });
      }

      const buffer = await fileBlob.arrayBuffer();
      return new NextResponse(buffer, {
        status: 200,
        headers: {
          "Content-Type": contentType,
          "X-Content-Type-Options": "nosniff",
          ...ADMIN_PRIVATE_HEADERS,
        },
      });
    }

    // 4. Bloqueio restrito para qualquer outro cliente (protege privacidade de avaliações pendentes/rejeitadas)
    return new NextResponse("Imagem não encontrada.", {
      status: 404,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Exceção ao servir imagem de avaliação:", describeSupabaseError(error));
    return new NextResponse("Não foi possível carregar a imagem.", { status: 500 });
  }
}
