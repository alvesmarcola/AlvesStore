import assert from "node:assert/strict";
import { test } from "node:test";
import { isBlackFridayEligibleShirt, isPlayerVersion, calcularPromoBlackFriday } from "@/lib/black-friday";
import { getCartPricing } from "@/lib/commerce";
import { calculateOrderTotals } from "@/lib/payment/order";
import type { Product } from "@/lib/types";

const promoDate = new Date("2026-11-20T12:00:00Z");

function createProduct(id: string, overrides: Partial<Product>): Product {
  return {
    id,
    slug: id,
    clube: "Clube Teste",
    clubeSlug: "clube-teste",
    liga: "brasileirao",
    publico: "masculino",
    tipo: "torcedor",
    temporada: "24/25",
    uniforme: "titular",
    nome: "Camisa Teste",
    preco: 160,
    tamanhos: ["P", "M", "G", "GG"],
    cor: "preto",
    imageSeed: id,
    images: [],
    ...overrides,
  };
}

// 1. Camisa tradicional de clube
const camisaClubeTradicional = createProduct("camisa-clube-tradicional", {
  nome: "Camisa Flamengo 24/25 Masculina",
  clube: "Flamengo",
  clubeSlug: "flamengo",
  tipo: "torcedor",
  preco: 160,
});

// 2. Camisa de seleção
const camisaSelecao = createProduct("camisa-selecao-brasil", {
  nome: "Camisa Brasil 24/25 Amarela",
  clube: "Brasil",
  clubeSlug: "brasil",
  liga: "selecoes",
  tipo: "torcedor",
  preco: 160,
});

// 3. Camisa feminina comum
const camisaFemininaComum = createProduct("camisa-feminina-comum", {
  nome: "Camisa Corinthians Feminina 24/25",
  clube: "Corinthians",
  clubeSlug: "corinthians",
  publico: "feminino",
  category: "feminino",
  tipo: "torcedor",
  preco: 160,
});

// 4. Camisa de treino
const camisaTreino = createProduct("camisa-treino-clube", {
  nome: "Camisa São Paulo Treino 24/25",
  clube: "São Paulo",
  clubeSlug: "sao-paulo",
  tipo: "treino",
  preco: 160,
});

// 5. Camisa versão jogador (não elegível)
const camisaJogador = createProduct("camisa-jogador-real-madrid", {
  nome: "Camisa Real Madrid 24/25 Jogador",
  clube: "Real Madrid",
  clubeSlug: "real-madrid",
  tipo: "jogador",
  preco: 220,
});

const camisaPlayerVersion = createProduct("camisa-barcelona-player-version", {
  nome: "Camisa Barcelona 24/25 Player Version",
  clube: "Barcelona",
  clubeSlug: "barcelona",
  tipo: "revisar",
  description: "Tecido tecnológico modelo atleta de jogo",
  preco: 220,
});

// Regata NBA (produto ativador)
const regataNba = createProduct("regata-nba-celtics", {
  nome: "Regata NBA Boston Celtics #0 Jayson Tatum",
  clube: "Celtics",
  clubeSlug: "celtics",
  liga: "nba",
  tipo: "regata",
  preco: 230,
});

test("Cenário 1: Camisa tradicional de clube é elegível para a promoção de 50%", () => {
  assert.equal(isPlayerVersion(camisaClubeTradicional), false);
  assert.equal(isBlackFridayEligibleShirt(camisaClubeTradicional), true);
});

test("Cenário 2: Camisa de seleção é elegível para a promoção de 50%", () => {
  assert.equal(isPlayerVersion(camisaSelecao), false);
  assert.equal(isBlackFridayEligibleShirt(camisaSelecao), true);
});

test("Cenário 3: Camisa feminina comum é elegível para a promoção de 50%", () => {
  assert.equal(isPlayerVersion(camisaFemininaComum), false);
  assert.equal(isBlackFridayEligibleShirt(camisaFemininaComum), true);
});

test("Cenário 4: Camisa de treino é elegível para a promoção de 50%", () => {
  assert.equal(isPlayerVersion(camisaTreino), false);
  assert.equal(isBlackFridayEligibleShirt(camisaTreino), true);
});

