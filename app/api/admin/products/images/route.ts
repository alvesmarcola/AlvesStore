import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { ADMIN_PRIVATE_HEADERS, getAdminAuthFailure } from "@/lib/server/admin-auth";
import {
  describeSupabaseError,
  getSupabaseOrdersClient,
  SupabaseOrdersConfigurationError,
} from "@/lib/server/supabase-orders";
import { isValidProductImage } from "@/lib/server/image-upload-validation";

export const runtime = "nodejs";

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const MAX_FILES = 6;
const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const fileExtensions: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, {
    status,
    headers: ADMIN_PRIVATE_HEADERS,
  });
}

export async function POST(request: Request) {
  const authFailure = getAdminAuthFailure(request);
  if (authFailure) return jsonError(authFailure.message, authFailure.status);
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return jsonError("Não foi possível ler os arquivos enviados.", 400);
  }
  const files = form.getAll("files");
  if (!files.length || files.length > MAX_FILES || files.some((file) => !(file instanceof File))) {
    return jsonError("Selecione entre 1 e 6 fotos válidas.", 400);
  }
  const photos = files as File[];
  if (photos.some((file) => !allowedTypes.has(file.type) || file.size === 0 || file.size > MAX_FILE_SIZE)
    || !(await Promise.all(photos.map(isValidProductImage))).every(Boolean)) {
    return jsonError("Use fotos JPG, PNG ou WebP com até 10 MB cada.", 400);
  }

  const uploadedPaths: string[] = [];
  let supabase: ReturnType<typeof getSupabaseOrdersClient> | undefined;
  try {
    supabase = getSupabaseOrdersClient();
    const productFolder = randomUUID();
    const images = [];
    for (const file of photos) {
      const path = `manual/${productFolder}/${randomUUID()}.${fileExtensions[file.type]}`;
      const { error } = await supabase.storage.from("produtos").upload(path, file, {
        contentType: file.type,
        cacheControl: "31536000",
        upsert: false,
      });
      if (error) throw error;
      uploadedPaths.push(path);
      const { data } = supabase.storage.from("produtos").getPublicUrl(path);
      images.push({ url: data.publicUrl, name: file.name });
    }
    return NextResponse.json({ images }, { headers: ADMIN_PRIVATE_HEADERS });
  } catch (error) {
    if (uploadedPaths.length && supabase) {
      const cleanup = await supabase.storage.from("produtos").remove(uploadedPaths);
      if (cleanup.error) console.error("Falha ao limpar upload incompleto de fotos:", describeSupabaseError(cleanup.error));
    }
    console.error("Falha ao enviar fotos do produto:", describeSupabaseError(error));
    return jsonError(
      error instanceof SupabaseOrdersConfigurationError
        ? "Supabase não configurado neste ambiente. Verifique as variáveis de ambiente do servidor."
        : "Não foi possível enviar as fotos. Confirme a migração/configuração do bucket produtos.",
      503,
    );
  }
}
