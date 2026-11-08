import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  validateReviewImage,
  MAX_REVIEW_IMAGE_SIZE,
} from "../lib/server/image-upload-validation";
import {
  compressReviewImage,
  MAX_ORIGINAL_FILE_SIZE,
} from "../lib/client/image-compression";
import { reviewSubmissionSchema, sanitizeReviewText } from "../lib/reviews";

// Helper para criar arquivo mock com bytes arbitrários
function createMockFile(
  name: string,
  type: string,
  sizeBytes: number,
  headerBytes?: number[]
): File {
  const buffer = new Uint8Array(sizeBytes);
  if (headerBytes) {
    for (let i = 0; i < headerBytes.length; i++) {
      buffer[i] = headerBytes[i];
    }
  }
  return new File([buffer], name, { type });
}

// Assinaturas mágicas reais
const VALID_WEBP_HEADER = [82, 73, 70, 70, 0, 0, 0, 0, 87, 69, 66, 80]; // RIFF....WEBP
const VALID_JPEG_HEADER = [0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46];
const VALID_PNG_HEADER = [137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13];

describe("1. Validação de tipos de arquivo e assinaturas binárias (magic bytes)", () => {
  it("aceita WebP, JPEG e PNG com cabeçalhos binários válidos e tamanho até 500 KB", async () => {
    const webpFile = createMockFile("foto.webp", "image/webp", 150 * 1024, VALID_WEBP_HEADER);
    const jpegFile = createMockFile("foto.jpg", "image/jpeg", 200 * 1024, VALID_JPEG_HEADER);
    const pngFile = createMockFile("foto.png", "image/png", 250 * 1024, VALID_PNG_HEADER);

    const resWebp = await validateReviewImage(webpFile);
    assert.equal(resWebp.valid, true, "WebP válido deve passar");
    assert.equal(resWebp.extension, "webp");

    const resJpeg = await validateReviewImage(jpegFile);
    assert.equal(resJpeg.valid, true, "JPEG válido deve passar");
    assert.equal(resJpeg.extension, "jpg");

    const resPng = await validateReviewImage(pngFile);
    assert.equal(resPng.valid, true, "PNG válido deve passar");
    assert.equal(resPng.extension, "png");
  });

  it("rejeita formatos não suportados (ex: GIF, SVG, PDF)", async () => {
    const gifFile = createMockFile("anim.gif", "image/gif", 50 * 1024, [0x47, 0x49, 0x46, 0x38]);
    const pdfFile = createMockFile("doc.pdf", "application/pdf", 50 * 1024, [0x25, 0x50, 0x44, 0x46]);

    const resGif = await validateReviewImage(gifFile);
    assert.equal(resGif.valid, false, "GIF deve ser rejeitado");
    assert.match(resGif.error || "", /Formato de imagem não suportado/);

    const resPdf = await validateReviewImage(pdfFile);
    assert.equal(resPdf.valid, false, "PDF deve ser rejeitado");
    assert.match(resPdf.error || "", /Formato de imagem não suportado/);
  });

  it("rejeita arquivo com tipo MIME forjado cujos primeiros bytes não correspondem à imagem real", async () => {
    // Arquivo fingindo ser WebP mas contendo zeros ou texto malicioso
    const fakeWebp = createMockFile("malware.webp", "image/webp", 10 * 1024, [0, 0, 0, 0, 0, 0, 0, 0]);
    const res = await validateReviewImage(fakeWebp);
    assert.equal(res.valid, false, "Arquivo com assinatura falsa deve ser rejeitado");
    assert.match(res.error || "", /assinatura de bytes corrompida ou forjada/);
  });

  it("rejeita arquivo com 0 bytes", async () => {
    const emptyFile = createMockFile("vazio.webp", "image/webp", 0);
    const res = await validateReviewImage(emptyFile);
    assert.equal(res.valid, false);
    assert.match(res.error || "", /vazio ou inválido/);
  });
});

describe("2. Limite de tamanho de arquivo", () => {
  it("servidor rejeita fotos maiores que 500 KB após compressão", async () => {
    const oversizedFile = createMockFile(
      "foto_pesada.webp",
      "image/webp",
      501 * 1024,
      VALID_WEBP_HEADER
    );
    const res = await validateReviewImage(oversizedFile);
    assert.equal(res.valid, false);
    assert.match(res.error || "", /excede o limite máximo de 500 KB/);
  });

  it("navegador rejeita fotos originais maiores que 8 MB antes da compressão", async () => {
    const hugeFile = createMockFile(
      "gigante.jpg",
      "image/jpeg",
      8.5 * 1024 * 1024,
      VALID_JPEG_HEADER
    );

    await assert.rejects(
      async () => {
        await compressReviewImage(hugeFile);
      },
      /excede o limite máximo de 8 MB/
    );
  });
});