test("Cenário 5: Camisa versão jogador NÃO é elegível para a promoção de 50%", () => {
  assert.equal(isPlayerVersion(camisaJogador), true);
  assert.equal(isBlackFridayEligibleShirt(camisaJogador), false);

  assert.equal(isPlayerVersion(camisaPlayerVersion), true);
  assert.equal(isBlackFridayEligibleShirt(camisaPlayerVersion), false);
});

test("Cenário 6: Carrinho com produtos elegíveis e não elegíveis aplica desconto de 50% somente aos elegíveis", () => {
  // Carrinho com 1 Regata NBA + 1 Versão Jogador + 1 Camisa de Treino
  // Regata ativa 1 desconto de 50%.
  // A camisa de jogador NÃO deve receber desconto.
  // A camisa de treino DEVE receber 50% de desconto (R$ 80 de desconto em R$ 160).
  const cartItems = [
    { lineId: "line-nba", product: regataNba, quantity: 1, size: "M" },
    { lineId: "line-jogador", product: camisaJogador, quantity: 1, size: "M" },
    { lineId: "line-treino", product: camisaTreino, quantity: 1, size: "M" },
  ];

  const promoResult = calcularPromoBlackFriday(cartItems, promoDate);
  assert.equal(promoResult.ativa, true);
  assert.equal(promoResult.desconto, 85, "Desconto deve ser exatamente R$ 85 (50% da camisa de treino R$ 170)");
  assert.equal(promoResult.itensComDesconto.length, 1);
  assert.equal(promoResult.itensComDesconto[0].itemIndex, 2, "Apenas a camisa de treino (índice 2) recebe desconto");
  assert.equal(promoResult.itensComDesconto[0].discountPerUnitCents, 8500);

  // Validação no carrinho (getCartPricing)
  const cartPricing = getCartPricing(cartItems);
  assert.equal(cartPricing.promoDiscount, 85);

  // Validação no servidor (calculateOrderTotals)
  const orderLines = cartItems.map((c) => ({
    ...c,
    unitPriceCents: c.product.preco * 100,
    patchOptions: [],
  }));
  const orderTotals = calculateOrderTotals(orderLines as any, promoDate);
  assert.equal(orderTotals.promoDiscountCents, 8500, "Servidor deve calcular R$ 85 de desconto promocional");
});

test("Desconto não é aplicado duas vezes ao mesmo produto e prioriza maior valor elegível", () => {
  // 1 Regata NBA + 1 Camisa Seleção (R$ 170) + 1 Camisa Clube (R$ 170)
  // Como só há 1 regata, apenas 1 camisa recebe 50% de desconto (R$ 85). A outra permanece R$ 170 integral.
  const cartItems = [
    { lineId: "line-nba", product: regataNba, quantity: 1, size: "M" },
    { lineId: "line-selecao", product: camisaSelecao, quantity: 1, size: "M" },
    { lineId: "line-clube", product: camisaClubeTradicional, quantity: 1, size: "M" },
  ];

  const promoResult = calcularPromoBlackFriday(cartItems, promoDate);
  assert.equal(promoResult.desconto, 85, "1 Regata NBA concede exatamente 1 desconto de 50%");
  assert.equal(promoResult.itensComDesconto.length, 1, "Apenas 1 item recebe desconto");

  // Agora com 2 Regatas NBA + as mesmas 2 camisas elegíveis:
  // Ambas as camisas recebem 50% de desconto (R$ 85 + R$ 85 = R$ 170 total).
  const cartItemsTwoNba = [
    { lineId: "line-nba", product: regataNba, quantity: 2, size: "M" },
    { lineId: "line-selecao", product: camisaSelecao, quantity: 1, size: "M" },
    { lineId: "line-clube", product: camisaClubeTradicional, quantity: 1, size: "M" },
  ];

  const promoResultTwo = calcularPromoBlackFriday(cartItemsTwoNba, promoDate);
  assert.equal(promoResultTwo.desconto, 170, "2 Regatas NBA concedem 2 descontos de 50%");
  assert.equal(promoResultTwo.itensComDesconto.length, 2);
});
