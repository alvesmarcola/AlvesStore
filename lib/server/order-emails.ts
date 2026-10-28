import { orderCode } from "@/lib/order-code";

export type EmailItem = {
  title: string;
  size: string;
  quantity: number;
  customization?: { name: string; number: string } | null;
  patches?: { name: string; position?: string }[];
};

export type OrderEmailInput = {
  orderId: string;
  customerName: string;
  items: EmailItem[];
  shippingCents: number;
  totalCents: number;
  siteUrl: string;
};

const money = (cents: number) => `R$ ${(cents / 100).toFixed(2).replace(".", ",")}`;

export function describeEmailItems(items: EmailItem[]) {
  return items.map((item) => {
    const parts = [`${item.title} · tamanho ${item.size} · ${item.quantity} un.`];
    if (item.customization) parts.push(`personalizado ${item.customization.name} ${item.customization.number}`);
    if (item.patches?.length) parts.push(`patches: ${item.patches.map((patch) => patch.position ? `${patch.name} (${patch.position})` : patch.name).join(", ")}`);
    return parts.join(" · ");
  }).join("\n");
}

function trackingInstructions({ orderId, siteUrl }: Pick<OrderEmailInput, "orderId" | "siteUrl">) {
  return `Código do seu pedido: ${orderCode(orderId)}\nGuarde este código. Para acompanhar, acesse ${siteUrl}/rastreio e informe o código junto com o e-mail ou o CPF usado na compra.`;
}

function summary(input: OrderEmailInput) {
  return `${describeEmailItems(input.items)}\nFrete: ${input.shippingCents === 0 ? "grátis" : money(input.shippingCents)}\nTotal: ${money(input.totalCents)}`;
}

export function buildOrderReceivedEmail(input: OrderEmailInput) {
  return {
    subject: `Pedido ${orderCode(input.orderId)} recebido — Alves Store`,
    text: `Olá, ${input.customerName}! Recebemos seu pedido. O pagamento ainda precisa ser concluído no Mercado Pago.\n\n${summary(input)}\n\n${trackingInstructions(input)}`,
  };
}

export function buildOrderPaidEmail(input: OrderEmailInput) {
  return {
    subject: `Pagamento aprovado — pedido ${orderCode(input.orderId)} — Alves Store`,
    text: `Olá, ${input.customerName}! Seu pagamento foi aprovado e o pedido será preparado.\n\n${summary(input)}\n\n${trackingInstructions(input)}`,
  };
}

/** Envia um e-mail transacional pelo Resend. Devolve null se o envio não estiver configurado. */
export async function sendOrderEmail(to: string, message: { subject: string; text: string }): Promise<boolean | null> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.ORDER_EMAIL_FROM?.trim();
  if (!apiKey || !from || !to) return null;
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
      body: JSON.stringify({ from, to: [to], subject: message.subject, text: message.text }),
      signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok) {
      console.error("E-mail do pedido não enviado:", response.status);
      return false;
    }
    return true;
  } catch (error) {
    console.error("Falha no e-mail do pedido:", error instanceof Error ? error.message : "erro desconhecido");
    return false;
  }
}
