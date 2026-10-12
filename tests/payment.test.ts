import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { test } from "node:test";
import { getPackagePrice } from "@/lib/commerce";
import { orderLinesSchema, validateOrderLines, calculateOrderTotals } from "@/lib/payment/order";
import { buildPreferenceItems } from "@/lib/payment/preference-items";
import { getShippingQuotes } from "@/lib/server/correios";
import { isValidMercadoPagoSignature, normalizedPaymentStatus } from "@/lib/server/webhook-signature";
import { products } from "@/lib/catalog";
import { POST as createCheckout } from "@/app/api/checkout/route";
import { POST as quoteShipping } from "@/app/api/shipping/quote/route";

const product = products.find((entry) => entry.tamanhos.length > 0);
assert.ok(product, "O catálogo precisa ter ao menos um produto com tamanho disponível para os testes.");
const validLine = { productId: product.id, size: product.tamanhos[0], quantity: 1 };

test("calcula os pacotes sem personalização", () => {
  assert.deepEqual([1, 2, 3, 4, 5, 6].map(getPackagePrice), [160, 300, 450, 610, 750, 900]);
});

test("valida produto e tamanho no catálogo do servidor", () => {
  assert.equal(validateOrderLines([validLine])[0].product.id, product.id);
  assert.throws(() => validateOrderLines([{ ...validLine, productId: "produto-inexistente" }]), /não está mais disponível/);
  assert.throws(() => validateOrderLines([{ ...validLine, size: "NA" }]), /tamanhos selecionados/);
  assert.equal(orderLinesSchema.safeParse([{ ...validLine, price: 1 }]).success, false);
  assert.equal(orderLinesSchema.safeParse([{ ...validLine, quantity: -1 }]).success, false);
  assert.equal(orderLinesSchema.safeParse([{ ...validLine, quantity: 1.5 }]).success, false);
});

test("calcula desconto do pacote e personalização por camisa", () => {
  const lines = validateOrderLines([
    { ...validLine, quantity: 2, customization: { name: "ANA", number: "10" } },
    { ...validLine, size: product.tamanhos[1] ?? product.tamanhos[0], quantity: 1 },
  ]);
  const totals = calculateOrderTotals(lines);
  assert.equal(totals.quantity, 3);
  assert.equal(totals.personalizedQuantity, 2);
  assert.equal(totals.shirtsCents, 45_000);
  assert.equal(totals.customizationCents, 4_000);
  assert.equal(totals.bundleDiscountCents, 3_000);
  assert.equal(totals.productsTotalCents, 49_000);
});

test("soma R$ 20 por cada camisa personalizada nos três pacotes", () => {
  const expectedTotals = [18_000, 34_000, 51_000];
  for (const quantity of [1, 2, 3]) {
    const lines = validateOrderLines([{
      ...validLine,
      quantity,
      customization: { name: "ANA", number: "10" },
    }]);
    assert.equal(calculateOrderTotals(lines).productsTotalCents, expectedTotals[quantity - 1]);
  }
});

test("envia linhas reais do catálogo e preços exatos dos pacotes ao Checkout Pro", () => {
  for (const quantity of [1, 2, 3, 4, 5, 6, 7]) {
    const lines = validateOrderLines([{ ...validLine, quantity }]);
    const totals = calculateOrderTotals(lines);
    const items = buildPreferenceItems("pedido-teste", lines, totals);
    assert.equal(items.reduce((sum, item) => sum + item.quantity, 0), quantity);
    assert.equal(items.reduce((sum, item) => sum + Math.round(item.unit_price * 100) * item.quantity, 0), totals.shirtsCents);
    assert.ok(items.every((item) => item.title.includes(product.nome) && item.title.includes(validLine.size)));
  }

  const lines = validateOrderLines([{ ...validLine, quantity: 2, customization: { name: "ANA", number: "10" } }]);
  const totals = calculateOrderTotals(lines);
  const items = buildPreferenceItems("pedido-teste", lines, totals);
  assert.equal(items.reduce((sum, item) => sum + Math.round(item.unit_price * 100) * item.quantity, 0), totals.productsTotalCents);
  assert.ok(items.some((item) => item.title.startsWith("Personalização") && item.quantity === 2));

  const mixedLines = validateOrderLines([
    { ...validLine, customization: { name: "ANA", number: "10" } },
    { ...validLine, size: product.tamanhos[1] ?? product.tamanhos[0] },
  ]);
  const mixedTotals = calculateOrderTotals(mixedLines);
  const mixedItems = buildPreferenceItems("pedido-teste", mixedLines, mixedTotals);
  assert.equal(mixedItems.reduce((sum, item) => sum + Math.round(item.unit_price * 100) * item.quantity, 0), mixedTotals.productsTotalCents);
  assert.equal(mixedItems.filter((item) => item.title.startsWith("Personalização")).reduce((sum, item) => sum + item.quantity, 0), 1);
});

test("não consulta os Correios quando a regra de frete grátis foi atingida", async () => {
  const quotes = await getShippingQuotes([{ ...validateOrderLines([{ ...validLine, quantity: 3 }])[0] }], "01001000", async () => {
    throw new Error("A API não deveria ser chamada.");
  });
  assert.deepEqual(quotes, []);
});

