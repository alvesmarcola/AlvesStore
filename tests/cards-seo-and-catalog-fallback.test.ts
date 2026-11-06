import test from "node:test";
import assert from "node:assert/strict";
import { isPackageEligible } from "@/lib/product-classification";
import { isBlackFridayActive, isBlackFridayEligibleShirt } from "@/lib/black-friday";
import { getCardOfferBadge } from "@/components/product-card";
import { getCachedSupabaseProducts, fetchSupabaseProducts } from "@/lib/server/supabase-catalog";
import robots from "@/app/robots";
import type { Product } from "@/lib/types";

const mockImg = {
  src: "/foto.jpg",
  source: "/foto.jpg",
  alt: "Foto",
  credit: "Imports Alves",
  focalPoint: { x: 50, y: 50 },
  blurDataURL: "",
};

const baseShirt: Product = {
  id: "fan-shirt-1",
  slug: "camisa-flamengo-titular-2026",
  clube: "Flamengo",
  clubeSlug: "flamengo",
  liga: "brasileirao-serie-a",
  publico: "masculino",
  tipo: "torcedor",
  temporada: "2026",
  uniforme: "titular",
  nome: "Camisa Flamengo Titular 2026 Torcedor",
  preco: 160,
  tamanhos: ["P", "M", "G", "GG"],
  cor: "Vermelho e Preto",
  imageSeed: "fla",
  images: [mockImg],
};

test("Etiqueta '2 por R$ 300': só aparece em torcedor comum de clube/seleção e NUNCA em exceções", () => {
  // 1. Torcedor comum masculino de clube: ELEGÍVEL
  assert.equal(isPackageEligible(baseShirt), true);

  // 2. Torcedor comum feminina de seleção: ELEGÍVEL
  const femaleSelection: Product = {
    ...baseShirt,
    id: "fem-sel-1",
    slug: "camisa-brasil-fem-2026",
    clube: "Brasil",
    clubeSlug: "brasil",
    liga: "selecoes",
    publico: "feminino",
    nome: "Camisa Seleção Brasil Feminina 2026",
  };
  assert.equal(isPackageEligible(femaleSelection), true);

  // 3. Manga longa: NUNCA ELEGÍVEL
  const longSleeveShirt: Product = {
    ...baseShirt,
    id: "fan-ls-1",
    slug: "camisa-flamengo-manga-longa-2026",
    nome: "Camisa Flamengo Manga Longa 2026 Torcedor",
  };
  assert.equal(isPackageEligible(longSleeveShirt), false);

  // 4. Retrô: NUNCA ELEGÍVEL
  const retroShirt: Product = {
    ...baseShirt,
    id: "retro-1",
    slug: "camisa-retro-flamengo-1981",
    tipo: "retro",
    nome: "Camisa Retrô Flamengo 1981",
    preco: 185,
  };
  assert.equal(isPackageEligible(retroShirt), false);

  // 5. Infantil: NUNCA ELEGÍVEL
  const kidsShirt: Product = {
    ...baseShirt,
    id: "kids-1",
    slug: "kit-infantil-flamengo-2026",
    publico: "infantil",
    nome: "Kit Infantil Flamengo 2026",
    preco: 180,
  };
  assert.equal(isPackageEligible(kidsShirt), false);

  // 6. Fórmula 1: NUNCA ELEGÍVEL
  const f1Shirt: Product = {
    ...baseShirt,
    id: "f1-1",
    slug: "camisa-polo-ferrari-f1",
    liga: "f1",
    tipo: "f1",
    nome: "Camisa Polo Scuderia Ferrari F1",
    preco: 180,
  };
  assert.equal(isPackageEligible(f1Shirt), false);

  // 7. Regata NBA: NUNCA ELEGÍVEL
  const nbaTank: Product = {
    ...baseShirt,
    id: "nba-1",
    slug: "regata-nba-celtics-tatum",
    liga: "nba",
    tipo: "regata",
    nome: "Regata NBA Celtics City Edition #0 Jayson Tatum",
    preco: 230,
  };
  assert.equal(isPackageEligible(nbaTank), false);

  // 8. Produto com sem_oferta_quantidade: NUNCA ELEGÍVEL
  const noOfferShirt: Product = {
    ...baseShirt,
    id: "no-offer-1",
    slug: "camisa-edicao-especial",
    sem_oferta_quantidade: true,
  };
  assert.equal(isPackageEligible(noOfferShirt), false);

  // 9. Produto manual ou com ignorar_regras_preco: NUNCA ELEGÍVEL
  const manualShirt: Product = {
    ...baseShirt,
    id: "manual:123",
    slug: "camisa-manual-custom",
    ignorar_regras_preco: true,
  };
  assert.equal(isPackageEligible(manualShirt), false);
});

