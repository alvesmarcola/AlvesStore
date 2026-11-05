import test from "node:test";
import assert from "node:assert/strict";
import { manualProductSchema } from "@/lib/admin/product-validation";
import { validateOrderLines, calculateOrderTotals, InvalidOrderError } from "@/lib/payment/order";
import { buildPreferenceItems } from "@/lib/payment/preference-items";
import type { Product } from "@/lib/types";

const mockBaseProduct: Product = {
  id: "prod-uniform-1",
  slug: "camisa-flamengo-2026",
  clube: "Flamengo",
  clubeSlug: "flamengo",
  liga: "brasileirao-serie-a",
  publico: "masculino",
  tipo: "torcedor",
  temporada: "2026",
  uniforme: "titular",
  nome: "Camisa Flamengo 2026",
  preco: 160,
  tamanhos: ["P", "M", "G", "GG"],
  cor: "Vermelho e Preto",
  imageSeed: "flamengo-2026",
  tem_variacao_uniforme: true,
};

const mockProductWithoutVariation: Product = {
  ...mockBaseProduct,
  id: "prod-uniform-2",
  slug: "camisa-real-madrid-2026",
  nome: "Camisa Real Madrid 2026",
  tem_variacao_uniforme: false,
};

test("manualProductSchema aceita e valida tem_variacao_uniforme", () => {
  const validData = {
    slug: "camisa-teste",
    nome: "Camisa de Teste",
    description: "Descrição de teste",
    brand: "Marca",
    supplier_name: "Fornecedor",
    supplier_cost: 50,
    preco: 160,
    publico: "masculino" as const,
    tipo: "torcedor" as const,
    liga: "brasileirao-serie-a",
    clube: "Teste FC",
    temporada: "2026",
    uniforme: "titular" as const,
    cor: "Azul",
    tamanhos: ["P", "M"],
    stock_by_size: { P: 5, M: 10 },
    imageUrls: ["https://example.com/image.jpg"],
    tem_variacao_uniforme: true,
  };

  const parsed = manualProductSchema.parse(validData);
  assert.equal(parsed.tem_variacao_uniforme, true);

  const parsedDefault = manualProductSchema.parse({
    ...validData,
    tem_variacao_uniforme: undefined,
  });
  assert.equal(parsedDefault.tem_variacao_uniforme, false);
});

test("validateOrderLines exige uniforme Casa ou Fora quando produto tem tem_variacao_uniforme = true", () => {
  const catalog = [mockBaseProduct];

  // Tentativa sem uniformVariation em produto que exige
  assert.throws(
    () => validateOrderLines([{ productId: "prod-uniform-1", size: "M", quantity: 1 }], catalog),
    (err: unknown) => {
      assert.ok(err instanceof InvalidOrderError);
      assert.match((err as Error).message, /Selecione o uniforme \(Casa ou Fora\)/);
      return true;
    }
  );

  // Com "Casa"
  const validCasa = validateOrderLines(
    [{ productId: "prod-uniform-1", size: "M", quantity: 1, uniformVariation: "Casa" }],
    catalog
  );
  assert.equal(validCasa.length, 1);
  assert.equal(validCasa[0].uniformVariation, "Casa");

  // Com "Fora"
  const validFora = validateOrderLines(
    [{ productId: "prod-uniform-1", size: "M", quantity: 1, uniformVariation: "Fora" }],
    catalog
  );
  assert.equal(validFora.length, 1);
  assert.equal(validFora[0].uniformVariation, "Fora");
});

test("validateOrderLines não exige uniforme quando tem_variacao_uniforme não está ativo", () => {
  const catalog = [mockProductWithoutVariation];

  const valid = validateOrderLines(
    [{ productId: "prod-uniform-2", size: "G", quantity: 1 }],
    catalog
  );
  assert.equal(valid.length, 1);
  assert.equal(valid[0].uniformVariation, undefined);
});

test("Permite no mesmo pedido o mesmo produto com uniformes diferentes (Casa e Fora) em linhas separadas", () => {
  const catalog = [mockBaseProduct];

  const valid = validateOrderLines(
    [
      { productId: "prod-uniform-1", size: "M", quantity: 1, uniformVariation: "Casa" },
      { productId: "prod-uniform-1", size: "M", quantity: 2, uniformVariation: "Fora" },
    ],
    catalog
  );

  assert.equal(valid.length, 2);
  assert.equal(valid[0].uniformVariation, "Casa");
  assert.equal(valid[0].quantity, 1);
  assert.equal(valid[1].uniformVariation, "Fora");
  assert.equal(valid[1].quantity, 2);

  const totals = calculateOrderTotals(valid);
  assert.equal(totals.quantity, 3);
});

test("Mercado Pago Preference Items inclui Uniforme: Casa e Uniforme: Fora no título do item", () => {
  const catalog = [mockBaseProduct];

  const lines = validateOrderLines(
    [
      { productId: "prod-uniform-1", size: "M", quantity: 1, uniformVariation: "Casa" },
      { productId: "prod-uniform-1", size: "G", quantity: 1, uniformVariation: "Fora" },
    ],
    catalog
  );

  const totals = calculateOrderTotals(lines);
  const preferenceItems = buildPreferenceItems("order-123", lines, totals);

  const casaItem = preferenceItems.find((item) => item.title.includes("Uniforme: Casa"));
  const foraItem = preferenceItems.find((item) => item.title.includes("Uniforme: Fora"));

  assert.ok(casaItem, "Item com Uniforme: Casa deve estar presente nos preference items");
  assert.ok(foraItem, "Item com Uniforme: Fora deve estar presente nos preference items");
  assert.match(casaItem.title, /Camisa Flamengo 2026 \(tamanho M · Uniforme: Casa\)/);
  assert.match(foraItem.title, /Camisa Flamengo 2026 \(tamanho G · Uniforme: Fora\)/);
});

