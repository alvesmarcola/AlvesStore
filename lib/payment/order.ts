import { z } from "zod";
import { storeConfig } from "@/config";
import { getPackagePrice, getShippingCents } from "@/lib/commerce";
import { checkoutSchema } from "@/lib/validation";
import type { Product } from "@/lib/types";
import { classifyProduct, getProductSizeSurcharge, isFreeShippingProduct, isManualProduct, isNbaTankTop, isPackageEligible } from "@/lib/product-classification";
import { getAvailablePatches } from "@/lib/patch-compatibility";
import { allowsCustomization } from "@/lib/formula-one";
import { getSupabaseProductBySlug, getSupabaseProducts, hasSupabaseCatalogConfiguration } from "@/lib/server/supabase-catalog";
import { CUSTOMIZATION_NAME_MAX_LENGTH, sanitizeCustomizationName } from "@/lib/customization";
import { calcularPromoBlackFriday, BLACK_FRIDAY_PROMO_CODE } from "@/lib/black-friday";

const customizationSchema = z.preprocess((value) => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return value;
  const customization = value as Record<string, unknown>;
  return {
    ...customization,
    ...(typeof customization.name === "string" ? { name: sanitizeCustomizationName(customization.name) } : {}),
  };
}, z.object({
  name: z.string().trim().max(CUSTOMIZATION_NAME_MAX_LENGTH, `O nome pode ter no máximo ${CUSTOMIZATION_NAME_MAX_LENGTH} caracteres.`).optional().default(""),
  number: z.string().trim()
    .max(3, "O número deve ter de 1 a 3 dígitos.")
    .regex(/^\d{0,3}$/, "O número deve conter apenas dígitos.")
    .optional().default(""),
}).strict().refine(
  (customization) => Boolean(customization.name || customization.number),
  "Informe o nome, o número ou os dois.",
));

export const orderLinesSchema = z.array(z.object({
  productId: z.string().min(1).max(100),
  size: z.string().trim().min(1).max(12),
  quantity: z.number().int().min(1).max(20),
  uniformVariation: z.enum(["Casa", "Fora"]).optional(),
  customization: customizationSchema.optional(),
  patches: z.array(z.object({ id: z.string().min(1).max(80), position: z.enum(["manga-esquerda", "manga-direita", "peito"]) }).strict()).max(4).optional(),
}).strict()).min(1).max(20);

export const paymentRequestSchema = z.object({
  idempotencyKey: z.string().uuid(),
  items: orderLinesSchema,
  customer: checkoutSchema.strict(),
}).strict();

export type OrderLineInput = z.infer<typeof orderLinesSchema>[number];
export type CheckoutCustomer = z.infer<typeof paymentRequestSchema>["customer"];
export type PaymentRequest = z.infer<typeof paymentRequestSchema>;
export type VerifiedOrderLine = OrderLineInput & { product: Product; patchOptions: ReturnType<typeof getAvailablePatches> };

export class InvalidOrderError extends Error {}

export function validateOrderLines(lines: OrderLineInput[], catalog: Product[]): VerifiedOrderLine[] {
  const seen = new Set<string>();
  let quantityTotal = 0;

  const verified = lines.map((line) => {
    const product = catalog.find((candidate) => candidate.id === line.productId || candidate.slug === line.productId);
    if (!product) throw new InvalidOrderError("Um dos produtos não está mais disponível.");
    if (line.size === "3GG" || !product.tamanhos.includes(line.size)) throw new InvalidOrderError("Um dos tamanhos selecionados não está disponível.");
    if (product.tem_variacao_uniforme && !line.uniformVariation) {
      throw new InvalidOrderError(`Selecione o uniforme (Casa ou Fora) para o produto ${product.nome}.`);
    }
    if (line.customization && !allowsCustomization(product)) {
      if (isNbaTankTop(product)) {
        throw new InvalidOrderError("Regatas NBA não aceitam personalização de nome e número.");
      }
      throw new InvalidOrderError("Camisas de Fórmula 1 não podem ser personalizadas.");
    }
    const facts = classifyProduct(product);
    if (facts.reviewRequired || facts.price === null) throw new InvalidOrderError("O preço deste produto está em revisão. Escolha outro modelo ou tente novamente mais tarde.");
    const availablePatches = getAvailablePatches(product);
    const selectedPatches = line.patches ?? [];
    if (new Set(selectedPatches.map((patch) => patch.id)).size !== selectedPatches.length) throw new InvalidOrderError("Remova opções de patch repetidas.");
    const resolvedPatches = selectedPatches.map((selected) => {
      const option = availablePatches.find((patch) => patch.id === selected.id && patch.positions.includes(selected.position));
      if (!option) throw new InvalidOrderError("Um dos patches não está confirmado para este modelo, temporada ou posição.");
      return option;
    });

    const key = JSON.stringify([line.productId, line.size, line.uniformVariation ?? "", line.customization?.name ?? "", line.customization?.number ?? "", [...(line.patches ?? [])].sort((a, b) => a.id.localeCompare(b.id))]);
    if (seen.has(key)) throw new InvalidOrderError("O carrinho contém linhas repetidas. Atualize a página e tente novamente.");
    seen.add(key);
    quantityTotal += line.quantity;
    return {
      ...line,
      patches: selectedPatches,
      ...(line.customization
        ? { customization: { name: line.customization.name.trim(), number: line.customization.number.trim() } }
        : {}),
      product,
      patchOptions: resolvedPatches,
    };
  });

  if (quantityTotal > 30) throw new InvalidOrderError("O limite por pedido é de 30 camisas.");
  return verified;
}

