import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { test } from "node:test";
import { getPackagePrice, getShippingCents } from "@/lib/commerce";
import { orderLinesSchema, paymentRequestSchema, validateOrderLines, calculateOrderTotals } from "@/lib/payment/order";
import { buildPreferenceItems } from "@/lib/payment/preference-items";
import { isValidMercadoPagoSignature, normalizedPaymentStatus } from "@/lib/server/webhook-signature";
import { products } from "@/lib/catalog";
import { classifyProduct } from "@/lib/product-classification";
import { parseSearchIntent, searchProducts } from "@/lib/smart-search";
import { patchOptions } from "@/data/patches";
import { productOverrides } from "@/data/product-overrides";

const product = products.find((entry) => classifyProduct(entry).price === 160 && entry.tamanhos.length > 0);
assert.ok(product, "O catálogo precisa ter ao menos um produto com tamanho disponível para os testes.");
const validLine = { productId: product.id, size: product.tamanhos[0], quantity: 1 };

test("calcula pacotes de camisa com preços únicos", () => {
  assert.deepEqual([1, 2, 3, 4, 5, 6].map(getPackagePrice), [160, 300, 450, 610, 750, 900]);
  assert.ok(products.filter((entry) => entry.tipo === "retro" && !/manga-longa|manga longa/i.test(entry.imageSeed + entry.nome)).every((entry) => classifyProduct(entry).price === 185));
  assert.ok(products.filter((entry) => entry.tipo === "retro" && /manga-longa|manga longa/i.test(entry.imageSeed + entry.nome)).every((entry) => classifyProduct(entry).price === 220));
});

test("retro shirts keep their R$185 price and do not receive package discounts", () => {
  const retro = products.find((entry) => entry.tipo === "retro" && !/manga-longa|manga longa/i.test(entry.imageSeed + entry.nome) && entry.tamanhos.length > 0);
  assert.ok(retro);
  const lines = validateOrderLines([{ productId: retro.id, size: retro.tamanhos[0], quantity: 2 }]);
  const totals = calculateOrderTotals(lines);
  assert.equal(totals.shirtsCents, 37000);
  assert.equal(totals.shippingCents, 3000);
  assert.equal(totals.totalCents, 40000);
  const items = buildPreferenceItems("pedido-retro", lines, totals);
  assert.equal(items.reduce((sum, item) => sum + Math.round(item.unit_price * 100) * item.quantity, 0), totals.productsTotalCents);
});

test("calcula frete fixo para 0, 1, 2, 3, 4 e 10 unidades", () => {
  assert.deepEqual([0, 1, 2, 3, 4, 10].map(getShippingCents), [0, 2000, 3000, 0, 0, 0]);
});

test("identifica intenções Home, Away, Third, versões, temporada e manga", () => {
  assert.equal(parseSearchIntent("Camisa titular do Flamengo").uniform, "titular");
  assert.equal(parseSearchIntent("Away do Real Madrid 25/26").uniform, "reserva");
  assert.equal(parseSearchIntent("Terceira camisa do Barcelona").uniform, "terceiro");
  assert.equal(parseSearchIntent("fourth Real Madrid").uniform, "quarto");
  assert.equal(parseSearchIntent("Versão jogador do Brasil").version, "player");
  assert.equal(parseSearchIntent("Retrô do Grêmio de manga longa").sleeve, "long");
  assert.equal(parseSearchIntent("SS camisa do Flamengo").sleeve, "short");
  const playerSearch = searchProducts(products, "Versão jogador do Brasil");
  assert.ok(playerSearch.results.some((entry) => entry.tipo === "jogador" && entry.nome.includes("Brasil")));
  const awaySearch = searchProducts(products, "Away do Real Madrid 25/26");
  assert.equal(awaySearch.results.length, 0);
  assert.ok(awaySearch.alternatives.some((entry) => entry.nome.includes("Real Madrid") && entry.temporada === "25/26"));

  const madrid = products.find((entry) => entry.nome.includes("Real Madrid") && entry.temporada === "25/26");
  const barcelona = products.find((entry) => entry.nome.includes("Barcelona") && entry.temporada === "25/26");
  const flamengo = products.find((entry) => entry.nome.includes("Flamengo") && entry.temporada === "25/26");
  assert.ok(madrid && barcelona && flamengo);
  const prior = [madrid, barcelona, flamengo].map((entry) => productOverrides[entry.id]);
  productOverrides[madrid.id] = { ...prior[0], uniform: "reserva", source: "https://example.com/madrid", verifiedBy: "teste" };
  productOverrides[barcelona.id] = { ...prior[1], uniform: "terceiro", source: "https://example.com/barcelona", verifiedBy: "teste" };
  productOverrides[flamengo.id] = { ...prior[2], uniform: "titular", source: "https://example.com/flamengo", verifiedBy: "teste" };
  try {
    assert.ok(searchProducts(products, "Away do Real Madrid 25/26").results.some((entry) => entry.id === madrid.id));
    assert.ok(searchProducts(products, "Third Barcelona 25/26").results.some((entry) => entry.id === barcelona.id));
    assert.ok(searchProducts(products, "Home Flamengo 25/26").results.some((entry) => entry.id === flamengo.id));
  } finally {
    [madrid, barcelona, flamengo].forEach((entry, index) => {
      if (prior[index]) productOverrides[entry.id] = prior[index];
      else delete productOverrides[entry.id];
    });
  }
});

