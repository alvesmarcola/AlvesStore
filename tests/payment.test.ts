import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { test } from "node:test";
import { getCartPricing, getPackagePrice, getProductCategoryKey, getProductOfferText, getShippingCents } from "@/lib/commerce";
import { orderLinesSchema, paymentRequestSchema, validateOrderLines as validateOrderLinesWithCatalog, calculateOrderTotals } from "@/lib/payment/order";
import { buildPreferenceItems } from "@/lib/payment/preference-items";
import { isValidMercadoPagoSignature, normalizedPaymentStatus } from "@/lib/server/webhook-signature";
import productsData from "@/data/products.json";
import { classifyProduct, isPackageEligible } from "@/lib/product-classification";
import { inferProductTypeFromSource } from "@/lib/catalog-source-classification";
import { prioritizeClubs, prioritizeEditorialProducts, sortCatalogProducts } from "@/lib/catalog-order";
import { parseSearchIntent, searchProducts } from "@/lib/smart-search";
import { patchOptions } from "@/data/patches";
import { productOverrides } from "@/data/product-overrides";
import type { Product } from "@/lib/types";

const products = (productsData as Product[]).map((entry) => ({ ...entry, tamanhos: entry.tamanhos.filter((size) => size !== "3GG") }));
const validateOrderLines = (lines: Parameters<typeof validateOrderLinesWithCatalog>[0]) => validateOrderLinesWithCatalog(lines, products);
const baseProduct = products[0]!;
const product = products.find((entry) => classifyProduct(entry).price === 160 && entry.tamanhos.length > 0)
  ?? productFixture("produto-teste-torcedor", { nome: "Camisa Clube Torcedor", tipo: "torcedor", imageSeed: "Torcedor", preco: 160, tamanhos: ["M"] }, baseProduct);
if (!products.some((entry) => entry.id === product.id)) products.push(product);
assert.ok(product, "O catálogo precisa ter ao menos um produto com tamanho disponível para os testes.");
const validLine = { productId: product.id, size: product.tamanhos[0], quantity: 1 };

function productFixture(id: string, overrides: Partial<Product>, base: Product = baseProduct): Product {
  const image = base.images?.[0];
  const imageSeed = overrides.imageSeed ?? id;
  return {
    ...base,
    ...overrides,
    id,
    slug: id,
    imageSeed,
    images: image ? [{ ...image, source: `catalogo/${imageSeed}.jpg` }] : [],
  };
}

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

test("classifica Torcedor, Ultrapasso, Full Patches e mangas sem confundir versões", () => {
  const fan = productFixture("teste-ultrapasso", { nome: "Camisa Clube Ultrapass(o)", tipo: "revisar", imageSeed: "Torcedor/Ultrapasso", preco: 160 });
  const fullPatch = productFixture("teste-full-patch", { nome: "Clube Full Patches", tipo: "revisar", imageSeed: "Torcedor/Full Patches", preco: 160 });
  const retroShort = productFixture("teste-retro-curta", { nome: "Clube Retrô manga curta", tipo: "retro", imageSeed: "Retro/Manga Curta", preco: 160 });
  const retroLong = productFixture("teste-retro-longa", { nome: "Clube Retrô manga longa", tipo: "retro", imageSeed: "Camisa Manga Longa Retrô", preco: 160 });
  const playerLong = productFixture("teste-jogador-longa", { nome: "Clube Player Version manga longa", tipo: "jogador", imageSeed: "Camisa Manga Longa Jogador", preco: 160 });
  const playerShort = productFixture("teste-jogador-curta", { nome: "Clube Player manga curta", tipo: "jogador", imageSeed: "Camisa Manga Curta Jogador", preco: 160 });
  const legacyFanLong = productFixture("teste-torcedor-longa-legado", { nome: "Clube manga longa torcedor", tipo: "inverno", imageSeed: "Camisa Manga Longa Torcedor", preco: 190 });

  assert.equal(getProductCategoryKey(fan), "torcedor");
  assert.equal(classifyProduct(fan).price, 160);
  assert.equal(getProductCategoryKey(fullPatch), "full-patch");
  assert.equal(classifyProduct(fullPatch).price, 180);
  assert.equal(classifyProduct(retroShort).price, 185);
  assert.equal(classifyProduct(retroLong).price, 220);
  assert.equal(classifyProduct(playerLong).price, 220);
  assert.equal(classifyProduct(playerShort).price, null);
  assert.equal(classifyProduct(playerShort).reviewRequired, true);
  assert.equal(classifyProduct(legacyFanLong).price, 190);
  assert.equal(isPackageEligible(legacyFanLong), false);
  assert.match(getProductOfferText(retroShort), /sem oferta por quantidade/);
  assert.match(getProductOfferText(fan), /3 por R\$ 450/);
});

test("importador respeita a categoria da pasta antes de mangas e variações", () => {
  assert.equal(inferProductTypeFromSource("Camisa Manga Longa Torcedor", "Clube 26_27.jpg"), "torcedor");
  assert.equal(inferProductTypeFromSource("Ultrapass(o)", "Clube 26_27.jpg"), "torcedor");
  assert.equal(inferProductTypeFromSource("CAMISA JOGADOR", "Clube Manga Longa 26_27.jpg"), "jogador");
  assert.equal(inferProductTypeFromSource("Camisa Manga Longa Retrô", "Clube 1995.jpg"), "retro");
});

