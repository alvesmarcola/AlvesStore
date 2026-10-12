import type { VerifiedOrderLine } from "@/lib/payment/order";
import { storeConfig } from "@/config";

type OrderTotals = {
  quantity: number;
  shirtsCents: number;
  customizationCents: number;
};

function toPrice(cents: number) {
  return Number((cents / 100).toFixed(2));
}

export function buildPreferenceItems(orderId: string, lines: VerifiedOrderLine[], totals: OrderTotals) {
  const baseUnitPrice = Math.floor(totals.shirtsCents / totals.quantity);
  let remainingHigherPricedUnits = totals.shirtsCents % totals.quantity;

  return lines.flatMap((line, index) => {
    const higherPricedQuantity = Math.min(line.quantity, remainingHigherPricedUnits);
    remainingHigherPricedUnits -= higherPricedQuantity;
    const regularPricedQuantity = line.quantity - higherPricedQuantity;
    const items = [
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
    ];
    return items;
  });
}
