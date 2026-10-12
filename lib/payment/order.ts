import { z } from "zod";
import { storeConfig } from "@/config";
import { products } from "@/lib/catalog";
import { getPackagePrice } from "@/lib/commerce";
import { checkoutSchema } from "@/lib/validation";
import type { Product } from "@/lib/types";

export const orderLinesSchema = z.array(z.object({
  productId: z.string().min(1).max(100),
  size: z.string().trim().min(1).max(12),
  quantity: z.number().int().min(1).max(20),
  customization: z.object({
    name: z.string().trim().min(1).max(12),
    number: z.string().trim().regex(/^\d{1,2}$/),
  }).strict().optional(),
}).strict()).min(1).max(20);

export const shippingQuoteRequestSchema = z.object({
  items: orderLinesSchema,
  cep: z.string().transform((value) => value.replace(/\D/g, "")).pipe(z.string().regex(/^\d{8}$/)),
}).strict();

export const paymentRequestSchema = z.object({
  idempotencyKey: z.string().uuid(),
  items: orderLinesSchema,
  customer: checkoutSchema.strict(),
  shipping: z.object({
    serviceCode: z.string().min(1).max(12).optional(),
    quotedPriceCents: z.number().int().nonnegative().max(100_000).optional(),
  }).strict(),
}).strict();

export type OrderLineInput = z.infer<typeof orderLinesSchema>[number];
export type CheckoutCustomer = z.infer<typeof paymentRequestSchema>["customer"];
export type PaymentRequest = z.infer<typeof paymentRequestSchema>;
export type VerifiedOrderLine = OrderLineInput & { product: Product };

export class InvalidOrderError extends Error {}

export function validateOrderLines(lines: OrderLineInput[]): VerifiedOrderLine[] {
  const seen = new Set<string>();
  let quantityTotal = 0;

  const verified = lines.map((line) => {
    const product = products.find((candidate) => candidate.id === line.productId);
    if (!product) throw new InvalidOrderError("Um dos produtos não está mais disponível.");
    if (!product.tamanhos.includes(line.size)) throw new InvalidOrderError("Um dos tamanhos selecionados não está disponível.");

    const key = JSON.stringify([line.productId, line.size, line.customization?.name ?? "", line.customization?.number ?? ""]);
    if (seen.has(key)) throw new InvalidOrderError("O carrinho contém linhas repetidas. Atualize a página e tente novamente.");
    seen.add(key);
    quantityTotal += line.quantity;
    return {
      ...line,
      ...(line.customization
        ? { customization: { name: line.customization.name.trim(), number: line.customization.number.trim() } }
        : {}),
      product,
    };
  });

  if (quantityTotal > 30) throw new InvalidOrderError("O limite por pedido é de 30 camisas.");
  return verified;
}

export function calculateOrderTotals(lines: VerifiedOrderLine[]) {
  const quantity = lines.reduce((sum, line) => sum + line.quantity, 0);
  const personalizedQuantity = lines.reduce(
    (sum, line) => sum + (line.customization ? line.quantity : 0),
    0,
  );
  const baseSubtotalCents = quantity * storeConfig.shirtPrice * 100;
  const customizationCents = personalizedQuantity * storeConfig.customizationPrice * 100;
  const shirtsCents = getPackagePrice(quantity) * 100;
  const bundleDiscountCents = baseSubtotalCents - shirtsCents;

  return {
    quantity,
    personalizedQuantity,
    baseSubtotalCents,
    customizationCents,
    shirtsCents,
    bundleDiscountCents,
    productsTotalCents: shirtsCents + customizationCents,
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
    })),
    customer: Object.fromEntries(Object.entries(request.customer).map(([key, value]) => [
      key,
      key === "cpf" || key === "phone" || key === "cep" ? String(value).replace(/\D/g, "") : String(value).trim(),
    ])),
    shipping: request.shipping,
  });
}
