import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { test } from "node:test";
import { getCartPricing, getPackagePrice, getProductCategoryKey, getProductOfferText, getShippingCents } from "@/lib/commerce";
import { calcularPromoBlackFriday } from "@/lib/black-friday";
import { toCatalogPreview } from "@/lib/catalog";
import { orderLinesSchema, paymentRequestSchema, validateOrderLines as validateOrderLinesWithCatalog, validateOrderLinesFromCatalog, calculateOrderTotals, InvalidOrderError } from "@/lib/payment/order";
import { buildPreferenceItems } from "@/lib/payment/preference-items";
import { isValidMercadoPagoSignature, normalizedPaymentStatus } from "@/lib/server/webhook-signature";
import { getCheckoutUrl, getPaymentEnvironment, PaymentConfigurationError, resolveSiteUrl, validateMercadoPagoAccessToken } from "@/lib/server/mercado-pago";
import { clearCheckoutAttempt, fingerprintCheckoutAttempt, getCheckoutAttemptKey } from "@/lib/payment/checkout-attempt";
import { validateMercadoPagoPayment } from "@/lib/payment/mercado-pago-validation";
import productsData from "@/data/products.json";
import { classifyProduct, getProductUnitPrice, isPackageEligible } from "@/lib/product-classification";
import { getAvailablePatches } from "@/lib/patch-compatibility";
import { isCompleteOrderCode, normalizeOrderCodeInput, orderCode } from "@/lib/order-code";
import { buildOrderPaidEmail, buildOrderReceivedEmail } from "@/lib/server/order-emails";
import { sendWhatsAppOrderNotice, type OrderNotice } from "@/lib/server/order-notifications";
import { getAdminAuthFailure } from "@/lib/server/admin-auth";
import {
  ADMIN_SESSION_COOKIE,
  createAdminSessionValue,
  getAdminAuthFailure as authorizeAdminRequest,
  isValidAdminSessionValue,
} from "@/lib/server/admin-auth";
import { DELETE as logoutAdmin, GET as checkAdminSession, POST as loginAdmin } from "@/app/api/admin/session/route";
import { GET as getAdminSummary } from "@/app/api/admin/summary/route";
import { isRateLimited } from "@/lib/server/rate-limit";
import { inferProductTypeFromSource } from "@/lib/catalog-source-classification";
import { prioritizeClubs, prioritizeEditorialProducts, sortCatalogProducts } from "@/lib/catalog-order";
import { parseSearchIntent, searchProducts } from "@/lib/smart-search";
import { patchOptions } from "@/data/patches";
import { productOverrides } from "@/data/product-overrides";
import { allowsCustomization, isJacketFormulaOneProduct } from "@/lib/formula-one";
import { getBundledFormulaOneProducts } from "@/lib/server/supabase-catalog";
import { manualProductSchema } from "@/lib/admin/product-validation";
import { filterPublicReviews, publicReviewsPayload, reviewSubmissionSchema, sanitizeReviewText } from "@/lib/reviews";
import { filterCustomizationNumber, formatCustomization, getCustomizationError, sanitizeCustomizationName } from "@/lib/customization";
import { GET as getAdminReviews } from "@/app/api/admin/reviews/route";
import { POST as createCheckout } from "@/app/api/checkout/route";
import { POST as mercadoPagoWebhook } from "@/app/api/mercado-pago/webhook/route";
import { POST as trackOrder } from "@/app/api/orders/track/route";
import { isValidProductImage } from "@/lib/server/image-upload-validation";
import { GET as getYupooImage } from "@/app/api/yupoo-image/route";
import { storeConfig } from "@/config";
import { getInstagramFeed } from "@/lib/instagram";
import { getPersistedCartItems } from "@/lib/cart-persistence";
import type { Product } from "@/lib/types";

const products = (productsData as Product[]).map((entry) => ({ ...entry, tamanhos: entry.tamanhos.filter((size) => size !== "3GG") }));
const validateOrderLines = (lines: Parameters<typeof validateOrderLinesWithCatalog>[0]) => validateOrderLinesWithCatalog(lines, products);
const baseProduct = products[0]!;
const product = products.find((entry) => classifyProduct(entry).price === storeConfig.fanCommonPrice && entry.tamanhos.length > 0 && entry.tipo === "torcedor")
  ?? productFixture("produto-teste-torcedor", { nome: "Camisa Clube Torcedor", tipo: "torcedor", imageSeed: "Torcedor", preco: storeConfig.fanCommonPrice, tamanhos: ["M"] }, baseProduct);
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
  assert.deepEqual([1, 2, 3, 4, 5, 6].map(getPackagePrice), [170, 300, 450, 620, 750, 900]);
  assert.ok(products.filter((entry) => entry.tipo === "retro" && !/manga-longa|manga longa/i.test(entry.imageSeed + entry.nome)).every((entry) => classifyProduct(entry).price === 185));
  assert.ok(products.filter((entry) => entry.tipo === "retro" && /manga-longa|manga longa/i.test(entry.imageSeed + entry.nome)).every((entry) => classifyProduct(entry).price === 220));
});

test("retro shirts keep their R$185 price and do not receive package discounts", () => {
  const retro = products.find((entry) => entry.tipo === "retro" && !/manga-longa|manga longa/i.test(entry.imageSeed + entry.nome) && entry.tamanhos.length > 0);
  assert.ok(retro);
  const lines = validateOrderLines([{ productId: retro.id, size: retro.tamanhos[0], quantity: 2 }]);
  const totals = calculateOrderTotals(lines);
  assert.equal(totals.shirtsCents, 37000);
  assert.equal(totals.shippingCents, 2000);
  assert.equal(totals.totalCents, 39000);
  const items = buildPreferenceItems("pedido-retro", lines, totals);
  assert.equal(items.reduce((sum, item) => sum + Math.round(item.unit_price * 100) * item.quantity, 0), totals.productsTotalCents);
});

test("classifica Torcedor, Ultrapasso, Full Patches e mangas sem confundir versões", () => {
  const fan = productFixture("teste-ultrapasso", { nome: "Camisa Clube Ultrapass(o)", tipo: "torcedor", imageSeed: "Torcedor/Ultrapasso", preco: 160 });
  const fullPatch = productFixture("teste-full-patch", { nome: "Clube Full Patches", tipo: "revisar", imageSeed: "Torcedor/Full Patches", preco: 160 });
  const retroShort = productFixture("teste-retro-curta", { nome: "Clube Retrô manga curta", tipo: "retro", imageSeed: "Retro/Manga Curta", preco: 160 });
  const retroLong = productFixture("teste-retro-longa", { nome: "Clube Retrô manga longa", tipo: "retro", imageSeed: "Camisa Manga Longa Retrô", preco: 160 });
  const playerLong = productFixture("teste-jogador-longa", { nome: "Clube Player Version manga longa", tipo: "jogador", imageSeed: "Camisa Manga Longa Jogador", preco: 160 });
  const playerShort = productFixture("teste-jogador-curta", { nome: "Clube Player manga curta", tipo: "jogador", imageSeed: "Camisa Manga Curta Jogador", preco: 160 });
  const legacyFanLong = productFixture("teste-torcedor-longa-legado", { nome: "Clube manga longa torcedor", tipo: "inverno", imageSeed: "Camisa Manga Longa Torcedor", preco: 190 });

  assert.equal(getProductCategoryKey(fan), "torcedor");
  assert.equal(classifyProduct(fan).price, 170);

  assert.equal(getProductCategoryKey(fullPatch), "full-patch");
  assert.equal(classifyProduct(fullPatch).price, null);
  assert.equal(classifyProduct(fullPatch).reviewRequired, true);
  assert.equal(classifyProduct(retroShort).price, 185);
  assert.equal(classifyProduct(retroLong).price, 220);
  assert.equal(classifyProduct(playerLong).price, 220);
  assert.equal(classifyProduct(playerShort).price, 190);
  assert.equal(classifyProduct(playerShort).reviewRequired, false);
  assert.equal(classifyProduct(legacyFanLong).price, 190);
  assert.equal(isPackageEligible(legacyFanLong), false);
  assert.match(getProductOfferText(retroShort), /sem oferta por quantidade/);
  assert.match(getProductOfferText(fan), /3 por R\$ 450/);
});

