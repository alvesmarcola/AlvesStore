import assert from "node:assert/strict";
import { test } from "node:test";
import f1Products from "@/data/f1-products.json";
import { getBundledFormulaOneProducts } from "@/lib/server/supabase-catalog";
import { productImageAsset } from "@/lib/catalog";

test("Camisa Tommy Hilfiger x Cadillac F1 Team Polo tem imagens válidas e publicadas", () => {
  const cadillac = f1Products.find((p) => p.slug === "camisa-tommy-hilfiger-cadillac-f1-team-polo");
  assert.ok(cadillac, "Produto Cadillac F1 Polo deve existir em f1-products.json");
  assert.equal(cadillac.images.length, 2, "Cadillac Polo deve ter 2 fotos (frente e costas)");

  // Verifica que não usa mais o link quebrado com big.jpg
  assert.ok(!cadillac.images[0].src.includes("big.jpg"), "Não deve usar big.jpg quebrado");
  assert.ok(cadillac.images[0].src.includes("medium.jpg"), "Deve usar medium.jpg que existe no Yupoo");

  // Verifica que ambas as fotos possuem URL Yupoo válida
  assert.ok(cadillac.images[0].src.startsWith("https://photo.yupoo.com/minkang/e123ecc100/medium.jpg"));
  assert.ok(cadillac.images[1].src.startsWith("https://photo.yupoo.com/minkang/124e6dc0e5/c25fd35e.jpg"));

  // Verifica se está presente na lista de produtos publicados da F1
  const publishedF1 = getBundledFormulaOneProducts();
  const publishedCadillac = publishedF1.find((p) => p.slug === "camisa-tommy-hilfiger-cadillac-f1-team-polo");
  assert.ok(publishedCadillac, "Cadillac Polo deve estar entre os produtos publicados da F1");

  // Testa gerador de asset de imagem para card e detalhes
  const primaryAsset = productImageAsset(cadillac as any);
  assert.equal(primaryAsset.src, "https://photo.yupoo.com/minkang/e123ecc100/medium.jpg");
  const secondaryAsset = productImageAsset(cadillac as any, true);
  assert.equal(secondaryAsset.src, "https://photo.yupoo.com/minkang/124e6dc0e5/c25fd35e.jpg");
});

test("Todos os 34 conjuntos infantis do catálogo estão publicados e recuperados", async () => {
  const products = (await import("@/data/products.json")).default as any[];
  const kids = products.filter((p) => p.publico === "infantil");
  assert.equal(kids.length, 34, "Devem existir 34 conjuntos infantis no catálogo base");

  // Nenhum deve estar com tipo 'revisar'
  assert.ok(kids.every((k) => k.tipo !== "revisar"), "Nenhum conjunto infantil deve estar com tipo 'revisar'");

  // Todos devem possuir tamanhos infantis válidos
  assert.ok(kids.every((k) => Array.isArray(k.tamanhos) && k.tamanhos.length >= 7), "Todos devem ter tamanhos infantis (16 a 28)");

  // Todos devem ter clube preenchido
  assert.ok(kids.every((k) => k.clube && k.clube !== "revisar"), "Todos os conjuntos infantis devem ter clube identificado");

  // Todos devem ter imagens locais otimizadas
  assert.ok(kids.every((k) => k.images.length > 0 && k.images.every((img: any) => img.src.startsWith("/otimizadas/"))), "Todas as imagens devem ser locais e otimizadas");
});

