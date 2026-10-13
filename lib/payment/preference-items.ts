import type { VerifiedOrderLine } from "@/lib/payment/order";
import { storeConfig } from "@/config";

type OrderTotals = {
  quantity: number;
  shirtsCents: number;
  standardQuantity: number;
  standardShirtsCents: number;
  customizationCents: number;
};

function toPrice(cents: number) {
  return Number((cents / 100).toFixed(2));
}

export function buildPreferenceItems(orderId: string, lines: VerifiedOrderLine[], totals: OrderTotals) {
  const baseUnitPrice = totals.standardQuantity > 0 ? Math.floor(totals.standardShirtsCents / totals.standardQuantity) : 0;
  let remainingHigherPricedUnits = totals.standardQuantity > 0 ? totals.standardShirtsCents % totals.standardQuantity : 0;

  return lines.flatMap((line, index) => {
    const retro = line.product.tipo === "retro";
    const higherPricedQuantity = retro ? 0 : Math.min(line.quantity, remainingHigherPricedUnits);
    if (!retro) remainingHigherPricedUnits -= higherPricedQuantity;
    const regularPricedQuantity = retro ? 0 : line.quantity - higherPricedQuantity;
    const items = [
      ...(retro ? [{
        id: `${orderId}-retro-shirt-${index}`,
        title: `${line.product.nome} (tamanho ${line.size})`,
        quantity: line.quantity,
        currency_id: "BRL",
        unit_price: storeConfig.retroShirtPrice,
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
    ];
    return items;
  });
}
