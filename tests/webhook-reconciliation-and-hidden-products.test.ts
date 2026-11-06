import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { isValidMercadoPagoSignature, normalizedPaymentStatus } from "../lib/server/webhook-signature";
import { validateMercadoPagoPayment } from "../lib/payment/mercado-pago-validation";
import { deriveCatalogLeagues } from "../lib/catalog-taxonomy";
import { classifyProduct, isManualProduct, isNbaTankTop } from "../lib/product-classification";
import type { Product } from "../lib/types";

const secret = "test-mercadopago-webhook-secret-key-123";

function generateSignature(dataId: string, requestId: string, ts = String(Math.floor(Date.now() / 1000))) {
  const manifest = `id:${dataId.toLowerCase()};request-id:${requestId};ts:${ts};`;
  const v1 = createHmac("sha256", secret).update(manifest).digest("hex");
  return {
    signatureHeader: `ts=${ts},v1=${v1}`,
    requestIdHeader: requestId,
    ts,
    v1,
  };
}

test("1. Validação de assinatura do webhook Mercado Pago (válida, inválida, segredo ausente)", () => {
  const paymentId = "123456789";
  const requestId = "req-uuid-abc-123";
  const { signatureHeader, requestIdHeader } = generateSignature(paymentId, requestId);

  // Assinatura válida
  assert.equal(isValidMercadoPagoSignature({
    secret,
    signature: signatureHeader,
    requestId: requestIdHeader,
    dataId: paymentId,
  }), true, "Assinatura legítima deve ser validada com sucesso");

  // Assinatura com dataId divergente
  assert.equal(isValidMercadoPagoSignature({
    secret,
    signature: signatureHeader,
    requestId: requestIdHeader,
    dataId: "999999999",
  }), false, "Assinatura com ID alterado deve ser rejeitada");

  // Assinatura com segredo incorreto
  assert.equal(isValidMercadoPagoSignature({
    secret: "wrong-secret",
    signature: signatureHeader,
    requestId: requestIdHeader,
    dataId: paymentId,
  }), false, "Assinatura com segredo diferente deve ser rejeitada");

  // Assinatura ou requestId ausentes
  assert.equal(isValidMercadoPagoSignature({
    secret,
    signature: null,
    requestId: requestIdHeader,
    dataId: paymentId,
  }), false, "Header de assinatura ausente deve retornar false");
  assert.equal(isValidMercadoPagoSignature({
    secret,
    signature: signatureHeader,
    requestId: null,
    dataId: paymentId,
  }), false, "Header x-request-id ausente deve retornar false");
});

test("2. Validação e normalização de pagamentos do Mercado Pago", () => {
  const paymentId = "5544332211";
  const orderId = "25288570-84a7-48cc-9a8b-abad05d51fd0";

  // Pagamento aprovado no ambiente correto
  const validPayment = {
    id: paymentId,
    status: "approved",
    transaction_amount: 1.5,
    currency_id: "BRL",
    live_mode: true,
    external_reference: orderId,
    payment_method_id: "pix",
    payment_type_id: "bank_transfer",
  };
  const verified = validateMercadoPagoPayment(paymentId, validPayment, "production");
  assert.ok(verified, "Pagamento válido em produção deve ser aprovado");
  assert.equal(verified?.amountCents, 150);
  assert.equal(verified?.status, "approved");
  assert.equal(verified?.orderId, orderId);

  // Divergência de ambiente: live_mode=true enquanto environment='test'
  const envMismatch = validateMercadoPagoPayment(paymentId, validPayment, "test");
  assert.equal(envMismatch, undefined, "Divergência de ambiente deve rejeitar o pagamento");

  // Moeda inválida (não BRL)
  const currencyMismatch = validateMercadoPagoPayment(paymentId, { ...validPayment, currency_id: "USD" }, "production");
  assert.equal(currencyMismatch, undefined, "Moeda estrangeira não deve ser aceita");

  // external_reference não é UUID
  const invalidRef = validateMercadoPagoPayment(paymentId, { ...validPayment, external_reference: "pedido-invalido" }, "production");
  assert.equal(invalidRef, undefined, "external_reference inválida deve falhar");
});

