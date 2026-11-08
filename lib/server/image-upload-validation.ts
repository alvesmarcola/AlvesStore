const MIME_SIGNATURES: Record<string, (bytes: Uint8Array) => boolean> = {
  "image/jpeg": (bytes) => bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff,
  "image/png": (bytes) => bytes.subarray(0, 8).join(",") === "137,80,78,71,13,10,26,10",
  "image/webp": (bytes) =>
    bytes.subarray(0, 4).join(",") === "82,73,70,70"
    && bytes.subarray(8, 12).join(",") === "87,69,66,80",
};

export async function isValidProductImage(file: File) {
  const matchesSignature = MIME_SIGNATURES[file.type];
  if (!matchesSignature || file.size === 0 || file.size > 10 * 1024 * 1024) return false;
  const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  return matchesSignature(bytes);
}

export const MAX_REVIEW_IMAGE_SIZE = 500 * 1024; // 500 KB após compressão no navegador

export async function validateReviewImage(
  file: File
): Promise<{ valid: boolean; error?: string; extension?: "jpg" | "png" | "webp" }> {
  if (!file || typeof file.size !== "number" || file.size === 0) {
    return { valid: false, error: "Arquivo de imagem vazio ou inválido." };
  }
  if (file.size > MAX_REVIEW_IMAGE_SIZE) {
    return {
      valid: false,
      error: `A foto excede o limite máximo de 500 KB após compressão (tamanho recebido: ${(file.size / 1024).toFixed(0)} KB).`,
    };
  }

  const extMap: Record<string, "jpg" | "png" | "webp"> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
  };
  const extension = extMap[file.type];
  const matchesSignature = MIME_SIGNATURES[file.type];

  if (!matchesSignature || !extension) {
    return {
      valid: false,
      error: "Formato de imagem não suportado. Utilize apenas JPG, PNG ou WebP.",
    };
  }

  try {
    const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());
    if (!matchesSignature(bytes)) {
      return {
        valid: false,
        error: "O conteúdo do arquivo não corresponde a uma imagem válida (assinatura de bytes corrompida ou forjada).",
      };
    }
  } catch {
    return { valid: false, error: "Falha ao ler os dados binários da imagem." };
  }

  return { valid: true, extension };
}