test("não atribui preço a categorias não confirmadas", () => {
  const unknown = products.find((entry) => entry.tipo === "revisar" && entry.tamanhos.length > 0);
  assert.ok(unknown);
  assert.equal(classifyProduct(unknown).price, null);
  assert.equal(classifyProduct(unknown).reviewRequired, true);
  assert.throws(() => validateOrderLines([{ productId: unknown.id, size: unknown.tamanhos[0], quantity: 1 }]));
});

test("usa R$ 180 para torcedor full patch somente com classificação administrativa", () => {
  const original = productOverrides[product.id];
  productOverrides[product.id] = { version: "fan", fullPatch: true, source: "https://example.com", verifiedBy: "teste" };
  try {
    assert.equal(classifyProduct(product).price, 180);
  } finally {
    if (original) productOverrides[product.id] = original;
    else delete productOverrides[product.id];
  }
});

test("revalida patch compatível, preço e posição no servidor", () => {
  patchOptions.push({ id: "patch-teste", name: "Patch de teste", image: "/patches/test.svg", priceCents: 500, productIds: [product.id], seasons: [product.temporada], positions: ["manga-esquerda"], sourceUrl: "https://example.com/source", verified: true, commerciallyAvailable: true });
  try {
    const lines = validateOrderLines([{ ...validLine, patches: [{ id: "patch-teste", position: "manga-esquerda" }] }]);
    const totals = calculateOrderTotals(lines);
    assert.equal(totals.patchesCents, 500);
    assert.equal(totals.totalCents, totals.productsTotalCents + totals.shippingCents);
    const preferenceItems = buildPreferenceItems("pedido-com-patch", lines, totals);
    assert.equal(preferenceItems.reduce((sum, item) => sum + Math.round(item.unit_price * 100) * item.quantity, 0), totals.productsTotalCents);
    assert.throws(() => validateOrderLines([{ ...validLine, patches: [{ id: "patch-teste", position: "peito" }] }]));
  } finally {
    patchOptions.pop();
  }
});

test("soma quantidades de produtos e linhas diferentes para definir frete", () => {
  const other = products.find((entry) => entry.id !== product.id && classifyProduct(entry).price === 160 && entry.tamanhos.length > 0);
  assert.ok(other);
  const lines = validateOrderLines([
    { ...validLine, quantity: 1 },
    { productId: other.id, size: other.tamanhos[0], quantity: 1 },
  ]);
  const totals = calculateOrderTotals(lines);
  assert.equal(totals.shippingCents, 3000);
  assert.equal(totals.totalCents, totals.productsTotalCents + totals.shippingCents);
});

test("valida produto, tamanho e campos de linha pelo catálogo do servidor", () => {
  assert.equal(validateOrderLines([validLine])[0].product.id, product.id);
  assert.throws(() => validateOrderLines([{ ...validLine, productId: "produto-inexistente" }]));
  assert.throws(() => validateOrderLines([{ ...validLine, size: "NA" }]));
  assert.equal(orderLinesSchema.safeParse([{ ...validLine, price: 0.01 }]).success, false);
  assert.equal(orderLinesSchema.safeParse([{ ...validLine, quantity: -1 }]).success, false);
});

test("rejeita frete do navegador e checkout não depende de configuração de transportadora", () => {
  const parsed = paymentRequestSchema.safeParse({
    idempotencyKey: "c6f43356-3120-4b4d-a1da-7d3396636291", items: [validLine],
    customer: { fullName: "Teste Comprador", email: "comprador@example.com", cpf: "529.982.247-25", phone: "11999999999", cep: "01001000", street: "Rua Teste", number: "1", complement: "", neighborhood: "Centro", city: "São Paulo", state: "SP" },
    shipping: { price: 0 },
  });
  assert.equal(parsed.success, false);
  assert.equal(calculateOrderTotals(validateOrderLines([{ ...validLine, quantity: 1 }])).totalCents, 18000);
});

test("itens do Mercado Pago refletem exatamente os preços dos produtos", () => {
  const lines = validateOrderLines([{ ...validLine, quantity: 2 }]);
  const totals = calculateOrderTotals(lines);
  const items = buildPreferenceItems("pedido-teste", lines, totals);
  assert.equal(items.reduce((sum, item) => sum + Math.round(item.unit_price * 100) * item.quantity, 0), totals.productsTotalCents);
});

test("valida assinatura do webhook e converte estados de pagamento", () => {
  const secret = "webhook-test-secret", requestId = "request-123", dataId = "998877", timestamp = "1781200000";
  const manifest = `id:${dataId};request-id:${requestId};ts:${timestamp};`;
  const signature = `ts=${timestamp},v1=${createHmac("sha256", secret).update(manifest).digest("hex")}`;
  assert.equal(isValidMercadoPagoSignature({ secret, signature, requestId, dataId }), true);
  assert.equal(isValidMercadoPagoSignature({ secret, signature, requestId, dataId: "998878" }), false);
  assert.equal(normalizedPaymentStatus("approved"), "approved");
  assert.equal(normalizedPaymentStatus("in_process"), "pending");
  assert.equal(normalizedPaymentStatus("rejected"), "rejected");
});
