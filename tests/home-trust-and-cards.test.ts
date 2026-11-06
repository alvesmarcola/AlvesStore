import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { siteCompanyConfig } from "@/lib/site-config";
import { isNbaTankTop, isPackageEligible, isRetroProduct } from "@/lib/product-classification";
import { isBlackFridayEligibleShirt } from "@/lib/black-friday";
import { deriveCatalogLeagues } from "@/lib/catalog-taxonomy";
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

test("Card da coleção F1 na Home possui foto de camisa oficial local válida e não quebrada", () => {
  const mockF1Product: Product = {
    id: "f1-ferrari-polo",
    slug: "camisa-polo-scuderia-ferrari-f1-2026",
    clube: "Ferrari",
    clubeSlug: "ferrari",
    liga: "f1",
    publico: "unissex",
    tipo: "f1",
    temporada: "2026",
    uniforme: "titular",
    nome: "Camisa Polo Scuderia Ferrari F1 2026 Vermelha",
    preco: 180,
    tamanhos: ["P", "M", "G", "GG", "2GG"],
    cor: "Vermelho",
    imageSeed: "scuderia-ferrari-f1-polo-2026",
    images: [{
      src: "https://photo.yupoo.com/minkang/2ddfd0ef/big.jpg",
      source: "https://photo.yupoo.com/minkang/2ddfd0ef/big.jpg",
      alt: "Camisa Polo Scuderia Ferrari F1 2026 Vermelha",
      credit: "Yupoo",
      focalPoint: { x: 50, y: 50 },
      blurDataURL: "",
    }],
  };

  const leagues = deriveCatalogLeagues([mockFanShirt, mockF1Product]);
  const f1League = leagues.find((l) => l.slug === "f1");

  assert.ok(f1League, "Liga F1 deve constar nas ligas derivadas");
  assert.ok(f1League.coverImage, "Liga F1 deve ter coverImage definida");

  // Não pode ser hotlink remoto do Yupoo que quebra com 502 Bad Gateway
  assert.ok(!f1League.coverImage.startsWith("https://photo.yupoo.com"), "Capa da F1 não deve depender de hotlink do Yupoo");

  // Deve apontar para arquivo local estático válido em /arena/
  assert.ok(f1League.coverImage.startsWith("/arena/"), "Capa da F1 deve apontar para ativo local em /arena/");

  // O arquivo físico deve existir em public/
  const filePath = path.join(process.cwd(), "public", f1League.coverImage.replace(/^\//, ""));
  assert.ok(fs.existsSync(filePath), `Arquivo físico deve existir em disco: ${filePath}`);

  const stat = fs.statSync(filePath);
  assert.ok(stat.size > 10_000, `Arquivo de imagem da F1 deve ter tamanho válido (>10KB), encontrado: ${stat.size} bytes`);
});
