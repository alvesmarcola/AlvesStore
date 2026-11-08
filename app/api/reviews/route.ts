import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { describeSupabaseError, getSupabaseOrdersClient } from "@/lib/server/supabase-orders";
import { isRateLimited } from "@/lib/server/rate-limit";
import {
  publicReviewsPayload,
  reviewSubmissionSchema,
  sanitizeReviewText,
} from "@/lib/reviews";
import { validateReviewImage } from "@/lib/server/image-upload-validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const PAGE_SIZE = 6;
const MAX_PAGE = 100;
const SUBMISSION_LIMIT = 3;
const SUBMISSION_WINDOW_MS = 10 * 60 * 1000;

interface ReviewRow {
  id?: string | null;
  created_at: string | null;
  nome: string | null;
  cidade: string | null;
  produto: string | null;
  nota: number | null;
  comentario: string | null;
  imagem_path: string | null;
}

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

/**
 * Validação de ambiente/credenciais na inicialização da rota.
 * Aceita tanto chaves JWT legadas (iniciadas com "eyJ...") quanto o novo formato
 * do Supabase (iniciadas com "sb_secret_...").
 * Só reprova se a variável de ambiente estiver vazia ou ausente.
 * Registra no log aviso claro com o formato detectado, sem expor o segredo.
 */
function checkServiceRoleConfigured(): { ok: boolean; reason?: string; format?: string } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
    || process.env.SUPABASE_SECRET_KEY?.trim()
    || process.env.SUPABASE_SERVICE_KEY?.trim()
    || process.env.SUPABASE_ROLE_KEY?.trim();

  if (!url) {
    return {
      ok: false,
      reason: "Variável NEXT_PUBLIC_SUPABASE_URL (ou SUPABASE_URL) ausente ou vazia no ambiente.",
    };
  }
  if (!key) {
    return {
      ok: false,
      reason: "Variável SUPABASE_SERVICE_ROLE_KEY (ou SUPABASE_SECRET_KEY) ausente ou vazia no ambiente.",
    };
  }

  // Identificação do formato da chave para auditoria
  const format = key.startsWith("sb_secret_")
    ? "novo (sb_secret_...)"
    : key.startsWith("eyJ")
    ? "JWT legado (eyJ...)"
    : "personalizado";

  return { ok: true, format };
}

/**
 * Diferencia as causas internas de falha no Supabase Storage.
 */
function diagnoseStorageError(error: unknown): string {
  if (!error || typeof error !== "object") return String(error);
  const err = error as { message?: string; statusCode?: string | number; error?: string; status?: number };
  const msg = (err.message || err.error || "").toLowerCase();
  const code = String(err.statusCode || err.status || "");

  if (code === "404" || msg.includes("bucket not found") || msg.includes("not found")) {
    return `[CAUSA: BUCKET_INEXISTENTE] O bucket 'avaliacoes' não existe no Supabase Storage. Certifique-se de executar a migração 20261107000001_review_photos_storage.sql no Supabase. Detalhe: ${err.message || err.error}`;
  }
  if (code === "401" || code === "403" || msg.includes("unauthorized") || msg.includes("row-level security")) {
    return `[CAUSA: PERMISSAO_STORAGE] Permissão negada no Supabase Storage. Confirme se a chave configurada no servidor é a service_role (chaves públicas 'anon' não têm escrita no bucket privado). Detalhe: ${err.message || err.error}`;
  }
  if (code === "413" || msg.includes("payload too large") || msg.includes("too large")) {
    return `[CAUSA: LIMITE_TAMANHO_STORAGE] O arquivo excede o limite 'file_size_limit' configurado no bucket 'avaliacoes'. Detalhe: ${err.message || err.error}`;
  }
  return `[CAUSA: STORAGE_OUTRO] statusCode=${code || "N/A"}, mensagem="${err.message || err.error || "sem detalhe"}"`;
}

/**
 * Diferencia as causas internas de falha na inserção no banco de dados.
 */
function diagnoseDatabaseError(error: unknown): string {
  if (!error || typeof error !== "object") return String(error);
  const err = error as { message?: string; code?: string; details?: string; hint?: string };
  const msg = err.message || "";
  const code = err.code || "";

  if (code === "42703" || msg.includes("imagem_path")) {
    return `[CAUSA: COLUNA_INEXISTENTE] A coluna 'imagem_path' não existe na tabela 'avaliacoes'. Execute a migração 20261107000001_review_photos_storage.sql no Supabase. Detalhe: ${msg}`;
  }
  if (code === "42P01" || (msg.includes("relation") && msg.includes("does not exist"))) {
    return `[CAUSA: TABELA_INEXISTENTE] A tabela 'avaliacoes' não foi encontrada no banco de dados. Detalhe: ${msg}`;
  }
  return `[CAUSA: BANCO_OUTRO] code=${code || "N/A"}, mensagem="${msg}"${err.details ? `, details="${err.details}"` : ""}`;
}

