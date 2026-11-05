import test from "node:test";
import assert from "node:assert/strict";
import type { Product, CartItem } from "@/lib/types";
import {
  classifyProduct,
  getProductUnitPrice,
  isFreeShippingProduct,
  isManualProduct,
  isNbaTankTop,
  isPackageEligible,
  isTestProduct,
} from "@/lib/product-classification";
import { isBlackFridayEligibleShirt } from "@/lib/black-friday";
import { getCartPricing, getProductOfferText } from "@/lib/commerce";
import { calculateOrderTotals, type VerifiedOrderLine } from "@/lib/payment/order";
import { buildPreferenceItems } from "@/lib/payment/preference-items";

const testProduct: Product = {
  id: "25288570-84a7-48cc-9a8b-abad05d51fd0",
  yupoo_id: "manual:25288570-84a7-48cc-9a8b-abad05d51fd0",
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
  tamanhos: ["P", "M", "G", "GG"],
  cor: "teste",
  imageSeed: "teste",
  images: [{
    src: "https://rlbdgyajikbdhivwfyzk.supabase.co/storage/v1/object/public/produtos/manual/test.jpg",
    source: "https://rlbdgyajikbdhivwfyzk.supabase.co/storage/v1/object/public/produtos/manual/test.jpg",
    alt: "teste",
    credit: "Imports Alves",
    focalPoint: { x: 50, y: 50 },
    blurDataURL: "",
  }],
  description: "teste",
  tem_variacao_uniforme: false,
};

const regularFanShirt: Product = {
  id: "fan-regular-1",
  slug: "camisa-flamengo-titular-2026",
  clube: "Flamengo",
  clubeSlug: "flamengo",
  liga: "brasileirao-serie-a",
  publico: "masculino",
  tipo: "torcedor",
  temporada: "2026",
  uniforme: "titular",
  nome: "Camisa Flamengo Titular 2026",
  preco: 0,
  tamanhos: ["P", "M", "G", "GG", "2GG"],
  cor: "Vermelho e Preto",
  imageSeed: "flamengo",
  images: [],
};

test("produto manual 'teste' respeita preço cadastrado de R$ 1,50 e não vira R$ 230,00", () => {
  assert.equal(isManualProduct(testProduct), true);
  assert.equal(isTestProduct(testProduct), true);
  assert.equal(isNbaTankTop(testProduct), false, "Não deve ser classificado como regata NBA de R$ 230");
  assert.equal(isPackageEligible(testProduct), false, "Não deve receber pacote de quantidade");
  assert.equal(isBlackFridayEligibleShirt(testProduct), false, "Não deve receber desconto Black Friday");

  const classification = classifyProduct(testProduct);
  assert.equal(classification.price, 1.5);
  assert.match(classification.priceLabel, /1,50/);
  assert.equal(classification.reviewRequired, false);

  assert.equal(getProductUnitPrice(testProduct, "P"), 1.5);
  assert.equal(getProductUnitPrice(testProduct, "M"), 1.5);
  assert.equal(getProductUnitPrice(testProduct, "2GG"), 1.5, "Produto manual não tem adicional de tamanho");
});

test("produto 'teste' não tem frete no carrinho (frete grátis)", () => {
  assert.equal(isFreeShippingProduct(testProduct), true);

  const cart: CartItem[] = [{
    lineId: "line-test-1",
    product: testProduct,
    size: "M",
    quantity: 1,
  }];

  const pricing = getCartPricing(cart);
  assert.equal(pricing.subtotal, 1.5);
  assert.equal(pricing.bundleDiscount, 0);
  assert.equal(pricing.promoDiscount, 0);
  assert.equal(pricing.shipping, 0, "Item teste deve ter frete zero");
  assert.equal(pricing.grandTotal, 1.5, "Total do carrinho deve ser exatamente R$ 1,50");
});

test("carrinho com 2 unidades do item 'teste' continua sem frete e sem desconto de pacote", () => {
  const cart: CartItem[] = [{
    lineId: "line-test-2",
    product: testProduct,
    size: "G",
    quantity: 2,
  }];

  const pricing = getCartPricing(cart);
  assert.equal(pricing.subtotal, 3.0);
  assert.equal(pricing.bundleDiscount, 0);
  assert.equal(pricing.promoDiscount, 0);
  assert.equal(pricing.shipping, 0);
  assert.equal(pricing.grandTotal, 3.0);
});

test("itens regulares continuam cobrando frete normalmente quando misturados com o item 'teste'", () => {
  // 1 camisa comum (frete R$ 20) + 1 item teste (sem frete)
  const cart: CartItem[] = [
    { lineId: "line-fan", product: regularFanShirt, size: "M", quantity: 1 },
    { lineId: "line-test", product: testProduct, size: "M", quantity: 1 },
  ];

  const pricing = getCartPricing(cart);
  // Camisa torcedor = R$ 170,00 + teste R$ 1,50 = R$ 171,50
  assert.equal(pricing.subtotal, 171.5);
  assert.equal(pricing.shipping, 20.0, "Camisa comum de 1 unidade paga frete fixo de R$ 20");
  assert.equal(pricing.grandTotal, 191.5);
});

test("valor enviado ao Mercado Pago Checkout Pro é exatamente o preço do item teste", () => {
  const line: VerifiedOrderLine = {
    productId: testProduct.id,
    product: testProduct,
    size: "M",
    quantity: 1,
    patchOptions: [],
  };

  const totals = calculateOrderTotals([line]);
  assert.equal(totals.quantity, 1);
  assert.equal(totals.shirtsCents, 150);
  assert.equal(totals.shippingCents, 0, "Frete calculado para o pedido deve ser 0 centavos");
  assert.equal(totals.totalCents, 150, "Total calculado para o pedido deve ser 150 centavos (R$ 1,50)");

  const preferenceItems = buildPreferenceItems("order-teste-mp", [line], totals);
  assert.equal(preferenceItems.length, 1);
  assert.equal(preferenceItems[0].title, "teste (tamanho M)");
  assert.equal(preferenceItems[0].quantity, 1);
  assert.equal(preferenceItems[0].unit_price, 1.5);
});

test("texto de oferta do produto teste destaca frete grátis e preço cadastrado", () => {
  const offerText = getProductOfferText(testProduct);
  assert.match(offerText, /1,50/);
  assert.match(offerText, /Frete grátis/);
});
