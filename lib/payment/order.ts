import { z } from "zod";
import { storeConfig } from "@/config";
import { getPackagePrice, getShippingCents } from "@/lib/commerce";
import { checkoutSchema } from "@/lib/validation";
import type { Product } from "@/lib/types";
import { classifyProduct, isPackageEligible } from "@/lib/product-classification";
import { getAvailablePatches } from "@/lib/patch-compatibility";
import { allowsCustomization } from "@/lib/formula-one";
import { getSupabaseProductsForCheckout } from "@/lib/server/supabase-catalog";
import { getProductSizeSurcharge } from "@/lib/product-classification";

export const orderLinesSchema = z.array(z.object({
  productId: z.string().min(1).max(100),
  size: z.string().trim().min(1).max(12),
  quantity: z.number().int().min(1).max(20),
  customization: z.object({
    name: z.string().trim().min(1).max(12),
    number: z.string().trim().regex(/^\d{1,2}$/),
  }).strict().optional(),
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
    const product = catalog.find((candidate) => candidate.id === line.productId);
    if (!product) throw new InvalidOrderError("Um dos produtos não está mais disponível.");
    if (line.size === "3GG" || !product.tamanhos.includes(line.size)) throw new InvalidOrderError("Um dos tamanhos selecionados não está disponível.");
    if (line.customization && !allowsCustomization(product)) throw new InvalidOrderError("Camisas de Fórmula 1 não podem ser personalizadas.");
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

    const key = JSON.stringify([line.productId, line.size, line.customization?.name ?? "", line.customization?.number ?? "", [...(line.patches ?? [])].sort((a, b) => a.id.localeCompare(b.id))]);
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
  return validateOrderLines(lines, await getSupabaseProductsForCheckout());
}

export function calculateOrderTotals(lines: VerifiedOrderLine[]) {
  const quantity = lines.reduce((sum, line) => sum + line.quantity, 0);
  const personalizedQuantity = lines.reduce(
    (sum, line) => sum + (line.customization ? line.quantity : 0),
    0,
  );
  const packageQuantity = lines.reduce((sum, line) => {
    return sum + (isPackageEligible(line.product) ? line.quantity : 0);
  }, 0);
  const baseSubtotalCents = lines.reduce((sum, line) => sum + ((classifyProduct(line.product).price ?? 0) + getProductSizeSurcharge(line.size)) * line.quantity * 100, 0);
  const pricedOutsidePackagesCents = baseSubtotalCents - packageQuantity * storeConfig.fanCommonPrice * 100;
  const customizationCents = personalizedQuantity * storeConfig.customizationPrice * 100;
  const shirtsCents = getPackagePrice(packageQuantity) * 100 + pricedOutsidePackagesCents;
  const patchesCents = lines.reduce((sum, line) => sum + line.quantity * line.patchOptions.reduce((patchSum, patch) => patchSum + patch.priceCents, 0), 0);
  const bundleDiscountCents = baseSubtotalCents - shirtsCents;
  const shippingCents = getShippingCents(quantity);

  return {
    quantity,
    personalizedQuantity,
    baseSubtotalCents,
    customizationCents,
    shirtsCents,
    standardQuantity: packageQuantity,
    standardShirtsCents: getPackagePrice(packageQuantity) * 100,
    bundleDiscountCents,
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