test("promo Black Friday NBA aplica pares, prioriza maior preço e não dá desconto em adicionais", () => {
  const promoDate = new Date("2026-11-05T12:00:00-03:00");
  const nbaTankTop = productFixture("regata-nba-teste", {
    nome: "Regata NBA",
    tipo: "regata",
    liga: "nba",
    league: "NBA",
    publico: "masculino",
    preco: 999,
    tamanhos: ["M"],
  });
  const fan = productFixture("camisa-torcedor-teste", {
    nome: "Camisa Clube Torcedor",
    tipo: "torcedor",
    publico: "masculino",
    imageSeed: "Torcedor",
    preco: 160,
    tamanhos: ["M"],
  });
  const premiumFan = productFixture("camisa-torcedor-longa-teste", {
    nome: "Camisa Clube Torcedor Manga Longa",
    tipo: "torcedor",
    publico: "masculino",
    imageSeed: "Torcedor Manga Longa",
    preco: 190,
    tamanhos: ["M"],
  });
  const kid = productFixture("camisa-infantil-teste", {
    nome: "Camisa Infantil Clube",
    tipo: "torcedor",
    publico: "infantil",
    imageSeed: "Infantil",
    preco: 160,
    tamanhos: ["M"],
  });
  const cartItem = (item: Product, quantity = 1, customization?: { name: string; number: string }) => ({
    lineId: item.id, product: item, size: "M", quantity, customization,
  });

  assert.equal(classifyProduct(nbaTankTop).price, storeConfig.nbaTankTopPrice);
  assert.match(getProductOfferText(nbaTankTop), /Regata NBA.*230,00/);
  assert.equal(classifyProduct(fan).price, storeConfig.fanCommonPrice);
  assert.equal(classifyProduct(kid).price, storeConfig.kidsPrice);
  assert.equal(calcularPromoBlackFriday([cartItem(nbaTankTop)], promoDate).desconto, 0);
  assert.equal(calcularPromoBlackFriday([cartItem(fan)], promoDate).desconto, 0);
  assert.equal(getCartPricing([cartItem(nbaTankTop)]).grandTotal, 250);
  assert.equal(getCartPricing([cartItem(fan)]).grandTotal, 190);
  const cartPair = getCartPricing([cartItem(nbaTankTop), cartItem(fan)]);
  assert.equal(cartPair.promoDiscount, 85);
  assert.equal(cartPair.grandTotal, 335);
  assert.equal(cartPair.bundleDiscount, 0);
  assert.equal(getCartPricing([cartItem(nbaTankTop), cartItem(fan, 2)]).grandTotal, 485);
  assert.equal(getCartPricing([cartItem(nbaTankTop, 2), cartItem(fan, 2)]).grandTotal, 630);
  assert.equal(getCartPricing([cartItem(nbaTankTop), cartItem(kid)]).promoDiscount, 0);
  assert.equal(getCartPricing([cartItem(nbaTankTop), cartItem(kid)]).grandTotal, 430);

  const onePair = validateOrderLinesWithCatalog([
    { productId: nbaTankTop.id, size: "M", quantity: 1 },
    { productId: fan.id, size: "M", quantity: 1 },
  ], [nbaTankTop, fan]);
  const onePairTotals = calculateOrderTotals(onePair, promoDate);
  assert.equal(onePairTotals.promoDiscountCents, 8500);
  assert.equal(onePairTotals.shirtsCents, 31500);
  assert.equal(onePairTotals.totalCents, 33500);
  assert.equal(buildPreferenceItems("bf-1-1", onePair, onePairTotals)
    .reduce((sum, item) => sum + Math.round(item.unit_price * 100) * item.quantity, 0), onePairTotals.productsTotalCents);

  const oneRegataTwoShirts = validateOrderLinesWithCatalog([
    { productId: nbaTankTop.id, size: "M", quantity: 1 },
    { productId: fan.id, size: "M", quantity: 2 },
  ], [nbaTankTop, fan]);
  const oneRegataTwoShirtsTotals = calculateOrderTotals(oneRegataTwoShirts, promoDate);
  assert.equal(oneRegataTwoShirtsTotals.promoDiscountCents, 8500);
  assert.equal(oneRegataTwoShirtsTotals.shirtsCents, 48500);
  assert.equal(oneRegataTwoShirtsTotals.bundleDiscountCents, 0);

  const twoPairs = validateOrderLinesWithCatalog([
    { productId: nbaTankTop.id, size: "M", quantity: 2 },
    { productId: fan.id, size: "M", quantity: 2 },
  ], [nbaTankTop, fan]);
  const twoPairTotals = calculateOrderTotals(twoPairs, promoDate);
  assert.equal(twoPairTotals.promoDiscountCents, 17000);
  assert.equal(twoPairTotals.shirtsCents, 63000);
  assert.equal(buildPreferenceItems("bf-2-2", twoPairs, twoPairTotals)
    .reduce((sum, item) => sum + Math.round(item.unit_price * 100) * item.quantity, 0), twoPairTotals.productsTotalCents);

  const customizedPair = validateOrderLinesWithCatalog([
    { productId: nbaTankTop.id, size: "M", quantity: 1 },
    { productId: fan.id, size: "M", quantity: 1, customization: { name: "ANA", number: "10" } },
  ], [nbaTankTop, fan]);
  const customizedTotals = calculateOrderTotals(customizedPair, promoDate);
  assert.equal(customizedTotals.customizationCents, 3990);
  assert.equal(customizedTotals.productsTotalCents, 35490);
  assert.equal(buildPreferenceItems("bf-custom", customizedPair, customizedTotals)
    .reduce((sum, item) => sum + Math.round(item.unit_price * 100) * item.quantity, 0), customizedTotals.productsTotalCents);

  // Regatas NBA rejeitam personalização de nome e número
  assert.equal(allowsCustomization(nbaTankTop), false);
  assert.throws(
    () => validateOrderLinesWithCatalog([
      { productId: nbaTankTop.id, size: "M", quantity: 1, customization: { name: "CURRY", number: "30" } },
    ], [nbaTankTop]),
    (error: any) => error instanceof InvalidOrderError && error.message === "Regatas NBA não aceitam personalização de nome e número.",
  );

  // Preço da regata NBA ignora valor arbitrário do cadastro (ex.: 240) e usa nbaTankTopPrice (230)
  const nbaTankTopWithCustomPrice = productFixture("nba-tank-240", {
    nome: "Regata NBA Los Angeles Lakers",
    tipo: "regata",
    liga: "nba",
    clube: "Lakers",
    preco: 240,
    tamanhos: ["M"],
  });
  assert.equal(classifyProduct(nbaTankTopWithCustomPrice).price, 230);
  assert.equal(getProductUnitPrice(nbaTankTopWithCustomPrice, "M"), 230);

  const kidPair = validateOrderLinesWithCatalog([
    { productId: nbaTankTop.id, size: "M", quantity: 1 },
    { productId: kid.id, size: "M", quantity: 1 },
  ], [nbaTankTop, kid]);
  assert.equal(calculateOrderTotals(kidPair, promoDate).promoDiscountCents, 0);

  const preferred = calcularPromoBlackFriday([
    cartItem(nbaTankTop),
    cartItem(fan),
    cartItem(premiumFan),
  ], promoDate);
  assert.equal(preferred.desconto, 95);
  assert.deepEqual(preferred.itensComDesconto.map((item) => item.itemIndex), [2]);

  const expiredAtBrasilia = new Date("2026-12-02T02:59:59.999Z");
  const afterExpiry = new Date("2026-12-02T03:00:00.000Z");
  assert.equal(calcularPromoBlackFriday([cartItem(nbaTankTop), cartItem(fan)], expiredAtBrasilia).ativa, true);
  assert.equal(calcularPromoBlackFriday([cartItem(nbaTankTop), cartItem(fan)], afterExpiry).desconto, 0);
  assert.equal(calculateOrderTotals(onePair, afterExpiry).promoDiscountCents, 0);
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
  assert.deepEqual([0, 1, 2, 3, 4, 10].map(getShippingCents), [0, 2000, 2000, 0, 0, 0]);
});