test("preços de categorias diferentes não recebem o pacote do torcedor comum", () => {
  const retro = productFixture("teste-retro-pacote", { tipo: "retro", nome: "Clube Retrô manga curta", imageSeed: "Retro Manga Curta", preco: 160 });
  const player = productFixture("teste-player-pacote", { tipo: "jogador", nome: "Clube Player manga longa", imageSeed: "Player Manga Longa", preco: 160 });
  const fan = productFixture("teste-fan-pacote", { tipo: "torcedor", nome: "Clube Torcedor", imageSeed: "Torcedor", preco: 160 });
  const item = (catalogProduct: Product, quantity: number) => ({ lineId: `${catalogProduct.id}-M`, product: catalogProduct, size: catalogProduct.tamanhos[0], quantity });
  assert.equal(getCartPricing([item(fan, 2)]).total, 300);
  assert.equal(getCartPricing([item(retro, 2)]).total, 370);
  assert.equal(getCartPricing([item(player, 2)]).total, 440);
});

test("ordenação editorial prioriza clubes e seleções e organiza temporadas", () => {
  const lowerPriority = productFixture("time-outro", { clube: "Outro", clubeSlug: "outro", liga: "brasileirao-serie-a", temporada: "25/26", nome: "Outro 25/26", tipo: "torcedor", imageSeed: "Torcedor", preco: 160 });
  const gremio = productFixture("time-gremio", { clube: "Grêmio", clubeSlug: "gremio", liga: "brasileirao-serie-a", temporada: "26/27", nome: "Grêmio 26/27", tipo: "torcedor", imageSeed: "Torcedor", preco: 160 });
  const corinthians = productFixture("time-corinthians", { clube: "Corinthians", clubeSlug: "corinthians", liga: "brasileirao-serie-a", temporada: "25/26", nome: "Corinthians 25/26", tipo: "torcedor", imageSeed: "Torcedor", preco: 160 });
  const flamengo = productFixture("time-flamengo", { clube: "Flamengo", clubeSlug: "flamengo", liga: "brasileirao-serie-a", temporada: "24/25", nome: "Flamengo 24/25", tipo: "torcedor", imageSeed: "Torcedor", preco: 160 });
  const international = productFixture("time-internacional", { clube: "Internacional", clubeSlug: "internacional", liga: "brasileirao-serie-a", temporada: "26/27", nome: "Internacional 26/27", tipo: "torcedor", imageSeed: "Torcedor", preco: 160 });
  const prioritized = prioritizeEditorialProducts([lowerPriority, gremio, corinthians, flamengo, international], ["flamengo", "corinthians", "gremio", "internacional"], 4);
  assert.deepEqual(prioritized.map((item) => item.clubeSlug), ["flamengo", "corinthians", "gremio", "internacional"]);
  assert.deepEqual(prioritizeClubs([{ slug: "outro", popularity: 10 }, { slug: "internacional", popularity: 1 }, { slug: "flamengo", popularity: 1 }]).map((item) => item.slug), ["flamengo", "internacional", "outro"]);
  assert.equal(sortCatalogProducts([productFixture("retro-antigo", { clube: "Outro", clubeSlug: "outro", tipo: "retro", temporada: "1995", nome: "Outro Retrô 1995" }), productFixture("retro-novo", { clube: "Outro", clubeSlug: "outro", tipo: "retro", temporada: "2013", nome: "Outro Retrô 2013" })])[0].temporada, "2013");
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

test("busca encontra categoria Full Patches confirmada sem confundir patches individuais", () => {
  const fullPatch = products.find((entry) => /full.?patch|patch completo/i.test(`${entry.nome} ${entry.imageSeed} ${(entry.images ?? []).map((image) => image.source).join(" ")}`));
  if (!fullPatch) {
    const fixture = productFixture("teste-full-patch-busca", { nome: "Camisa Brasil Full Patches", tipo: "revisar", imageSeed: "Torcedor/Full Patches", preco: 160 });
    const prior = productOverrides[fixture.id];
    productOverrides[fixture.id] = { version: "fan", fullPatch: true, source: "https://example.com/full-patch", verifiedBy: "teste" };
    try {
      assert.ok(searchProducts([fixture], "Full Patches").results.some((entry) => entry.id === fixture.id));
    } finally {
      if (prior) productOverrides[fixture.id] = prior;
      else delete productOverrides[fixture.id];
    }
  } else {
    assert.equal(classifyProduct(fullPatch).fullPatch, true);
    assert.ok(searchProducts(products, "Full Patches").results.some((entry) => entry.id === fullPatch.id));
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
  patchOptions.push({ id: "patch-teste", name: "Patch de teste", image: "/patches/test.svg", priceCents: 500, productIds: [product.id], seasons: [product.temporada], positions: ["manga-esquerda"], verified: true, commerciallyAvailable: true });
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
  const other = products.find((entry) => entry.id !== product.id && classifyProduct(entry).price === 160 && entry.tamanhos.length > 0)
    ?? productFixture("produto-teste-torcedor-outro", { nome: "Outra camisa Torcedor", tipo: "torcedor", imageSeed: "Torcedor", preco: 160 }, baseProduct);
  const addToCatalog = !products.some((entry) => entry.id === other.id);
  if (addToCatalog) products.push(other);
  try {
    const lines = validateOrderLines([
      { ...validLine, quantity: 1 },
      { productId: other.id, size: other.tamanhos[0], quantity: 1 },
    ]);
    const totals = calculateOrderTotals(lines);
    assert.equal(totals.shippingCents, 3000);
    assert.equal(totals.totalCents, totals.productsTotalCents + totals.shippingCents);
  } finally {
    if (addToCatalog) products.pop();
  }
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