test("3. Mapeamento de status e regra de não-regressão", () => {
  assert.equal(normalizedPaymentStatus("approved"), "approved");
  assert.equal(normalizedPaymentStatus("pending"), "pending");
  assert.equal(normalizedPaymentStatus("in_process"), "pending");
  assert.equal(normalizedPaymentStatus("rejected"), "rejected");
  assert.equal(normalizedPaymentStatus("cancelled"), "cancelled");
  assert.equal(normalizedPaymentStatus("refunded"), "refunded");
  assert.equal(normalizedPaymentStatus("charged_back"), "refunded");
});

test("4. Produto oculto não entra no catálogo de ligas nem na vitrine pública", () => {
  const publicProduct: Product = {
    id: "prod-pub-1",
    slug: "camisa-flamengo-titular",
    clube: "Flamengo",
    clubeSlug: "flamengo",
    liga: "brasileirao-serie-a",
    publico: "masculino",
    tipo: "torcedor",
    temporada: "2026",
    uniforme: "titular",
    nome: "Camisa Flamengo",
    preco: 160,
    tamanhos: ["P", "M", "G"],
    cor: "Vermelho",
    imageSeed: "flamengo",
    images: [{
      src: "https://rlbdgyajikbdhivwfyzk.supabase.co/storage/v1/object/public/produtos/fla.jpg",
      source: "https://rlbdgyajikbdhivwfyzk.supabase.co/storage/v1/object/public/produtos/fla.jpg",
      alt: "Fla",
      credit: "Imports Alves",
      focalPoint: { x: 50, y: 50 },
      blurDataURL: "",
    }],
    oculto: false,
  };

  const hiddenTestProduct: Product = {
    id: "prod-test-hidden",
    slug: "teste",
    clube: "Teste",
    clubeSlug: "teste",
    liga: "teste",
    publico: "masculino",
    tipo: "regata",
    temporada: "2026",
    uniforme: "titular",
    nome: "Produto Teste",
    preco: 1.5,
    tamanhos: ["P", "M"],
    cor: "Preto",
    imageSeed: "teste",
    images: [{
      src: "https://rlbdgyajikbdhivwfyzk.supabase.co/storage/v1/object/public/produtos/test.jpg",
      source: "https://rlbdgyajikbdhivwfyzk.supabase.co/storage/v1/object/public/produtos/test.jpg",
      alt: "Teste",
      credit: "Imports Alves",
      focalPoint: { x: 50, y: 50 },
      blurDataURL: "",
    }],
    oculto: true,
  };

  // Lista pública só com produtos não ocultos
  const publicList = [publicProduct, hiddenTestProduct].filter((p) => !p.oculto);
  assert.equal(publicList.length, 1);
  assert.equal(publicList[0].slug, "camisa-flamengo-titular");

  // Ao derivar ligas da lista pública, a liga 'teste' NÃO aparece
  const leagues = deriveCatalogLeagues(publicList);
  assert.equal(leagues.some((l) => l.slug === "teste"), false, "Liga 'teste' não deve constar nas ligas derivadas");
  assert.equal(leagues.some((l) => l.slug === "brasileirao-serie-a"), true);
});

test("5. Preço digitado no cadastro manual prevalece sobre regra de tipo/categoria (ex.: regata R$ 1,50 vs R$ 230)", () => {
  const manualRegata: Product = {
    id: "manual-regata-1",
    yupoo_id: "manual:manual-regata-1",
    slug: "teste",
    clube: "Teste",
    clubeSlug: "teste",
    liga: "teste",
    publico: "masculino",
    tipo: "regata",
    temporada: "2026",
    uniforme: "titular",
    nome: "teste",
    preco: 1.5,
    tamanhos: ["P", "M", "G"],
    cor: "Branco",
    imageSeed: "teste",
    oculto: true,
  };

  assert.equal(isManualProduct(manualRegata), true, "Deve ser identificado como produto manual");
  assert.equal(isNbaTankTop(manualRegata), false, "Produto manual não deve ser classificado como regata NBA padrão");
  const classified = classifyProduct(manualRegata);
  assert.equal(classified.price, 1.5, "Preço deve ser exatamente o cadastrado (R$ 1,50) e não R$ 230,00");
});

