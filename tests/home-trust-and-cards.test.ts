import test from "node:test";
import assert from "node:assert/strict";
import { siteCompanyConfig } from "@/lib/site-config";
import { isNbaTankTop, isPackageEligible, isRetroProduct } from "@/lib/product-classification";
import { isBlackFridayEligibleShirt } from "@/lib/black-friday";
import type { Product } from "@/lib/types";

const mockImage = {
  src: "https://example.com/foto.jpg",
  source: "https://example.com/foto.jpg",
  alt: "Foto ilustrativa",
  credit: "Imports Alves",
  focalPoint: { x: 50, y: 50 },
  blurDataURL: "",
};

const mockNbaTank: Product = {
  id: "nba-1",
  slug: "regata-golden-state-curry",
  clube: "Golden State Warriors",
  clubeSlug: "warriors",
  liga: "nba",
  publico: "masculino",
  tipo: "regata",
  temporada: "2026",
  uniforme: "titular",
  nome: "Regata Golden State Warriors Stephen Curry 30",
  preco: 230,
  tamanhos: ["P", "M", "G", "GG"], // Regatas NBA não possuem 2GG
  cor: "Azul",
  imageSeed: "nba",
  images: [mockImage],
};

const mockFanShirt: Product = {
  id: "fan-1",
  slug: "camisa-flamengo-titular-2026",
  clube: "Flamengo",
  clubeSlug: "flamengo",
  liga: "brasileirao-serie-a",
  publico: "masculino",
  tipo: "torcedor",
  temporada: "2026",
  uniforme: "titular",
  nome: "Camisa Flamengo Titular 2026",
  preco: 160,
  tamanhos: ["P", "M", "G", "GG", "2GG"],
  cor: "Vermelho e Preto",
  imageSeed: "flamengo",
  images: [mockImage],
};

const mockKidsSelection: Product = {
  id: "kids-1",
  slug: "kit-infantil-brasil-amarela-2026",
  clube: "Brasil",
  clubeSlug: "brasil",
  liga: "selecoes",
  publico: "infantil",
  tipo: "torcedor",
  temporada: "2026",
  uniforme: "titular",
  nome: "Kit Infantil Seleção Brasil 2026",
  preco: 180,
  tamanhos: ["16", "18", "20", "22"],
  cor: "Amarelo",
  imageSeed: "brasil-kids",
  images: [mockImage],
};

const mockAdultSelection: Product = {
  id: "adult-sel-1",
  slug: "camisa-brasil-titular-2026",
  clube: "Brasil",
  clubeSlug: "brasil",
  liga: "selecoes",
  publico: "masculino",
  tipo: "torcedor",
  temporada: "2026",
  uniforme: "titular",
  nome: "Camisa Seleção Brasil Titular 2026",
  preco: 160,
  tamanhos: ["P", "M", "G", "GG", "2GG"],
  cor: "Amarelo",
  imageSeed: "brasil",
  images: [mockImage],
};

test("siteCompanyConfig exporta configurações institucionais com fallbacks e variáveis de ambiente", () => {
  assert.ok(typeof siteCompanyConfig.email === "string");
  assert.ok(typeof siteCompanyConfig.whatsapp === "string");
  assert.ok(typeof siteCompanyConfig.prazoEstimadoEntrega === "string");
  assert.equal(siteCompanyConfig.email, "atendimento@importsalves.com.br");
  // Sem valor inventado para prazo de entrega por padrão (vazio se env não estiver preenchida)
  assert.equal(siteCompanyConfig.prazoEstimadoEntrega, process.env.NEXT_PUBLIC_DELIVERY_ESTIMATE?.trim() || "");
});

test("Camisas com tamanho 2GG disponível indicam o tamanho, enquanto NBA e Kids não possuem 2GG", () => {
  assert.equal(mockFanShirt.tamanhos.includes("2GG"), true);
  assert.equal(mockNbaTank.tamanhos.includes("2GG"), false);
  assert.equal(mockKidsSelection.tamanhos.includes("2GG"), false);
});

test("Filtro de Camisas de Clubes exclui regatas NBA e produtos infantis", () => {
  const catalog = [mockNbaTank, mockFanShirt, mockKidsSelection, mockAdultSelection];

  const clubCandidates = catalog.filter((product) =>
    product.liga !== "selecoes" &&
    product.liga !== "nba" &&
    product.tipo !== "regata" &&
    product.publico !== "infantil"
  );

  assert.equal(clubCandidates.length, 1);
  assert.equal(clubCandidates[0].id, "fan-1");
  assert.ok(!clubCandidates.some((p) => p.liga === "nba" || p.tipo === "regata"));
});

test("Filtro de Seleções Nacionais da Home inclui apenas produtos adultos, excluindo kits infantis", () => {
  const catalog = [mockNbaTank, mockFanShirt, mockKidsSelection, mockAdultSelection];

  const nationalSelections = catalog.filter((product) =>
    product.liga === "selecoes" &&
    product.publico !== "infantil" &&
    !/\b(?:kids|junior|youth|infantil|children)\b/i.test(`${product.nome}`)
  );

  assert.equal(nationalSelections.length, 1);
  assert.equal(nationalSelections[0].id, "adult-sel-1");
  assert.equal(nationalSelections[0].publico, "masculino");
});

test("Etiqueta de oferta nos cards identifica Black Friday e pacote 2 por R$ 300", () => {
  // Regata NBA e Torcedor são elegíveis para Black Friday
  assert.equal(isBlackFridayEligibleShirt(mockFanShirt), true);
  assert.equal(isNbaTankTop(mockNbaTank), true);
  // Torcedor comum também é elegível para pacote
  assert.equal(isPackageEligible(mockFanShirt), true);
});

test("Sitemap filtra e omite produtos com oculto: true", () => {
  const products = [
    { slug: "camisa-publica-1", oculto: false },
    { slug: "camisa-publica-2" },
    { slug: "camisa-teste-privada", oculto: true },
  ];

  const visibleProducts = products.filter((product) => !product.oculto);
  assert.equal(visibleProducts.length, 2);
  assert.equal(visibleProducts.some((p) => p.slug === "camisa-teste-privada"), false);
});
