import assert from "node:assert/strict";
import { test } from "node:test";
import { isRetroProduct, isRetroCategory, normalizeCategorySlug } from "@/lib/product-classification";
import { getProductCategoryKey } from "@/lib/commerce";
import productsData from "@/data/products.json";
import type { Product } from "@/lib/types";

test("Filtro unificado de Retrô exclui NBA e utiliza isRetroProduct", () => {
  const products = productsData as unknown as Product[];

  // Produto NBA com 'Retrô' no nome
  const nbaRetroMock: Product = {
    id: "230511706",
    slug: "regata-nba-76ers-retro-branca-0-tyrese-maxey",
    clube: "76ers",
    clubeSlug: "76ers",
    liga: "nba",
    publico: "masculino",
    tipo: "regata",
    temporada: "24/25",
    uniforme: "revisar",
    nome: "Regata NBA 76ers Retrô Branca #0 Tyrese Maxey",
    preco: 230,
    tamanhos: ["P", "M", "G", "GG"],
    cor: "revisar",
    imageSeed: "regata-nba-76ers-retro-branca-0-tyrese-maxey",
    images: [{ src: "/produtos/nba/0.webp", source: "yupoo", alt: "NBA", credit: "Yupoo", focalPoint: { x: 50, y: 50 }, blurDataURL: "" }],
  };

  // Camisa retrô legítima de clube de futebol
  const futebolRetroMock: Product = {
    id: "catalog-retro-flamengo-1981",
    slug: "retro-campeonato-brasileiro-flamengo-1981",
    clube: "Flamengo",
    clubeSlug: "flamengo",
    liga: "brasileirao-serie-a",
    publico: "masculino",
    tipo: "retro",
    temporada: "1981",
    uniforme: "titular",
    nome: "Camisa Flamengo 1981 Retrô",
    preco: 185,
    tamanhos: ["P", "M", "G", "GG"],
    cor: "vermelho e preto",
    imageSeed: "flamengo-1981",
    images: [{ src: "/otimizadas/flamengo-1981.webp", source: "local", alt: "Flamengo 1981", credit: "local", focalPoint: { x: 50, y: 50 }, blurDataURL: "" }],
  };

  assert.equal(isRetroProduct(nbaRetroMock), false, "Regata NBA não deve passar no filtro de retrô");
  assert.equal(isRetroProduct(futebolRetroMock), true, "Camisa retrô de clube deve passar no filtro de retrô");
  assert.equal(getProductCategoryKey(futebolRetroMock), "retro", "getProductCategoryKey deve ser 'retro'");
  assert.notEqual(getProductCategoryKey(nbaRetroMock), "retro", "Produto NBA não pode ter categoria 'retro'");

  // Verifica que camisas retrô de futebol do catálogo base passam no filtro
  const retroList = products.filter(isRetroProduct);
  assert.ok(retroList.length >= 190, `Devem existir pelo menos 190 camisas retrô publicadas (encontradas: ${retroList.length})`);
  assert.ok(retroList.every((p) => p.liga !== "nba" && p.tipo !== "regata"), "Nenhum produto retrô filtrado pode ser NBA ou regata");
});

test("Normalização de categoria e reconhecimento de 'Retrô' sem sensibilidade a acento, caixa ou hífen", () => {
  assert.equal(normalizeCategorySlug("Retrô"), "retro");
  assert.equal(normalizeCategorySlug("retrô"), "retro");
  assert.equal(normalizeCategorySlug("Retro"), "retro");
  assert.equal(normalizeCategorySlug("retro"), "retro");
  assert.equal(normalizeCategorySlug("Clássicos Retrô"), "classicos-retro");

  assert.equal(isRetroCategory("Retrô"), true);
  assert.equal(isRetroCategory("retrô"), true);
  assert.equal(isRetroCategory("Retro"), true);
  assert.equal(isRetroCategory("retro"), true);
  assert.equal(isRetroCategory("classicos-retro"), true);
  assert.equal(isRetroCategory("torcedor"), false);
  assert.equal(isRetroCategory("nba"), false);
});