export async function validateOrderLinesFromCatalog(lines: OrderLineInput[]) {
  if (!hasSupabaseCatalogConfiguration()) {
    throw new Error("Não é possível iniciar um pagamento sem validar o catálogo atual do Supabase.");
  }
  const publishedProducts = await getSupabaseProducts();
  const knownIdentifiers = new Set(publishedProducts.flatMap((p) => [p.id, p.slug]));
  const missingLines = lines.filter((line) => !knownIdentifiers.has(line.productId));

  const additionalProducts: Product[] = [];
  for (const line of missingLines) {
    const hiddenProduct = await getSupabaseProductBySlug(line.productId, { allowHidden: true });
    if (hiddenProduct) {
      additionalProducts.push(hiddenProduct);
    }
  }

  const allCandidateProducts = [...publishedProducts, ...additionalProducts];
  return validateOrderLines(lines, allCandidateProducts);
}

export function calculateOrderTotals(lines: VerifiedOrderLine[], dataAtual = new Date()) {
  const quantity = lines.reduce((sum, line) => sum + line.quantity, 0);
  const personalizedQuantity = lines.reduce(
    (sum, line) => sum + (line.customization ? line.quantity : 0),
    0,
  );
  const promo = calcularPromoBlackFriday(lines, dataAtual);
  const promoDiscountCents = Math.round(promo.desconto * 100);
  const packageQuantity = promoDiscountCents > 0 ? 0 : lines.reduce((sum, line) => {
    return sum + (isPackageEligible(line.product) ? line.quantity : 0);
  }, 0);
  const baseSubtotalCents = lines.reduce((sum, line) => sum + Math.round(((classifyProduct(line.product).price ?? 0) + (isManualProduct(line.product) ? 0 : getProductSizeSurcharge(line.size))) * 100) * line.quantity, 0);
  const customizationCents = personalizedQuantity * Math.round(storeConfig.customizationPrice * 100);
  const bundleDiscountCents = packageQuantity > 0 ? packageQuantity * storeConfig.fanCommonPrice * 100 - getPackagePrice(packageQuantity) * 100 : 0;
  const shirtsCents = baseSubtotalCents - bundleDiscountCents - promoDiscountCents;
  const patchesCents = lines.reduce((sum, line) => sum + line.quantity * line.patchOptions.reduce((patchSum, patch) => patchSum + patch.priceCents, 0), 0);
  const shippingUnits = lines.reduce((sum, line) => sum + (isFreeShippingProduct(line.product) ? 0 : line.quantity), 0);
  const shippingCents = getShippingCents(shippingUnits);

  return {
    quantity,
    personalizedQuantity,
    baseSubtotalCents,
    customizationCents,
    shirtsCents,
    standardQuantity: packageQuantity,
    standardShirtsCents: getPackagePrice(packageQuantity) * 100,
    bundleDiscountCents,
    promoDiscountCents,
    promoCode: promoDiscountCents > 0 ? BLACK_FRIDAY_PROMO_CODE : null,
    promoItems: promo.itensComDesconto,
    patchesCents,
    productsTotalCents: shirtsCents + customizationCents + patchesCents,
    shippingCents,
    totalCents: shirtsCents + customizationCents + patchesCents + shippingCents,
  };
}

export function calculateOrderFingerprint(request: PaymentRequest) {
  return JSON.stringify({
    items: request.items.map((line) => ({
      productId: line.productId,
      size: line.size,
      quantity: line.quantity,
      uniformVariation: line.uniformVariation ?? null,
      customization: line.customization
        ? { name: line.customization.name.trim(), number: line.customization.number.trim() }
        : null,
      patches: (line.patches ?? []).map((patch) => ({ id: patch.id, position: patch.position })).sort((a, b) => a.id.localeCompare(b.id)),
    })),
    customer: Object.fromEntries(Object.entries(request.customer).map(([key, value]) => [
      key,
      key === "cpf" || key === "phone" || key === "cep" ? String(value).replace(/\D/g, "") : String(value).trim(),
    ])),
  });
}