export async function GET(request: Request) {
  const serviceCheck = checkServiceRoleConfigured();
  if (!serviceCheck.ok) {
    console.error(`[Reviews API - GET 503] Falha na inicialização do serviço: ${serviceCheck.reason}`);
    return jsonError("Não foi possível carregar as avaliações agora.", 503);
  }

  const url = new URL(request.url);
  const requestedPage = Number(url.searchParams.get("page") ?? 0);
  const page = Number.isInteger(requestedPage) && requestedPage >= 0
    ? Math.min(requestedPage, MAX_PAGE)
    : 0;

  try {
    const supabase = getSupabaseOrdersClient();
    const [{ data, error, count }, summaryRes] = await Promise.all([
      supabase.from("avaliacoes")
        .select("id,created_at,nome,cidade,produto,nota,comentario,status,imagem_path", { count: "exact" })
        .eq("status", "approved")
        .order("created_at", { ascending: false })
        .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1),
      supabase.from("approved_review_summary").select("review_count,average_rating").maybeSingle(),
    ]);

    if (error) {
      console.error("[Reviews API - GET 503] Erro na consulta da tabela 'avaliacoes':", {
        mensagem: error.message,
        codigo: error.code,
        detalhes: error.details,
        dica: error.hint,
      });
      throw error;
    }

    if (summaryRes.error) {
      console.warn("[Reviews API - GET Aviso] Falha ao consultar view 'approved_review_summary' (usando contagem fallback):", {
        mensagem: summaryRes.error.message,
        codigo: summaryRes.error.code,
      });
    }

    const summary = summaryRes.data;
    const total = Number(summary?.review_count ?? count ?? data?.length ?? 0);
    const average = Number(summary?.average_rating ?? 0);

    const payload = publicReviewsPayload(
      data ?? [],
      total,
      average,
      page,
      PAGE_SIZE,
    );
    return NextResponse.json({
      ...payload,
      reviews: payload.reviews.map(({ id, created_at, nome, cidade, produto, nota, comentario, imagem_path }: ReviewRow) => ({
        id: id || `${nome}-${created_at}`,
        created_at,
        nome,
        cidade,
        produto,
        nota,
        comentario,
        imagem_path: imagem_path || null,
        imagem_url: imagem_path ? `/api/reviews/image?path=${encodeURIComponent(imagem_path)}` : null,
      })),
    }, {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        Pragma: "no-cache",
        Expires: "0",
      },
    });
  } catch (error) {
    const errorDetails = describeSupabaseError(error);
    const reason = error instanceof Error ? error.message : String(error);
    console.error("[Reviews API - GET 503] Motivo exato da falha na busca de avaliações:", {
      motivo: reason,
      detalhes_supabase: errorDetails,
    });
    return jsonError("Não foi possível carregar as avaliações agora.", 503);
  }
}