test("camisa de Fórmula 1 tem tamanhos, mas não aceita personalização", () => {
  const f1 = productFixture("teste-f1", { nome: "Red Bull 26/27 Home Jersey", tipo: "formula1", imageSeed: "F1", preco: 160, tamanhos: ["M"] });
  products.push(f1);
  try {
    assert.doesNotThrow(() => validateOrderLines([{ productId: f1.id, size: "M", quantity: 1 }]));
    assert.throws(() => validateOrderLines([{ productId: f1.id, size: "M", quantity: 1, customization: { name: "ALEX", number: "10" } }]), /Fórmula 1/);
  } finally {
    products.pop();
  }
});

test("somente produtos F1 com Jacket no nome ou título ficam indisponíveis", () => {
  const jacket = productFixture("f1-jacket", {
    nome: "Ferrari Racing Jacket",
    tipo: "f1",
    imageSeed: "ferrari-racing",
  });
  const nonF1Jacket = productFixture("casual-jacket", {
    nome: "Racing Jacket",
    tipo: "torcedor",
    imageSeed: "casual-jacket",
  });
  const normalF1 = productFixture("f1-shirt", {
    nome: "Ferrari Racing Polo",
    tipo: "f1",
    imageSeed: "ferrari-racing",
  });
  const titleJacket = { ...normalF1, title: "Ferrari Jacket" };

  assert.equal(isJacketFormulaOneProduct(jacket), true);
  assert.equal(isJacketFormulaOneProduct(titleJacket), true);
  assert.equal(isJacketFormulaOneProduct(nonF1Jacket), false);
  assert.equal(isJacketFormulaOneProduct(normalF1), false);
});

