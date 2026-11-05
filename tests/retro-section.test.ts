import assert from "node:assert/strict";
import { test } from "node:test";
import { isNbaTankTop } from "@/lib/product-classification";
import { isFormulaOneProduct } from "@/lib/formula-one";
import productsData from "@/data/products.json";
import type { Product } from "@/lib/types";

test("Filtro de Clássicos Retrô exclui NBA e utiliza tipo/slug", () => {
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

  const isRetroFilter = (product: Product) => {
    const isNba = product.liga === "nba" || product.tipo === "regata" || isNbaTankTop(product);
    if (isNba) return false;
    if (isFormulaOneProduct(product)) return false;
    return product.tipo === "retro"
      || product.category === "retro"
      || product.subcategory === "retro"
      || product.slug.startsWith("retro-")
      || product.slug.includes("-retro-")
      || product.slug.endsWith("-retro");
  };

  assert.equal(isRetroFilter(nbaRetroMock), false, "Regata NBA não deve passar no filtro de retrô");
  assert.equal(isRetroFilter(futebolRetroMock), true, "Camisa retrô de clube deve passar no filtro de retrô");

  // Verifica que camisas retrô de futebol do catálogo base passam no filtro
  const retroList = products.filter(isRetroFilter);
  assert.ok(retroList.length >= 190, `Devem existir pelo menos 190 camisas retrô publicadas (encontradas: ${retroList.length})`);
  assert.ok(retroList.every((p) => p.liga !== "nba" && p.tipo !== "regata"), "Nenhum produto retrô filtrado pode ser NBA ou regata");
});
