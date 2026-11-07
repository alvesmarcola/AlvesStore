import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { manualProductSchema } from "../lib/admin/product-validation";

describe("Remoção de marca d'água em polos de F1 e Blacklist Yupoo", () => {
  const rootDir = process.cwd();
  const f1Path = path.join(rootDir, "data", "f1-products.json");
  const blacklistPath = path.join(rootDir, "data", "yupoo-image-blacklist.json");

  it("garante que nenhum polo de F1 possui as URLs com marca d'água conhecidas", () => {
    const raw = fs.readFileSync(f1Path, "utf8");
    const products = JSON.parse(raw);

    const mclarenWatermark = "https://photo.yupoo.com/minkang/d42fb87d6f/aecba1ac.jpg";
    const williamsWatermark = "https://photo.yupoo.com/minkang/e8d00f56cf/afef04e4.jpg";

    const f1Polos = products.filter((p: any) =>
      p.nome.toLowerCase().includes("polo") || p.slug.toLowerCase().includes("polo")
    );

    assert.equal(f1Polos.length, 6, "Devem existir 6 polos de F1");

    for (const polo of f1Polos) {
      assert.ok(Array.isArray(polo.images) && polo.images.length > 0, `${polo.slug} deve ter ao menos 1 foto limpa`);
      assert.ok(polo.images[0].src, "A primeira foto (capa) deve existir");

      const urls = polo.images.map((img: any) => img.src);
      assert.ok(!urls.includes(mclarenWatermark), `McLaren watermark não deve existir em ${polo.slug}`);
      assert.ok(!urls.includes(williamsWatermark), `Williams watermark não deve existir em ${polo.slug}`);
    }
  });

  it("registra as fotos removidas no yupoo-image-blacklist.json", () => {
    assert.ok(fs.existsSync(blacklistPath), "Arquivo de blacklist deve existir");
    const blacklist = JSON.parse(fs.readFileSync(blacklistPath, "utf8"));

    assert.ok(Array.isArray(blacklist.excluded_urls), "excluded_urls deve ser array");
    assert.ok(
      blacklist.excluded_urls.includes("https://photo.yupoo.com/minkang/d42fb87d6f/aecba1ac.jpg"),
      "URL da McLaren deve estar na blacklist"
    );
    assert.ok(
      blacklist.excluded_urls.includes("https://photo.yupoo.com/minkang/e8d00f56cf/afef04e4.jpg"),
      "URL da Williams deve estar na blacklist"
    );
  });

  it("valida o schema do admin para reordenação e remoção de imagens no payload", () => {
    const validPayload = {
      slug: "camisa-polo-f1-teste",
      nome: "Camisa Polo F1 Teste",
      description: "Polo oficial teste de F1",
      brand: "Puma",
      supplier_name: "Fornecedor",
      supplier_cost: 90,
      preco: 199.9,
      publico: "unissex" as const,
      tipo: "f1" as const,
      liga: "formula-1",
      clube: "McLaren",
      temporada: "2025",
      uniforme: "titular" as const,
      cor: "Laranja",
      tamanhos: ["M", "G"],
      stock_by_size: { M: 5, G: 5 },
      tem_variacao_uniforme: false,
      oculto: false,
      imageUrls: [],
      images: [
        { src: "https://example.com/foto1.jpg", alt: "Foto 1" },
        { src: "https://example.com/foto2.jpg", alt: "Foto 2" },
      ],
    };

    const parsed = manualProductSchema.safeParse(validPayload);
    assert.ok(parsed.success, "Payload com array de imagens reordenadas/filtradas deve ser válido");
    if (parsed.success) {
      assert.equal(parsed.data.images?.length, 2);
      assert.equal(parsed.data.images?.[0].src, "https://example.com/foto1.jpg");
    }
  });
});