test("catálogo F1 publicado omite Jacket e mantém os demais produtos", () => {
  const f1Products = getBundledFormulaOneProducts();
  assert.ok(f1Products.length > 0);
  assert.equal(f1Products.some(isJacketFormulaOneProduct), false);
  assert.ok(f1Products.some((item) => item.nome.includes("Ferrari") && !/jacket/i.test(item.nome)));
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
  const fourthSearch = searchProducts(products, "fourth Real Madrid 25/26");
  assert.equal(fourthSearch.results.length, 0);
  assert.ok(fourthSearch.alternatives.some((entry) => entry.nome.includes("Real Madrid") && entry.temporada === "25/26"));

  const madrid = products.find((entry) => entry.nome.includes("Real Madrid") && entry.temporada === "25/26");
  const barcelona = products.find((entry) => entry.nome.includes("Barcelona") && entry.temporada === "25/26");
  const flamengo = products.find((entry) => entry.nome.includes("Flamengo") && entry.temporada === "25/26");
  assert.ok(madrid && barcelona && flamengo);
  const prior = [madrid, barcelona, flamengo].map((entry) => productOverrides[entry.id]);
  productOverrides[madrid.id] = { ...prior[0], uniform: "quarto", source: "https://example.com/madrid", verifiedBy: "teste" };
  productOverrides[barcelona.id] = { ...prior[1], uniform: "terceiro", source: "https://example.com/barcelona", verifiedBy: "teste" };
  productOverrides[flamengo.id] = { ...prior[2], uniform: "titular", source: "https://example.com/flamengo", verifiedBy: "teste" };
  try {
    assert.ok(searchProducts(products, "fourth Real Madrid 25/26").results.some((entry) => entry.id === madrid.id));
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

test("patches custam R$ 10 cada, respeitam a liga e não aparecem em retrô nem F1", () => {
  const brasileiro = productFixture("teste-patch-brasileirao", { nome: "Clube Torcedor", tipo: "torcedor", liga: "brasileirao-serie-a", clubeSlug: "clube-teste", temporada: "26/27", imageSeed: "Torcedor", preco: 160, tamanhos: ["M"] });
  const europeu = productFixture("teste-patch-europeu", { nome: "Clube Torcedor", tipo: "torcedor", liga: "premier-league", clubeSlug: "clube-europeu", temporada: "26/27", imageSeed: "Torcedor", preco: 160, tamanhos: ["M"] });
  const retro = productFixture("teste-patch-retro", { nome: "Clube Retrô manga curta", tipo: "retro", liga: "brasileirao-serie-a", clubeSlug: "clube-teste", imageSeed: "Retro Manga Curta", preco: 185, tamanhos: ["M"] });
  const f1 = productFixture("teste-patch-f1", { nome: "Red Bull F1", tipo: "formula1", liga: "brasileirao-serie-a", clubeSlug: "red-bull", imageSeed: "F1", preco: 160, tamanhos: ["M"] });
  const campeao = productFixture("teste-patch-campeao", { nome: "Argentina Torcedor", tipo: "torcedor", liga: "selecoes", clubeSlug: "argentina", temporada: "26/27", imageSeed: "Torcedor", preco: 160, tamanhos: ["M"] });
  const names = (item: Product) => getAvailablePatches(item).map((patch) => patch.id).sort();

  assert.deepEqual(names(brasileiro), ["brasileirao", "copa-do-brasil", "libertadores"]);
  assert.deepEqual(names(europeu), ["champions-league"]);
  assert.deepEqual(names(campeao), ["campeao-do-mundo"]);
  assert.deepEqual(names(retro), []);
  assert.deepEqual(names(f1), []);
  assert.ok(getAvailablePatches(brasileiro).every((patch) => patch.priceCents === 1000));

  products.push(brasileiro);
  try {
    const lines = validateOrderLines([{ productId: brasileiro.id, size: "M", quantity: 2, patches: [{ id: "brasileirao", position: "manga-esquerda" }, { id: "libertadores", position: "manga-esquerda" }] }]);
    const totals = calculateOrderTotals(lines);
    assert.equal(totals.patchesCents, 4000); // 2 patches x R$ 10 x 2 camisas
    assert.equal(totals.productsTotalCents, totals.shirtsCents + 4000);
    assert.equal(getCartPricing([{ lineId: "x", product: brasileiro, size: "M", quantity: 2, patches: [{ id: "brasileirao", position: "manga-esquerda" }, { id: "libertadores", position: "manga-esquerda" }] }]).total, 300 + 40);
    assert.throws(() => validateOrderLines([{ productId: brasileiro.id, size: "M", quantity: 1, patches: [{ id: "champions-league", position: "manga-esquerda" }] }]));
    const items = buildPreferenceItems("pedido-patches", lines, totals);
    assert.equal(items.reduce((sum, item) => sum + Math.round(item.unit_price * 100) * item.quantity, 0), totals.productsTotalCents);
  } finally {
    products.pop();
  }
});

test("soma quantidades de produtos e linhas diferentes para definir frete", () => {
  const other = products.find((entry) => entry.id !== product.id && classifyProduct(entry).price === storeConfig.fanCommonPrice && entry.tamanhos.length > 0)
    ?? productFixture("produto-teste-torcedor-outro", { nome: "Outra camisa Torcedor", tipo: "torcedor", imageSeed: "Torcedor", preco: 160 }, baseProduct);
  const addToCatalog = !products.some((entry) => entry.id === other.id);
  if (addToCatalog) products.push(other);
  try {
    const lines = validateOrderLines([
      { ...validLine, quantity: 1 },
      { productId: other.id, size: other.tamanhos[0], quantity: 1 },
    ]);
    const totals = calculateOrderTotals(lines);
    assert.equal(totals.shippingCents, 2000);
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

test("vitrine usa slug público no lugar do ID interno e checkout resolve pelo slug", () => {
  const internalProduct = {
    ...product,
    id: "database-internal-id",
    stock_by_size: { M: 2 },
    supplier_name: "Fornecedor privado",
    supplier_cost: 50,
  };
  const publicProduct = toCatalogPreview(internalProduct);
  assert.equal(publicProduct.id, product.slug);
  assert.equal(publicProduct.stock_by_size, undefined);
  assert.equal(publicProduct.supplier_name, undefined);
  assert.equal(publicProduct.supplier_cost, undefined);

  const [verified] = validateOrderLinesWithCatalog([{
    productId: publicProduct.id,
    size: product.tamanhos[0]!,
    quantity: 1,
  }], [internalProduct]);
  assert.equal(verified?.product.id, "database-internal-id");
});

test("checkout não usa o catálogo empacotado se a configuração live do Supabase estiver ausente", async () => {
  const keys = ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "NEXT_PUBLIC_SUPABASE_ANON_KEY"] as const;
  const previous = new Map(keys.map((key) => [key, process.env[key]]));
  try {
    for (const key of keys) delete process.env[key];
    await assert.rejects(validateOrderLinesFromCatalog([validLine]), /catálogo atual do Supabase/);
  } finally {
    for (const [key, value] of previous) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

test("personalização aceita nome, número ou ambos e rejeita combinações inválidas no servidor", () => {
  for (const customization of [
    { name: "ANA", number: "" },
    { name: "", number: "7" },
    { name: "ANA", number: "123" },
  ]) {
    assert.equal(orderLinesSchema.safeParse([{ ...validLine, customization }]).success, true);
  }
  const empty = orderLinesSchema.safeParse([{ ...validLine, customization: { name: "", number: "" } }]);
  assert.equal(empty.success, false);
  if (!empty.success) assert.equal(empty.error.issues[0]?.message, "Informe o nome, o número ou os dois.");
  for (const number of ["1A", "1!", "1234"]) {
    assert.equal(orderLinesSchema.safeParse([{ ...validLine, customization: { name: "ANA", number } }]).success, false);
  }
  assert.equal(sanitizeCustomizationName("  <b>ANA</b>  "), "ANA");
  assert.equal(filterCustomizationNumber("1a!23"), "123");
  assert.equal(filterCustomizationNumber("1234"), "123");
  assert.equal(orderLinesSchema.safeParse([{ ...validLine, customization: { name: "<b>ANA</b>", number: "" } }]).success, true);
});

test("a rota de checkout rejeita personalização ativa vazia com mensagem amigável", async () => {
  const idempotencyKey = "c6f43356-3120-4b4d-a1da-7d3396636291";
  const response = await createCheckout(new Request("https://loja.test/api/checkout", {
    method: "POST",
    headers: { "content-type": "application/json", "idempotency-key": idempotencyKey },
    body: JSON.stringify({
      idempotencyKey,
      items: [{ ...validLine, customization: { name: "", number: "" } }],
      customer: {
        whatsappUpdates: false,
        fullName: "Teste Comprador",
        email: "comprador@example.com",
        cpf: "529.982.247-25",
        phone: "11999999999",
        cep: "01001000",
        street: "Rua Teste",
        number: "1",
        complement: "",
        neighborhood: "Centro",
        city: "São Paulo",
        state: "SP",
      },
    }),
  }));
  assert.equal(response.status, 400);
  assert.equal((await response.json()).error, "Informe o nome, o número ou os dois.");
});

test("personalização só cobra uma vez por camisa quando há nome ou número", () => {
  const noCustomization = validateOrderLines([{ ...validLine, quantity: 2 }]);
  const nameOnly = validateOrderLines([{ ...validLine, quantity: 2, customization: { name: "ANA", number: "" } }]);
  const numberOnly = validateOrderLines([{ ...validLine, quantity: 2, customization: { name: "", number: "99" } }]);
  assert.equal(calculateOrderTotals(noCustomization).customizationCents, 0);
  assert.equal(calculateOrderTotals(nameOnly).customizationCents, 2 * Math.round(storeConfig.customizationPrice * 100));
  assert.equal(calculateOrderTotals(numberOnly).customizationCents, 2 * Math.round(storeConfig.customizationPrice * 100));

  const cartItem = { lineId: "personalizado", product, size: validLine.size, quantity: 1, customization: { name: "ANA", number: "" } };
  const plainCartItem = { ...cartItem, customization: undefined };
  assert.equal(Math.round((getCartPricing([cartItem]).grandTotal - getCartPricing([plainCartItem]).grandTotal) * 100), Math.round(storeConfig.customizationPrice * 100));
  assert.equal(getCartPricing([{ ...plainCartItem, customization: { name: "", number: "" } }]).grandTotal, getCartPricing([plainCartItem]).grandTotal);
});

test("carrinho, pedido e e-mail mostram somente os campos de personalização preenchidos", () => {
  assert.equal(getCustomizationError(true, { name: "", number: "" }), "Informe o nome, o número ou os dois.");
  assert.equal(getCustomizationError(false, { name: "", number: "" }), "");
  assert.equal(getCustomizationError(true, { name: "ANA", number: "" }), "");
  assert.equal(formatCustomization({ name: "ANA", number: "" }), "Nome: ANA");
  assert.equal(formatCustomization({ name: "", number: "10" }), "Número: 10");
  assert.equal(formatCustomization({ name: "ANA", number: "10" }), "Nome: ANA · Número: 10");
  assert.equal(formatCustomization({ name: "", number: "" }), "");
});

test("rejeita frete do navegador e checkout não depende de configuração de transportadora", () => {
  const parsed = paymentRequestSchema.safeParse({
    idempotencyKey: "c6f43356-3120-4b4d-a1da-7d3396636291", items: [validLine],
    customer: { fullName: "Teste Comprador", email: "comprador@example.com", cpf: "529.982.247-25", phone: "11999999999", cep: "01001000", street: "Rua Teste", number: "1", complement: "", neighborhood: "Centro", city: "São Paulo", state: "SP" },
    shipping: { price: 0 },
  });
  assert.equal(parsed.success, false);
  assert.equal(calculateOrderTotals(validateOrderLines([{ ...validLine, quantity: 1 }])).totalCents, 19000);
});

test("itens do Mercado Pago refletem exatamente os preços dos produtos", () => {
  const lines = validateOrderLines([{ ...validLine, quantity: 2 }]);
  const totals = calculateOrderTotals(lines);
  const items = buildPreferenceItems("pedido-teste", lines, totals);
  assert.equal(items.reduce((sum, item) => sum + Math.round(item.unit_price * 100) * item.quantity, 0), totals.productsTotalCents);
});

test("Mercado Pago exige ambiente explícito e aceita somente test ou production", () => {
  const priorEnvironment = process.env.PAYMENT_ENVIRONMENT;
  try {
    process.env.PAYMENT_ENVIRONMENT = "test";
    assert.equal(getPaymentEnvironment(), "test");
    process.env.PAYMENT_ENVIRONMENT = "production";
    assert.equal(getPaymentEnvironment(), "production");

    for (const invalid of ["", "TEST", "sandbox", "live"]) {
      process.env.PAYMENT_ENVIRONMENT = invalid;
      assert.throws(() => getPaymentEnvironment(), PaymentConfigurationError);
    }
    delete process.env.PAYMENT_ENVIRONMENT;
    assert.throws(() => getPaymentEnvironment(), /PAYMENT_ENVIRONMENT é obrigatório/);
  } finally {
    if (priorEnvironment === undefined) delete process.env.PAYMENT_ENVIRONMENT;
    else process.env.PAYMENT_ENVIRONMENT = priorEnvironment;
  }
});

test("Access Token do Mercado Pago deve corresponder ao ambiente explícito", () => {
  const keys = ["PAYMENT_ENVIRONMENT", "MERCADO_PAGO_ACCESS_TOKEN", "MERCADOPAGO_ACCESS_TOKEN", "MP_ACCESS_TOKEN", "MP_TOKEN"] as const;
  const previous = new Map(keys.map((key) => [key, process.env[key]]));
  try {
    for (const key of keys.slice(1)) delete process.env[key];
    process.env.PAYMENT_ENVIRONMENT = "test";
    process.env.MERCADO_PAGO_ACCESS_TOKEN = "TEST-fixture-token";
    assert.doesNotThrow(validateMercadoPagoAccessToken);

    process.env.PAYMENT_ENVIRONMENT = "production";
    assert.throws(() => validateMercadoPagoAccessToken(), PaymentConfigurationError);
    process.env.MERCADO_PAGO_ACCESS_TOKEN = `APP_USR-${"x".repeat(48)}`;
    assert.doesNotThrow(validateMercadoPagoAccessToken);

    process.env.PAYMENT_ENVIRONMENT = "test";
    assert.throws(() => validateMercadoPagoAccessToken(), PaymentConfigurationError);
  } finally {
    for (const [key, value] of previous) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

test("checkout usa somente init_point HTTPS de host oficial do Mercado Pago", () => {
  assert.equal(
    getCheckoutUrl({ init_point: "https://www.mercadopago.com.br/checkout/v1/redirect?pref_id=123" }),
    "https://www.mercadopago.com.br/checkout/v1/redirect?pref_id=123",
  );
  assert.equal(getCheckoutUrl({}), undefined);
  assert.equal(getCheckoutUrl({ init_point: "http://www.mercadopago.com.br/checkout" }), undefined);
  assert.equal(getCheckoutUrl({ init_point: "https://mercadopago.com.br.attacker.example/checkout" }), undefined);
  assert.equal(getCheckoutUrl({ init_point: "https://user@mercadopago.com.br/checkout" }), undefined);
  assert.equal(getCheckoutUrl({ init_point: "https://mercadopago.com.br:8443/checkout" }), undefined);
});

test("URLs de retorno locais preservam HTTP e produção exige HTTPS", () => {
  assert.equal(resolveSiteUrl(undefined, "http://localhost:3000/api/checkout", true), "http://localhost:3000");
  assert.equal(resolveSiteUrl("http://127.0.0.1:3100", undefined, true), "http://127.0.0.1:3100");
  assert.throws(() => resolveSiteUrl("http://localhost:3000", undefined, false), /SITE_URL deve usar HTTPS/);
  assert.equal(resolveSiteUrl(undefined, undefined, false), "https://importsalves.com.br");
});

test("tentativa de checkout reutiliza chave após reload sem armazenar dados pessoais", async () => {
  const state = new Map<string, string>();
  const storage = {
    getItem: (key: string) => state.get(key) ?? null,
    setItem: (key: string, value: string) => { state.set(key, value); },
    removeItem: (key: string) => { state.delete(key); },
  };
  const payload = { customer: { email: "private@example.com" }, items: [validLine] };
  const fingerprint = await fingerprintCheckoutAttempt(payload.items);
  const key = getCheckoutAttemptKey(storage, () => "c6f43356-3120-4b4d-a1da-7d3396636291");
  const reloadedKey = getCheckoutAttemptKey(storage, () => "a6f43356-3120-4b4d-a1da-7d3396636291");
  const changedPayloadFingerprint = await fingerprintCheckoutAttempt([{ ...validLine, quantity: 2 }]);
  const changedPayloadKey = getCheckoutAttemptKey(storage, () => "b6f43356-3120-4b4d-a1da-7d3396636291");
  assert.equal(reloadedKey, key);
  assert.notEqual(changedPayloadFingerprint, fingerprint);
  assert.equal(changedPayloadKey, key);
  assert.equal(JSON.stringify([...state.values()]).includes("private@example.com"), false);
  clearCheckoutAttempt(storage);
  const nextAttemptKey = getCheckoutAttemptKey(storage, () => "b6f43356-3120-4b4d-a1da-7d3396636291");
  assert.notEqual(nextAttemptKey, key);
  clearCheckoutAttempt(storage);
  assert.equal(state.size, 0);
});

test("carrinho persistido exclui linhas com personalização que pode identificar o cliente", () => {
  const customized = {
    lineId: "product-M-ANA-7",
    product,
    size: "M",
    quantity: 1,
    customization: { name: "ANA", number: "7" },
  };
  const persisted = getPersistedCartItems([customized]);
  assert.deepEqual(persisted, []);
  assert.equal(JSON.stringify(persisted).includes("ANA"), false);
  assert.equal(JSON.stringify(persisted).includes("customization"), false);
});

test("checkout rejeita valores adulterados enviados pelo navegador", async () => {
  const customer = {
    whatsappUpdates: false,
    fullName: "Teste Comprador",
    email: "comprador@example.com",
    cpf: "529.982.247-25",
    phone: "11999999999",
    cep: "01001000",
    street: "Rua Teste",
    number: "1",
    complement: "",
    neighborhood: "Centro",
    city: "São Paulo",
    state: "SP",
  };
  for (const [index, priceFields] of [
    { price: 0.01 },
    { total: 0.01, shipping: 0, discount: 999 },
  ].entries()) {
    const idempotencyKey = index === 0
      ? "c6f43356-3120-4b4d-a1da-7d3396636291"
      : "a6f43356-3120-4b4d-a1da-7d3396636291";
    const response = await createCheckout(new Request("https://loja.test/api/checkout", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "idempotency-key": idempotencyKey,
        "x-forwarded-for": `192.0.2.${index + 10}`,
      },
      body: JSON.stringify({
        idempotencyKey,
        items: [{ ...validLine, ...priceFields }],
        customer,
      }),
    }));
    assert.equal(response.status, 400);
  }
});

test("webhook exige assinatura válida mesmo para eventos não suportados", async () => {
  const previousSecret = process.env.MERCADO_PAGO_WEBHOOK_SECRET;
  process.env.MERCADO_PAGO_WEBHOOK_SECRET = "local-webhook-test-secret";
  try {
    const response = await mercadoPagoWebhook(new Request(
      "https://loja.test/api/mercado-pago/webhook?type=merchant_order&id=123",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ type: "merchant_order", data: { id: "123" } }),
      },
    ));
    assert.equal(response.status, 401);
  } finally {
    if (previousSecret === undefined) delete process.env.MERCADO_PAGO_WEBHOOK_SECRET;
    else process.env.MERCADO_PAGO_WEBHOOK_SECRET = previousSecret;
  }
});

test("upload de produto valida a assinatura real do conteúdo da imagem", async () => {
  const png = new File([new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0])], "foto.png", { type: "image/png" });
  const spoofed = new File(["nao e imagem"], "foto.png", { type: "image/png" });
  assert.equal(await isValidProductImage(png), true);
  assert.equal(await isValidProductImage(spoofed), false);
});

test("rastreio responde igual a entradas inválidas e códigos incompletos", async () => {
  const invalid = await trackOrder(new Request("https://loja.test/api/orders/track", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": "192.0.2.21" },
    body: JSON.stringify({ code: "12", contact: "x" }),
  }));
  const incomplete = await trackOrder(new Request("https://loja.test/api/orders/track", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": "192.0.2.22" },
    body: JSON.stringify({ code: "ABCD", contact: "cliente@example.com" }),
  }));
  assert.equal(invalid.status, 404);
  assert.equal(incomplete.status, 404);
  assert.deepEqual(await invalid.json(), await incomplete.json());
});

test("token do Instagram vai no cabeçalho do servidor, nunca na URL", async () => {
  const previousToken = process.env.INSTAGRAM_ACCESS_TOKEN;
  const previousUserId = process.env.INSTAGRAM_USER_ID;
  const originalFetch = globalThis.fetch;
  const token = "local-instagram-test-token";
  let requestUrl = "";
  let authorization = "";
  process.env.INSTAGRAM_ACCESS_TOKEN = token;
  process.env.INSTAGRAM_USER_ID = "test-profile";
  globalThis.fetch = async (input, init) => {
    requestUrl = String(input);
    authorization = new Headers(init?.headers).get("authorization") ?? "";
    return Response.json({ data: [] });
  };
  try {
    await getInstagramFeed();
    assert.equal(requestUrl.includes(token), false);
    assert.equal(authorization, `Bearer ${token}`);
  } finally {
    globalThis.fetch = originalFetch;
    if (previousToken === undefined) delete process.env.INSTAGRAM_ACCESS_TOKEN;
    else process.env.INSTAGRAM_ACCESS_TOKEN = previousToken;
    if (previousUserId === undefined) delete process.env.INSTAGRAM_USER_ID;
    else process.env.INSTAGRAM_USER_ID = previousUserId;
  }
});

test("reconciliação aceita somente pagamento correspondente ao pedido, ambiente e valor", () => {
  const paymentId = "998877";
  const orderId = "c6f43356-3120-4b4d-a1da-7d3396636291";
  const payment = {
    id: paymentId,
    status: "approved",
    currency_id: "BRL",
    live_mode: false,
    external_reference: orderId,
    transaction_amount: 180,
  };
  assert.equal(validateMercadoPagoPayment(paymentId, payment, "test")?.orderId, orderId);
  assert.equal(validateMercadoPagoPayment(paymentId, { ...payment, id: "998878" }, "test"), undefined);
  assert.equal(validateMercadoPagoPayment(paymentId, { ...payment, live_mode: true }, "test"), undefined);
  assert.equal(validateMercadoPagoPayment(paymentId, { ...payment, currency_id: "USD" }, "test"), undefined);
  assert.equal(validateMercadoPagoPayment(paymentId, { ...payment, external_reference: "other" }, "test"), undefined);
  assert.equal(validateMercadoPagoPayment(paymentId, { ...payment, transaction_amount: 0 }, "test"), undefined);
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

test("distingue token administrativo ausente de senha inválida e aceita espaços externos", async () => {
  const previousToken = process.env.ADMIN_ORDERS_TOKEN;
  try {
    delete process.env.ADMIN_ORDERS_TOKEN;
    const missing = getAdminAuthFailure(new Request("https://store.example/api/admin/orders"));
    assert.equal(missing?.status, 503);

    process.env.ADMIN_ORDERS_TOKEN = "admin-secret";
    const invalid = getAdminAuthFailure(new Request("https://store.example/api/admin/orders", {
      headers: { authorization: "Bearer wrong-secret" },
    }));
    assert.equal(invalid?.status, 401);
    const protectedRouteResponse = await getAdminSummary(new Request("https://store.example/api/admin/summary"));
    assert.equal(protectedRouteResponse.status, 401);
    assert.equal(protectedRouteResponse.headers.get("Cache-Control"), "no-store");
    assert.equal(protectedRouteResponse.headers.get("X-Robots-Tag"), "noindex, nofollow");

    const valid = getAdminAuthFailure(new Request("https://store.example/api/admin/orders", {
      headers: { authorization: "Bearer  admin-secret  " },
    }));
    assert.equal(valid, null);
  } finally {
    if (previousToken === undefined) delete process.env.ADMIN_ORDERS_TOKEN;
    else process.env.ADMIN_ORDERS_TOKEN = previousToken;
  }
});

test("sessão admin usa cookie assinado, autentica com token, expira e encerra sem armazenar o token no cookie", async () => {
  const previousToken = process.env.ADMIN_ORDERS_TOKEN;
  const previousNodeEnv = process.env.NODE_ENV;
  process.env.ADMIN_ORDERS_TOKEN = "admin-session-test-secret";
  Object.defineProperty(process.env, "NODE_ENV", { configurable: true, enumerable: true, writable: true, value: "production" });
  try {
    const ip = `192.0.2.${Math.floor(Math.random() * 200) + 1}`;
    const wrong = await loginAdmin(new Request("https://store.example/api/admin/session", {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": ip },
      body: JSON.stringify({ token: "wrong-token" }),
    }));
    assert.equal(wrong.status, 401);

    const login = await loginAdmin(new Request("https://store.example/api/admin/session", {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": ip },
      body: JSON.stringify({ token: process.env.ADMIN_ORDERS_TOKEN }),
    }));
    assert.equal(login.status, 200);
    const cookieHeader = login.headers.get("set-cookie") ?? "";
    assert.match(cookieHeader, /HttpOnly/i);
    assert.match(cookieHeader, /Secure/i);
    assert.match(cookieHeader, /SameSite=Strict/i);
    assert.match(cookieHeader, /Path=\//i);
    const cookieValue = cookieHeader.match(new RegExp(`${ADMIN_SESSION_COOKIE}=([^;]+)`))?.[1] ?? "";
    assert.ok(cookieValue);
    assert.notEqual(cookieValue, process.env.ADMIN_ORDERS_TOKEN);
    assert.equal(isValidAdminSessionValue(cookieValue), true);
    assert.equal(isValidAdminSessionValue(cookieValue, Date.now() + 9 * 60 * 60 * 1000), false);

    const sessionRequest = new Request("https://store.example/api/admin/session", {
      headers: { cookie: `${ADMIN_SESSION_COOKIE}=${cookieValue}` },
    });
    assert.equal((await checkAdminSession(sessionRequest)).status, 200);
    assert.equal(authorizeAdminRequest(sessionRequest), null);
    const alteredRequest = new Request("https://store.example/api/admin/session", {
      headers: { cookie: `${ADMIN_SESSION_COOKIE}=${cookieValue.slice(0, -1)}${cookieValue.endsWith("0") ? "1" : "0"}` },
    });
    assert.equal((await checkAdminSession(alteredRequest)).status, 401);
    const expiredRequest = new Request("https://store.example/api/admin/session", {
      headers: { cookie: `${ADMIN_SESSION_COOKIE}=${createAdminSessionValue(Date.now() - 9 * 60 * 60 * 1000)}` },
    });
    assert.equal((await checkAdminSession(expiredRequest)).status, 401);
    assert.equal(authorizeAdminRequest(new Request("https://store.example/api/admin/session"))?.status, 401);

    const logout = logoutAdmin();
    assert.equal(logout.status, 200);
    assert.match(logout.headers.get("set-cookie") ?? "", /Max-Age=0/i);
  } finally {
    if (previousToken === undefined) delete process.env.ADMIN_ORDERS_TOKEN;
    else process.env.ADMIN_ORDERS_TOKEN = previousToken;
    if (previousNodeEnv === undefined) Reflect.deleteProperty(process.env, "NODE_ENV");
    else Object.defineProperty(process.env, "NODE_ENV", { configurable: true, enumerable: true, writable: true, value: previousNodeEnv });
  }
});

test("login administrativo limita tentativas por IP", async () => {
  const previousToken = process.env.ADMIN_ORDERS_TOKEN;
  process.env.ADMIN_ORDERS_TOKEN = "admin-session-test-secret";
  try {
    const ip = `198.51.100.${Math.floor(Math.random() * 200) + 1}`;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const response = await loginAdmin(new Request("https://store.example/api/admin/session", {
        method: "POST",
        headers: { "content-type": "application/json", "x-real-ip": ip },
        body: JSON.stringify({ token: "wrong-token" }),
      }));
      assert.equal(response.status, 401);
    }
    const blocked = await loginAdmin(new Request("https://store.example/api/admin/session", {
      method: "POST",
      headers: { "content-type": "application/json", "x-real-ip": ip },
      body: JSON.stringify({ token: "wrong-token" }),
    }));
    assert.equal(blocked.status, 429);
  } finally {
    if (previousToken === undefined) delete process.env.ADMIN_ORDERS_TOKEN;
    else process.env.ADMIN_ORDERS_TOKEN = previousToken;
  }
});

test("a resposta pública inclui aprovadas e exclui pendentes e rejeitadas", () => {
  const rows = [
    { id: "pending", status: "pending", comentario: "Ainda em revisão" },
    { id: "approved", status: "approved", comentario: "Ótimo atendimento" },
    { id: "rejected", status: "rejected", comentario: "Rejeitada" },
  ];
  assert.deepEqual(filterPublicReviews(rows), [rows[1]]);
  assert.deepEqual(publicReviewsPayload(rows, 1, 5, 0, 6), {
    reviews: [rows[1]],
    total: 1,
    average: 5,
    hasMore: false,
  });
});

test("valida avaliação, remove HTML e limita nota e tamanho do comentário", () => {
  const valid = reviewSubmissionSchema.safeParse({
    nome: "Ana Silva",
    cidade: "São Paulo, SP",
    nota: 5,
    comentario: "Ótimo produto e atendimento.",
  });
  assert.equal(valid.success, true);
  assert.equal(sanitizeReviewText("<script>alert(1)</script>Camisa <b>ótima</b>"), "Camisa ótima");
  assert.equal(reviewSubmissionSchema.safeParse({
    nome: "Ana Silva", cidade: "São Paulo", nota: 6, comentario: "Nota fora de faixa.",
  }).success, false);
  assert.equal(reviewSubmissionSchema.safeParse({
    nome: "Ana Silva", cidade: "São Paulo", nota: 5, comentario: "x".repeat(501),
  }).success, false);
});

test("a rota de moderação retorna 401 sem token administrativo", async () => {
  const previousToken = process.env.ADMIN_ORDERS_TOKEN;
  try {
    process.env.ADMIN_ORDERS_TOKEN = "admin-test-token";
    const response = await getAdminReviews(new Request("https://store.example/api/admin/reviews"));
    assert.equal(response.status, 401);
  } finally {
    if (previousToken === undefined) delete process.env.ADMIN_ORDERS_TOKEN;
    else process.env.ADMIN_ORDERS_TOKEN = previousToken;
  }
});

test("proxy Yupoo rejeita hosts externos e limita o corpo transmitido", async () => {
  const originalFetch = globalThis.fetch;
  let fetchCalls = 0;
  globalThis.fetch = async () => {
    fetchCalls += 1;
    return new Response(new Uint8Array(8 * 1024 * 1024 + 1), {
      headers: { "content-type": "image/webp" },
    });
  };
  try {
    const invalidHost = await getYupooImage(new Request("https://store.example/api/yupoo-image?u=https%3A%2F%2Fexample.com%2Fimage.webp"));
    assert.equal(invalidHost.status, 400);
    assert.equal(fetchCalls, 0);

    const tooLarge = await getYupooImage(new Request("https://store.example/api/yupoo-image?u=https%3A%2F%2Fphoto.yupoo.com%2Fimage.webp"));
    assert.equal(tooLarge.status, 502);
    assert.equal(fetchCalls, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("valida cadastro manual e estoques por tamanho sem alterar regra do checkout", () => {
  const product = {
    slug: "camisa-teste-clube",
    nome: "Camisa Teste Clube 2026",
    description: "Produto cadastrado no painel.",
    preco: 179.9,
    publico: "masculino",
    tipo: "torcedor",
    liga: "brasileirao-serie-a",
    clube: "Clube Teste",
    temporada: "2026",
    uniforme: "titular",
    cor: "Azul",
    tamanhos: ["P", "M"],
    stock_by_size: { P: 1, M: 3 },
    imageUrls: ["https://rlbdgyajikbdhivwfyzk.supabase.co/storage/v1/object/public/produtos/manual/test/photo.webp"],
  };
  assert.equal(manualProductSchema.safeParse(product).success, true);
  assert.equal(manualProductSchema.safeParse({ ...product, tamanhos: ["3GG"] }).success, false);
  assert.equal(manualProductSchema.safeParse({ ...product, stock_by_size: { P: -1, M: 3 } }).success, false);
  assert.equal(manualProductSchema.safeParse({ ...product, stock_by_size: { P: 1, G: 3 } }).success, false);
});

test("código do pedido aceita código curto e UUID, e rejeita códigos incompletos", () => {
  const id = "a1b2c3d4-1111-4222-8333-444455556666";
  assert.equal(orderCode(id), "A1B2C3D4");
  assert.equal(normalizeOrderCodeInput("#A1B2-C3D4"), "a1b2c3d4");
  assert.equal(normalizeOrderCodeInput(id), id);
  assert.equal(normalizeOrderCodeInput("a1b2c3d4111142228333444455556666"), id);
  assert.equal(isCompleteOrderCode("A1B2C3D4"), true);
  assert.equal(isCompleteOrderCode(id), true);
  assert.equal(isCompleteOrderCode("a1b2"), false);
  assert.equal(isCompleteOrderCode("a1b2c3"), false);
});

test("e-mails do pedido trazem o código e as instruções de rastreio", () => {
  const id = "a1b2c3d4-1111-4222-8333-444455556666";
  const base = {
    orderId: id,
    customerName: "Ana",
    items: [{ title: "Camisa Teste", size: "M", quantity: 2, customization: { name: "ANA", number: "10" }, patches: [{ name: "Brasileirão", position: "manga-esquerda" }] }],
    totalCents: 34000,
    siteUrl: "https://loja.test",
  };
  const paid = buildOrderPaidEmail({ ...base, shippingCents: 0 });
  assert.match(paid.subject, /A1B2C3D4/);
  assert.match(paid.text, /Código do seu pedido: A1B2C3D4/);
  assert.match(paid.text, /https:\/\/loja\.test\/rastreio/);
  assert.match(paid.text, /Frete: grátis/);
  assert.match(paid.text, /Total: R\$ 340,00/);
  assert.match(paid.text, /patches: Brasileirão \(manga-esquerda\)/);
  assert.match(paid.text, /personalização: Nome: ANA · Número: 10/);
  assert.match(buildOrderPaidEmail({
    ...base,
    items: [{ title: "Camisa Teste", size: "M", quantity: 1, customization: { name: "ANA", number: "" } }],
    shippingCents: 0,
  }).text, /personalização: Nome: ANA/);
  const received = buildOrderReceivedEmail({ ...base, shippingCents: 2000 });
  assert.match(received.text, /Código do seu pedido: A1B2C3D4/);
  assert.match(received.text, /Frete: R\$ 20,00/);
});

test("notificações WhatsApp vão ao cliente optado e incluem mensagens de pagamento e rastreio", async () => {
  const previousEndpoint = process.env.WHATSAPP_ORDER_WEBHOOK_URL;
  const originalFetch = globalThis.fetch;
  const sentMessages: Record<string, unknown>[] = [];
  process.env.WHATSAPP_ORDER_WEBHOOK_URL = "https://whatsapp.example.test/messages";
  globalThis.fetch = async (_input, init) => {
    sentMessages.push(JSON.parse(String(init?.body)) as Record<string, unknown>);
    return new Response(null, { status: 200 });
  };

  const order: OrderNotice = {
    id: "a1b2c3d4-1111-4222-8333-444455556666",
    status: "pago",
    customer: { fullName: "Marina Silva", phone: "11987654321", whatsappUpdates: true },
    item_lines: [
      { title: "Camisa Clube", size: "M", quantity: 1, customization: { name: "ANA", number: "" } },
      { title: "Camisa Visitante", size: "G", quantity: 1, customization: { name: "", number: "99" } },
    ],
    shipping_cents: 0,
    total_cents: 18000,
    tracking_code: "AB123456789BR",
  };

  try {
    assert.equal(await sendWhatsAppOrderNotice("order_paid", order), true);
    assert.equal(await sendWhatsAppOrderNotice("tracking_code_updated", { ...order, status: "enviado" }), true);
    assert.equal(sentMessages[0]?.to, "5511987654321");
    assert.match(String(sentMessages[0]?.message), /pagamento.*confirmado/i);
    assert.match(String(sentMessages[0]?.message), /Nome: ANA/);
    assert.match(String(sentMessages[0]?.message), /Número: 99/);
    assert.match(String(sentMessages[1]?.message), /AB123456789BR/);
    assert.match(String(sentMessages[1]?.message), /rastreamento\.correios\.com\.br/);
    assert.equal(await sendWhatsAppOrderNotice("order_paid", {
      ...order,
      customer: { ...order.customer, whatsappUpdates: false },
    }), false);
    assert.equal(sentMessages.length, 2);
  } finally {
    globalThis.fetch = originalFetch;
    if (previousEndpoint === undefined) delete process.env.WHATSAPP_ORDER_WEBHOOK_URL;
    else process.env.WHATSAPP_ORDER_WEBHOOK_URL = previousEndpoint;
  }
});

test("limite de tentativas bloqueia por IP e libera na janela seguinte", () => {
  const request = (ip: string) => new Request("https://loja.test/api/orders/track", { headers: { "x-forwarded-for": ip } });
  const bucket = `teste-${Date.now()}`;
  assert.deepEqual([1, 2, 3, 4].map(() => isRateLimited(request("1.1.1.1"), bucket, 3, 60_000, 1_000)), [false, false, false, true]);
  assert.equal(isRateLimited(request("2.2.2.2"), bucket, 3, 60_000, 1_000), false);


  assert.equal(isRateLimited(request("1.1.1.1"), bucket, 3, 60_000, 62_000), false);

test("infantil custa R$ 180,00 por camisa", () => {
  const kid = productFixture("teste-infantil-unitario", { nome: "Camisa Infantil Teste", tipo: "revisar", publico: "infantil", imageSeed: "Infantil Teste", preco: 160, tamanhos: ["M"] }, baseProduct);
  assert.equal(classifyProduct(kid).price, storeConfig.kidsPrice);
  assert.equal(classifyProduct(kid).reviewRequired, false);
});

test("2 e 3 unidades de infantil somam R$ 180 por unidade (sem pacote)", () => {
  const kid = productFixture("teste-infantil-pacote", { nome: "Camisa Infantil Pacote", tipo: "revisar", publico: "infantil", imageSeed: "Infantil Pacote", preco: 160, tamanhos: ["M"] }, baseProduct);
  const lines2 = validateOrderLinesWithCatalog([{ productId: kid.id, size: "M", quantity: 2 }], [kid]);
  const lines3 = validateOrderLinesWithCatalog([{ productId: kid.id, size: "M", quantity: 3 }], [kid]);
  assert.equal(calculateOrderTotals(lines2).shirtsCents, 2 * storeConfig.kidsPrice * 100);
  assert.equal(calculateOrderTotals(lines3).shirtsCents, 3 * storeConfig.kidsPrice * 100);
  assert.equal(isPackageEligible(kid), false);
});

test("infantil misturado com torcedor calcula cada linha e frete pelo total de unidades", () => {
  const kid = productFixture("teste-infantil-misto", { nome: "Camisa Infantil Misto", tipo: "revisar", publico: "infantil", imageSeed: "Infantil Misto", preco: 160, tamanhos: ["M"] }, baseProduct);
  const fanProduct = products.find((entry) => classifyProduct(entry).price === storeConfig.fanCommonPrice && entry.tamanhos.length > 0 && entry.tipo === "torcedor") ?? product;
  const lines = validateOrderLinesWithCatalog([
    { productId: kid.id, size: "M", quantity: 1 },
    { productId: fanProduct.id, size: fanProduct.tamanhos[0], quantity: 2 },
  ], [kid, fanProduct]);
  const totals = calculateOrderTotals(lines);
  assert.equal(totals.shippingCents, 0);
  assert.ok(totals.shirtsCents >= storeConfig.kidsPrice * 100);
});

test("produto infantil sem tipo confirmado não vira R$ 160 por engano", () => {
  const kid = productFixture("teste-infantil-revisar", { nome: "Camisa Infantil Revisar", tipo: "revisar", publico: "infantil", imageSeed: "Infantil Revisar", preco: 160, tamanhos: ["M"] }, baseProduct);
  assert.equal(classifyProduct(kid).price, storeConfig.kidsPrice);
  assert.notEqual(classifyProduct(kid).price, 160);
});

});
