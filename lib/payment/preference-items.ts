import type { VerifiedOrderLine } from "@/lib/payment/order";
import { storeConfig } from "@/config";
import { classifyProduct, isPackageEligible } from "@/lib/product-classification";

type OrderTotals = {
  quantity: number;
  shirtsCents: number;
  standardQuantity: number;
  standardShirtsCents: number;
  patchesCents: number;
  customizationCents: number;
};

function toPrice(cents: number) {
  return Number((cents / 100).toFixed(2));
}

export function buildPreferenceItems(orderId: string, lines: VerifiedOrderLine[], totals: OrderTotals) {
  const baseUnitPrice = totals.standardQuantity > 0 ? Math.floor(totals.standardShirtsCents / totals.standardQuantity) : 0;
  let remainingHigherPricedUnits = totals.standardQuantity > 0 ? totals.standardShirtsCents % totals.standardQuantity : 0;

  return lines.flatMap((line, index) => {
    const facts = classifyProduct(line.product);
    const packageEligible = isPackageEligible(line.product);
    const higherPricedQuantity = packageEligible ? Math.min(line.quantity, remainingHigherPricedUnits) : 0;
    if (packageEligible) remainingHigherPricedUnits -= higherPricedQuantity;
    const regularPricedQuantity = packageEligible ? line.quantity - higherPricedQuantity : 0;
    const items = [
      ...(!packageEligible ? [{
        id: `${orderId}-shirt-${index}`,
        title: `${line.product.nome} (tamanho ${line.size})`,
        quantity: line.quantity,
        currency_id: "BRL",
        unit_price: facts.price ?? 0,
      }] : []),
      ...(regularPricedQuantity > 0 ? [{
        id: `${orderId}-shirt-${index}-regular`,
        title: `${line.product.nome} (tamanho ${line.size})`,
        quantity: regularPricedQuantity,
        currency_id: "BRL",
        unit_price: toPrice(baseUnitPrice),
      }] : []),
      ...(higherPricedQuantity > 0 ? [{
        id: `${orderId}-shirt-${index}-adjusted`,
        title: `${line.product.nome} (tamanho ${line.size})`,
        quantity: higherPricedQuantity,
        currency_id: "BRL",
        unit_price: toPrice(baseUnitPrice + 1),
      }] : []),
      ...(line.customization ? [{
        id: `${orderId}-customization-${index}`,
        title: `Personalização - ${line.product.nome} (tamanho ${line.size})`,
        quantity: line.quantity,
        currency_id: "BRL",
        unit_price: storeConfig.customizationPrice,
      }] : []),
      ...line.patchOptions.map((patch, patchIndex) => ({
        id: `${orderId}-patch-${index}-${patchIndex}`,
        title: `${patch.name} - ${line.patches?.[patchIndex]?.position ?? "posição confirmada"} (${line.product.nome})`,
        quantity: line.quantity,
        currency_id: "BRL",
        unit_price: toPrice(patch.priceCents),
      })),
    ];
    return items;
  });
}