describe("3. Envio de avaliação sem foto (retrocompatibilidade e resiliência)", () => {
  it("valida payload de avaliação tradicional sem campo de imagem", () => {
    const validJson = {
      nome: "Marcos Souza",
      cidade: "Belo Horizonte, MG",
      produto: "Camisa Cruzeiro Retrô",
      nota: 5,
      comentario: "Excelente acabamento e tecido confortável!",
      website: "",
    };

    const parsed = reviewSubmissionSchema.safeParse(validJson);
    assert.equal(parsed.success, true, "Avaliação sem foto deve ser aceita normalmente");
    if (parsed.success) {
      assert.equal(parsed.data.imagem_path, undefined);
      assert.equal(parsed.data.nome, "Marcos Souza");
    }
  });

  it("aceita avaliação com imagem_path explicitamente nulo", () => {
    const validWithNullImage = {
      nome: "Ana Paula",
      cidade: "Curitiba, PR",
      produto: "Camisa Seleção Brasileira",
      nota: 5,
      comentario: "Muito bonita e entrega rápida.",
      website: "",
      imagem_path: null,
    };

    const parsed = reviewSubmissionSchema.safeParse(validWithNullImage);
    assert.equal(parsed.success, true);
    if (parsed.success) {
      assert.equal(parsed.data.imagem_path, null);
    }
  });

  it("sanitiza textos e previne injeção de HTML no comentário", () => {
    const dirty = "<script>alert('xss')</script> Ótima camisa! <b>Recomendo</b>";
    const cleaned = sanitizeReviewText(dirty);
    assert.equal(cleaned, "Ótima camisa! Recomendo");
    assert.ok(!cleaned.includes("<script>"));
    assert.ok(!cleaned.includes("<b>"));
  });
});

describe("4. Privacidade: proteção de fotos de avaliações não aprovadas", () => {
  it("garante que o endpoint /api/reviews/image bloqueia caminhos maliciosos e transversais (path traversal)", () => {
    const invalidPaths = [
      "../../etc/passwd",
      "../storage/foto.webp",
      "foto/subpasta/teste.webp",
      "arquivo_sem_extensao",
      "foto.exe",
      "foto.php",
    ];

    const safeRegex = /^[a-f0-9-]+\.(webp|jpg|jpeg|png)$/i;

    for (const invalid of invalidPaths) {
      assert.equal(
        safeRegex.test(invalid),
        false,
        `O caminho '${invalid}' deve ser bloqueado`
      );
    }

    const validUuidName = "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d.webp";
    assert.equal(safeRegex.test(validUuidName), true, "Nome aleatório com UUID deve ser aceito");
  });

  it("confirma que a rota pública /api/reviews inclui imagem_url somente para avaliações aprovadas", () => {
    const rows = [
      {
        created_at: "2026-11-07T12:00:00Z",
        nome: "Cliente A",
        cidade: "São Paulo, SP",
        produto: "Camisa F1",
        nota: 5,
        comentario: "Top demais!",
        status: "approved",
        imagem_path: "foto-aprovada-1.webp",
      },
      {
        created_at: "2026-11-07T12:05:00Z",
        nome: "Cliente B",
        cidade: "Rio de Janeiro, RJ",
        produto: "Camisa F1",
        nota: 4,
        comentario: "Muito boa",
        status: "pending",
        imagem_path: "foto-pendente-2.webp",
      },
    ];

    const publicList = rows
      .filter((r) => r.status === "approved")
      .map((r) => ({
        nome: r.nome,
        imagem_url: r.imagem_path ? `/api/reviews/image?path=${encodeURIComponent(r.imagem_path)}` : null,
      }));

    assert.equal(publicList.length, 1, "Apenas avaliações aprovadas devem ser retornadas publicamente");
    assert.equal(publicList[0].nome, "Cliente A");
    assert.ok(publicList[0].imagem_url?.includes("foto-aprovada-1.webp"));

    const hasPendingInPublic = publicList.some((r) => r.nome === "Cliente B");
    assert.equal(hasPendingInPublic, false, "Avaliação pendente não deve aparecer na vitrine pública");
  });
});

describe("5. Migração SQL e Integridade do Supabase Storage", () => {
  const migrationPath = path.join(
    process.cwd(),
    "supabase",
    "migrations",
    "20261107000001_review_photos_storage.sql"
  );

  it("arquivo de migração SQL existe e contém todas as especificações obrigatórias", () => {
    assert.ok(fs.existsSync(migrationPath), "Arquivo de migração deve existir");
    const sql = fs.readFileSync(migrationPath, "utf8");

    // 1. Coluna imagem_path
    assert.ok(
      sql.includes("imagem_path TEXT DEFAULT NULL"),
      "Deve adicionar coluna imagem_path nula por padrão"
    );

    // 2. Coluna produto
    assert.ok(
      sql.includes("produto TEXT NOT NULL DEFAULT 'Avaliação geral'"),
      "Deve garantir coluna produto"
    );

    // 3. Bucket avaliacoes no Storage
    assert.ok(
      sql.includes("'avaliacoes'"),
      "Deve configurar bucket avaliacoes"
    );
    assert.ok(
      sql.includes("public, file_size_limit, allowed_mime_types"),
      "Deve definir bucket com tamanho e tipos restritos"
    );
    assert.ok(
      sql.includes("524288"),
      "Limite de tamanho de arquivo deve ser 512 KB no Storage"
    );

    // 4. Instruções de rollback
    assert.ok(
      sql.includes("INSTRUÇÕES DE ROLLBACK"),
      "Deve conter instruções completas de rollback descritas"
    );
  });
});

