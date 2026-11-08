export interface CompressImageOptions {
  maxDimension?: number;
  initialQuality?: number;
  maxSizeBytes?: number;
}

export const MAX_ORIGINAL_FILE_SIZE = 8 * 1024 * 1024; // 8 MB
export const MAX_COMPRESSED_FILE_SIZE = 300 * 1024; // 300 KB target

const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];

/**
 * Valida e comprime uma foto de avaliação diretamente no navegador via HTML Canvas.
 * - Redimensiona para no máximo 1200px no maior lado preservando proporção.
 * - Converte para WebP com qualidade ~0.8 (e ajuste se > 300 KB).
 * - Remove todos os metadados EXIF (incluindo geolocalização por GPS) ao reconstruir os pixels.
 */
export async function compressReviewImage(
  file: File,
  options: CompressImageOptions = {}
): Promise<File> {
  const maxDimension = options.maxDimension ?? 1200;
  const initialQuality = options.initialQuality ?? 0.8;
  const maxSizeBytes = options.maxSizeBytes ?? MAX_COMPRESSED_FILE_SIZE;

  // 1. Validação do tamanho original
  if (file.size > MAX_ORIGINAL_FILE_SIZE) {
    throw new Error("A imagem original excede o limite máximo de 8 MB.");
  }

  // 2. Validação do formato permitido
  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    throw new Error("Formato inválido. Selecione uma imagem em JPG, PNG ou WebP.");
  }

  // Se estiver em ambiente sem DOM (testes SSR), retorna o próprio arquivo se já for válido
  if (typeof window === "undefined" || typeof document === "undefined") {
    return file;
  }

  // 3. Carregar em objeto de imagem
  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("Não foi possível processar a imagem selecionada."));
      image.src = objectUrl;
    });

    // 4. Calcular redimensionamento proporcional
    let width = img.naturalWidth || img.width;
    let height = img.naturalHeight || img.height;

    if (width > maxDimension || height > maxDimension) {
      if (width > height) {
        height = Math.round((height * maxDimension) / width);
        width = maxDimension;
      } else {
        width = Math.round((width * maxDimension) / height);
        height = maxDimension;
      }
    }

    width = Math.max(1, width);
    height = Math.max(1, height);

    // 5. Canvas: desenha os pixels puros, descartando EXIF / GPS
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Falha ao inicializar contexto do canvas para compressão.");
    }

    // Melhora suavização do redimensionamento
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, 0, 0, width, height);

    // 6. Conversão para WebP
    const getBlob = (q: number) =>
      new Promise<Blob | null>((resolve) => {
        canvas.toBlob((b) => resolve(b), "image/webp", q);
      });

    let quality = initialQuality;
    let blob = await getBlob(quality);

    // Fallback caso navegador não suporte toBlob com image/webp (usa image/jpeg)
    if (!blob) {
      blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob((b) => resolve(b), "image/jpeg", quality);
      });
    }

    if (!blob) {
      throw new Error("Não foi possível gerar a versão comprimida da imagem.");
    }

    // Se ainda exceder 300 KB, tenta qualidade reduzida
    if (blob.size > maxSizeBytes && quality > 0.5) {
      quality = 0.65;
      const secondBlob = await getBlob(quality);
      if (secondBlob && secondBlob.size < blob.size) {
        blob = secondBlob;
      }
    }

    const finalMime = blob.type || "image/webp";
    const finalExt = finalMime === "image/jpeg" ? "jpg" : "webp";

    return new File([blob], `avaliacao.${finalExt}`, { type: finalMime });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