test("consulta preços dos serviços contratados usando credenciais e medidas do servidor", async () => {
  const original = {
    username: process.env.CORREIOS_API_USERNAME,
    accessCode: process.env.CORREIOS_API_ACCESS_CODE,
    card: process.env.CORREIOS_POSTING_CARD,
    originCep: process.env.CORREIOS_ORIGIN_CEP,
    services: process.env.CORREIOS_SERVICES_JSON,
    packages: process.env.CORREIOS_PACKAGE_SPECS_JSON,
  };
  Object.assign(process.env, {
    CORREIOS_API_USERNAME: "test-user",
    CORREIOS_API_ACCESS_CODE: "test-key",
    CORREIOS_POSTING_CARD: "test-card",
    CORREIOS_ORIGIN_CEP: "01001000",
    CORREIOS_SERVICES_JSON: JSON.stringify([{ code: "TEST01", label: "Serviço de teste" }]),
    CORREIOS_PACKAGE_SPECS_JSON: JSON.stringify({
      "1": { weightKg: 0.3, lengthCm: 25, widthCm: 20, heightCm: 4 },
      "2": { weightKg: 0.5, lengthCm: 30, widthCm: 22, heightCm: 6 },
    }),
  });

  try {
    let priceRequest: Record<string, unknown> | undefined;
    const quotes = await getShippingQuotes(validateOrderLines([validLine]), "01001000", async (input, init) => {
      if (String(input).endsWith("/token/v1/autentica/cartaopostagem")) {
        assert.equal(init?.method, "POST");
        assert.match(String((init?.headers as Record<string, string>).authorization), /^Basic /);
        return Response.json({ token: "test-token" });
      }
      assert.equal(String(input), "https://api.correios.com.br/preco/v1/nacional");
      assert.equal((init?.headers as Record<string, string>).authorization, "Bearer test-token");
      priceRequest = JSON.parse(String(init?.body)) as Record<string, unknown>;
      return Response.json([{ coProduto: "TEST01", pcFinal: "18,40" }]);
    });

    assert.deepEqual(quotes, [{ serviceCode: "TEST01", label: "Serviço de teste", priceCents: 1_840 }]);
    const parameters = priceRequest?.parametrosProduto as Array<Record<string, unknown>>;
    assert.equal(parameters[0].cepOrigem, "01001000");
    assert.equal(parameters[0].cepDestino, "01001000");
    assert.equal(parameters[0].psObjeto, "0.3");
    assert.equal(parameters[0].comprimento, 25);
  } finally {
    const names = {
      username: "CORREIOS_API_USERNAME",
      accessCode: "CORREIOS_API_ACCESS_CODE",
      card: "CORREIOS_POSTING_CARD",
      originCep: "CORREIOS_ORIGIN_CEP",
      services: "CORREIOS_SERVICES_JSON",
      packages: "CORREIOS_PACKAGE_SPECS_JSON",
    } as const;
    for (const [key, name] of Object.entries(names)) {
      const value = original[key as keyof typeof original];
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
});

test("endpoint rejeita valores de preço enviados pelo navegador", async () => {
  const response = await createCheckout(new Request("https://loja.test/api/checkout", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ items: [{ ...validLine, price: 0.01 }], total: 0.01 }),
  }));
  assert.equal(response.status, 400);
  assert.equal((await response.json()).error, "Confira os dados do pedido e tente novamente.");
});

test("endpoint de frete falha explicitamente quando a conta dos Correios não está configurada", async () => {
  const names = [
    "CORREIOS_API_USERNAME",
    "CORREIOS_API_ACCESS_CODE",
    "CORREIOS_POSTING_CARD",
    "CORREIOS_ORIGIN_CEP",
    "CORREIOS_SERVICES_JSON",
    "CORREIOS_PACKAGE_SPECS_JSON",
  ] as const;
  const original = Object.fromEntries(names.map((name) => [name, process.env[name]]));
  names.forEach((name) => delete process.env[name]);
  try {
    const response = await quoteShipping(new Request("https://loja.test/api/shipping/quote", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ items: [validLine], cep: "01001000" }),
    }));
    assert.equal(response.status, 503);
    assert.match((await response.json()).error, /Configure CORREIOS_/);
  } finally {
    for (const name of names) {
      const value = original[name];
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
});

test("endpoint de pagamento não cria checkout sem banco persistente configurado", async () => {
  const originalDatabaseUrl = process.env.DATABASE_URL;
  delete process.env.DATABASE_URL;
  try {
    const response = await createCheckout(new Request("https://loja.test/api/checkout", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "idempotency-key": "c6f43356-3120-4b4d-a1da-7d3396636291",
      },
      body: JSON.stringify({
        idempotencyKey: "c6f43356-3120-4b4d-a1da-7d3396636291",
        items: [validLine],
        customer: {
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
        shipping: { quotedPriceCents: 0 },
      }),
    }));
    assert.equal(response.status, 503);
    assert.match((await response.json()).error, /pedidos ainda não está configurado/);
  } finally {
    if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = originalDatabaseUrl;
  }
});

test("valida assinatura do webhook e mapeia status reais", () => {
  const secret = "webhook-test-secret";
  const requestId = "request-123";
  const dataId = "998877";
  const timestamp = "1781200000";
  const manifest = `id:${dataId};request-id:${requestId};ts:${timestamp};`;
  const signature = `ts=${timestamp},v1=${createHmac("sha256", secret).update(manifest).digest("hex")}`;

  assert.equal(isValidMercadoPagoSignature({ secret, signature, requestId, dataId }), true);
  assert.equal(isValidMercadoPagoSignature({ secret, signature, requestId, dataId: "998878" }), false);
  assert.equal(isValidMercadoPagoSignature({ secret, signature: null, requestId, dataId }), false);
  assert.equal(normalizedPaymentStatus("approved"), "approved");
  assert.equal(normalizedPaymentStatus("in_process"), "pending");
  assert.equal(normalizedPaymentStatus("rejected"), "rejected");
  assert.equal(normalizedPaymentStatus("refunded"), "refunded");
  assert.equal(normalizedPaymentStatus("unrecognized"), undefined);
});