export async function POST(request: Request) {
  // 1. Verificação clara de credenciais service_role logo na inicialização da rota
  const serviceCheck = checkServiceRoleConfigured();
  if (!serviceCheck.ok) {
    console.error(`[Reviews API - POST Inicialização] Variável de service_role ausente ou inválida: ${serviceCheck.reason}`);
    return jsonError("Serviço de avaliações indisponível no momento devido a configuração do servidor.", 503);
  }

  // 2. Limite de requisições por IP / tempo (rate limit)
  if (isRateLimited(request, "review-submission", SUBMISSION_LIMIT, SUBMISSION_WINDOW_MS)) {
    return jsonError("Muitas avaliações foram enviadas deste dispositivo. Tente novamente mais tarde.", 429);
  }

  const contentType = request.headers.get("content-type") ?? "";
  let rawData: Record<string, unknown> = {};
  let fileToUpload: File | null = null;

  if (contentType.includes("multipart/form-data")) {
    let formData: FormData | null = null;
    try {
      formData = await request.formData();
    } catch (formErr) {
      console.error("[Reviews API - Leitura FormData] Falha ao processar corpo multipart:", formErr);
      return jsonError("Não foi possível ler os dados do formulário enviado.", 400);
    }
    rawData = {
      nome: formData.get("nome"),
      cidade: formData.get("cidade"),
      produto: formData.get("produto") || "Avaliação geral",
      nota: Number(formData.get("nota")),
      comentario: formData.get("comentario"),
      website: formData.get("website") ?? "",
    };
    const photo = formData.get("foto");
    if (photo instanceof File && photo.size > 0) {
      fileToUpload = photo;
    }
  } else {
    rawData = await request.json().catch(() => ({}));
  }

  const input = reviewSubmissionSchema.safeParse(rawData);
  if (!input.success) {
    console.error("[Reviews API - Validação de Campos] Falha de validação dos campos obrigatórios:", {
      erros: input.error.flatten(),
    });
    return jsonError("Confira os campos. O comentário deve ter de 8 a 500 caracteres e a nota deve ser de 1 a 5.", 400);
  }

  // 3. Honeypot anti-bot invisível: simula sucesso silencioso
  if (input.data.website && input.data.website.trim()) {
    return NextResponse.json({ submitted: true, message: "Sua avaliação foi enviada e aparecerá após aprovação." });
  }

  const review: {
    nome: string;
    cidade: string;
    produto: string;
    nota: number;
    comentario: string;
    status: "pending";
    aprovado: boolean;
    imagem_path: string | null;
  } = {
    nome: sanitizeReviewText(input.data.nome).slice(0, 80),
    cidade: sanitizeReviewText(input.data.cidade).slice(0, 80),
    produto: sanitizeReviewText(input.data.produto).slice(0, 120) || "Avaliação geral",
    nota: input.data.nota,
    comentario: sanitizeReviewText(input.data.comentario).slice(0, 500),
    status: "pending",
    aprovado: false,
    imagem_path: null,
  };

  if (review.nome.length < 2 || review.cidade.length < 2 || review.comentario.length < 8) {
    return jsonError("Após remover formatação, os campos precisam conter texto válido.", 400);
  }

  const supabase = getSupabaseOrdersClient();
  let uploadedPath: string | null = null;

  // 4. Processamento da foto opcional
  if (fileToUpload) {
    // 4a. Validação de tipo real (magic bytes) e tamanho máximo após compressão
    const validation = await validateReviewImage(fileToUpload);
    if (!validation.valid || !validation.extension) {
      console.error("[Reviews API - Validação de Foto]", {
        etapa: "validacao_foto",
        motivo: validation.error,
        tamanho_recebido_bytes: fileToUpload.size,
        tipo_mime_declarado: fileToUpload.type,
      });
      return jsonError(
        validation.error || "A foto enviada é inválida. Use JPG, PNG ou WebP com até 500 KB após compressão.",
        400,
      );
    }

    const randomName = `${randomUUID()}.${validation.extension}`;
    try {
      // 4b. Upload no Storage via service_role privada
      const { error: uploadError } = await supabase.storage.from("avaliacoes").upload(randomName, fileToUpload, {
        contentType: fileToUpload.type,
        cacheControl: "31536000",
        upsert: false,
      });

      if (uploadError) {
        const diag = diagnoseStorageError(uploadError);
        console.error(`[Reviews API - Etapa: Upload Storage] ${diag}`, {
          etapa: "upload_storage",
          bucket: "avaliacoes",
          arquivo_alvo: randomName,
          tamanho_bytes: fileToUpload.size,
          tipo: fileToUpload.type,
          detalhe_supabase: describeSupabaseError(uploadError),
        });

        // Para o cliente: mensagem amigável permitindo enviar sem foto
        return jsonError(
          "Não foi possível salvar a foto enviada. Você pode remover a foto e enviar a avaliação normalmente.",
          400,
        );
      }

      uploadedPath = randomName;
      review.imagem_path = randomName;
    } catch (uploadException) {
      console.error("[Reviews API - Etapa: Upload Storage Exceção]", {
        etapa: "upload_storage_exception",
        erro: uploadException instanceof Error ? uploadException.message : String(uploadException),
      });
      return jsonError(
        "Erro de conexão ao processar a foto. Você pode remover a foto e enviar a avaliação normalmente.",
        400,
      );
    }
  }

  // 5. Inserção no Banco de Dados
  try {
    const { error: dbError } = await supabase.from("avaliacoes").insert(review);
    if (dbError) throw dbError;

    return NextResponse.json({
      submitted: true,
      message: "Sua avaliação foi enviada e aparecerá após aprovação.",
    }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const diag = diagnoseDatabaseError(error);
    console.error(`[Reviews API - Etapa: Inserção Banco] ${diag}`, {
      etapa: "database_insert",
      possui_foto: Boolean(review.imagem_path),
      detalhe_supabase: describeSupabaseError(error),
    });

    // Se o banco falhou e havíamos feito upload da foto, fazemos a limpeza imediata da foto órfã
    if (uploadedPath) {
      console.error(`[Reviews API - Etapa: Limpeza Foto Órfã] Removendo ${uploadedPath} após falha na inserção no banco.`);
      await supabase.storage.from("avaliacoes").remove([uploadedPath]).catch((cleanupErr) => {
        console.error("[Reviews API - Falha Limpeza Foto Órfã]", describeSupabaseError(cleanupErr));
      });
    }

    return jsonError("Não foi possível enviar sua avaliação agora. Tente novamente mais tarde.", 503);
  }
}