test("Etiqueta 'Black Friday' depende de data e some após 01/12/2026 23:59:59 (America/Sao_Paulo)", () => {
  // Durante a campanha (ex: 20 de novembro de 2026)
  const activeDate = new Date("2026-11-20T15:00:00-03:00");
  assert.equal(isBlackFridayActive(activeDate), true);
  assert.equal(getCardOfferBadge(baseShirt, activeDate), "Black Friday");

  // No último segundo da campanha (01/12/2026 23:59:59 em Brasília = 02/12/2026 02:59:59 UTC)
  const lastSecondDate = new Date("2026-12-01T23:59:59-03:00");
  assert.equal(isBlackFridayActive(lastSecondDate), true);
  assert.equal(getCardOfferBadge(baseShirt, lastSecondDate), "Black Friday");

  // Logo após o encerramento (02/12/2026 00:00:05 em Brasília)
  const expiredDate = new Date("2026-12-02T00:00:05-03:00");
  assert.equal(isBlackFridayActive(expiredDate), false);

  // Quando a promoção acaba, a etiqueta Black Friday NUNCA mais aparece
  const badgeAfterPromo = getCardOfferBadge(baseShirt, expiredDate);
  assert.notEqual(badgeAfterPromo, "Black Friday");
  // O produto torcedor comum volta a exibir a oferta de pacote
  assert.equal(badgeAfterPromo, "2 por R$ 300");

  // Uma regata NBA (que não tem pacote) fica sem etiqueta após o fim da Black Friday
  const nbaTank: Product = {
    ...baseShirt,
    id: "nba-1",
    slug: "regata-nba-lakers-lebron",
    liga: "nba",
    tipo: "regata",
    nome: "Regata NBA Lakers LeBron James",
    preco: 230,
  };
  assert.equal(getCardOfferBadge(nbaTank, activeDate), "Black Friday");
  assert.equal(getCardOfferBadge(nbaTank, expiredDate), null);
});

test("app/robots.ts bloqueia /api/ mas libera expressamente /api/yupoo-image", () => {
  const robotsConfig = robots();
  const rules = Array.isArray(robotsConfig.rules) ? robotsConfig.rules[0] : robotsConfig.rules;
  assert.ok(rules);

  const allows = Array.isArray(rules.allow) ? rules.allow : [rules.allow];
  const disallows = Array.isArray(rules.disallow) ? rules.disallow : [rules.disallow];

  assert.ok(allows.includes("/api/yupoo-image"));
  assert.ok(disallows.includes("/api/"));
});

test("Snapshot em cache e fetchSupabaseProducts mantêm NBA, Brasileirão e total íntegro de rotas", async () => {
  const cachedNba = getCachedSupabaseProducts();
  assert.ok(cachedNba.length >= 120, "Snapshot deve conter ao menos 120 produtos da NBA e manuais");
  assert.ok(cachedNba.some((p) => p.liga === "nba" && p.clubeSlug === "celtics"));
  assert.ok(cachedNba.some((p) => p.liga === "nba" && p.clubeSlug === "lakers"));

  const allProducts = await fetchSupabaseProducts();
  assert.ok(allProducts.length >= 700, "Catálogo completo deve ter mais de 700 produtos");

  // Confirma que Brasileirão Série A está presente integralmente (197 produtos)
  const brasProducts = allProducts.filter((p) => p.liga === "brasileirao-serie-a");
  assert.equal(brasProducts.length, 197, "Todos os 197 produtos do Brasileirão Série A devem estar presentes");

  // Confirma que NBA está presente
  const nbaProducts = allProducts.filter((p) => p.liga === "nba" || p.tipo === "regata");
  assert.ok(nbaProducts.length >= 120, "Regatas da NBA devem estar presentes no catálogo");
});