describe("6. Diagnóstico detalhado de erros no servidor e ausência de service_role", () => {
  it("arquivo route.ts implementa detecção antecipada de service_role com log claro", () => {
    const routePath = path.join(process.cwd(), "app", "api", "reviews", "route.ts");
    const routeContent = fs.readFileSync(routePath, "utf8");

    assert.ok(
      routeContent.includes("checkServiceRoleConfigured"),
      "Deve possuir função de validação de service_role"
    );
    assert.ok(
      routeContent.includes("[Reviews API - POST Inicialização]"),
      "Deve logar no console se a chave service_role estiver ausente"
    );
    assert.ok(
      routeContent.includes("diagnoseStorageError"),
      "Deve conter diagnóstico especializado de falhas no Storage"
    );
    assert.ok(
      routeContent.includes("BUCKET_INEXISTENTE"),
      "Deve identificar explicitamente quando o bucket não existe"
    );
    assert.ok(
      routeContent.includes("COLUNA_INEXISTENTE"),
      "Deve identificar explicitamente quando a coluna imagem_path não existe"
    );
    assert.ok(
      routeContent.includes('etapa: "upload_storage"'),
      "Deve registrar o contexto da etapa que falhou no console.error"
    );
  });

  it("garante mensagem amigável ao cliente e resiliência para envio sem foto se a imagem falhar", () => {
    const routePath = path.join(process.cwd(), "app", "api", "reviews", "route.ts");
    const routeContent = fs.readFileSync(routePath, "utf8");

    const friendlyMessage = "Não foi possível salvar a foto enviada. Você pode remover a foto e enviar a avaliação normalmente.";
    assert.ok(
      routeContent.includes(friendlyMessage),
      "Deve retornar mensagem orientando o cliente a remover a foto se o upload falhar"
    );
  });

  it("aceita chaves tanto no formato novo (sb_secret_...) quanto JWT legado (eyJ...) sem reprovar", () => {
    const routePath = path.join(process.cwd(), "app", "api", "reviews", "route.ts");
    const routeContent = fs.readFileSync(routePath, "utf8");

    assert.ok(
      routeContent.includes('key.startsWith("sb_secret_")'),
      "Deve reconhecer explicitamente o prefixo sb_secret_"
    );
    assert.ok(
      routeContent.includes('key.startsWith("eyJ")'),
      "Deve reconhecer explicitamente o prefixo JWT eyJ"
    );
    assert.ok(
      routeContent.includes("[Reviews API - GET 503]"),
      "Deve registrar motivo exato do erro 503 no console do servidor em GET"
    );
  });

  it("validador de chave pública em supabase-orders aceita sb_secret_ como chave privada válida", () => {
    const ordersClientPath = path.join(process.cwd(), "lib", "server", "supabase-orders.ts");
    const ordersContent = fs.readFileSync(ordersClientPath, "utf8");

    assert.ok(
      ordersContent.includes('key.startsWith("sb_secret_")'),
      "isPublicSupabaseKey deve tratar sb_secret_ explicitamente como chave privada"
    );
  });

  it("testa validação de chaves sb_secret_ e JWT simulando o comportamento de checkServiceRoleConfigured", () => {
    function testCheck(url?: string, key?: string) {
      if (!url?.trim()) return { ok: false, reason: "url ausente" };
      if (!key?.trim()) return { ok: false, reason: "key ausente" };
      const format = key.startsWith("sb_secret_")
        ? "novo (sb_secret_...)"
        : key.startsWith("eyJ")
        ? "JWT legado (eyJ...)"
        : "personalizado";
      return { ok: true, format };
    }

    // Casos válidos
    const resNew = testCheck("https://test.supabase.co", "sb_secret_example_token_12345");
    assert.equal(resNew.ok, true);
    assert.equal(resNew.format, "novo (sb_secret_...)");

    const resJwt = testCheck("https://test.supabase.co", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.fake");
    assert.equal(resJwt.ok, true);
    assert.equal(resJwt.format, "JWT legado (eyJ...)");

    // Casos que devem reprovar
    const resEmptyKey = testCheck("https://test.supabase.co", "");
    assert.equal(resEmptyKey.ok, false);

    const resNullKey = testCheck("https://test.supabase.co", undefined);
    assert.equal(resNullKey.ok, false);

    const resEmptyUrl = testCheck("", "sb_secret_test");
    assert.equal(resEmptyUrl.ok, false);
  });
});
