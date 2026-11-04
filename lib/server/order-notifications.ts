import { formatCustomization } from "@/lib/customization";
import { SITE_NAME } from "@/lib/site";

type OrderItemNotice = {
  title: string;
  size: string;
  quantity: number;
  customization?: { name?: string; number?: string } | null;
  patches?: { name: string; position: string }[];
};

export type OrderNotice = {
  id: string;
  status: string;
  operational_status?: string | null;
  customer: Record<string, string | boolean>;
  item_lines: OrderItemNotice[];
  shipping_cents: number;
  total_cents: number;
  tracking_code?: string | null;
  tracking_url?: string | null;
};

export type OrderNoticeEvent = "order_paid" | "tracking_code_updated";

function whatsappRecipient(order: OrderNotice) {
  if (order.customer.whatsappUpdates !== true) return "";
  const phone = String(order.customer.phone ?? "").replace(/\D/g, "");
  if (phone.length === 10 || phone.length === 11) return `55${phone}`;
  return phone;
}

/** Sends order events to a configured automation/provider that delivers WhatsApp messages. */
export async function sendWhatsAppOrderNotice(event: OrderNoticeEvent, order: OrderNotice): Promise<boolean | null> {
  const endpoint = process.env.WHATSAPP_ORDER_WEBHOOK_URL?.trim();
  if (!endpoint) return null;
  const recipient = whatsappRecipient(order);
  if (!recipient) {
    console.warn(`Notificação WhatsApp ${event} ignorada: cliente sem consentimento ou telefone válido.`);
    return false;
  }

  let url: URL;
  try {
    url = new URL(endpoint);
    if (url.protocol !== "https:") throw new Error("webhook must use HTTPS");
  } catch {
    console.error("Notificação WhatsApp não enviada: WHATSAPP_ORDER_WEBHOOK_URL precisa ser uma URL HTTPS válida.");
    return false;
  }

  const authorization = process.env.WHATSAPP_ORDER_WEBHOOK_TOKEN?.trim();
  const orderCode = order.id.slice(0, 8).toUpperCase();
  const trackingUrl = order.tracking_code
    ? order.tracking_url || `https://rastreamento.correios.com.br/app/index.php?codigo=${encodeURIComponent(order.tracking_code)}`
    : "";
  const customerName = String(order.customer.fullName ?? "").trim().split(/\s+/)[0] || "cliente";
  const items = order.item_lines.map((item) => {
    const customization = formatCustomization(item.customization);
    return `${item.title} · tam. ${item.size} × ${item.quantity}${customization ? ` · ${customization}` : ""}`;
  }).join("; ");
  const message = event === "order_paid"
    ? `Olá, ${customerName}! O pagamento do pedido ${orderCode} foi confirmado. Seu pedido da ${SITE_NAME} já está sendo preparado.${items ? ` Itens: ${items}.` : ""}`
    : `Olá, ${customerName}! Seu pedido ${orderCode} da ${SITE_NAME} foi despachado pelos Correios.${items ? ` Itens: ${items}.` : ""} Código de rastreio: ${order.tracking_code}. Acompanhe a entrega: ${trackingUrl}`;
  const body = {
    event,
    to: recipient,
    store: SITE_NAME,
    message,
    order: {
      id: order.id,
      status: order.status,
      operationalStatus: order.operational_status ?? null,
      items: order.item_lines,
      customer: {
        name: order.customer.fullName,
        email: order.customer.email,
        phone: order.customer.phone,
        address: {
          street: order.customer.street,
          number: order.customer.number,
          complement: order.customer.complement,
          neighborhood: order.customer.neighborhood,
          city: order.customer.city,
          state: order.customer.state,
          postalCode: order.customer.cep,
        },
      },
      shippingCents: order.shipping_cents,
      totalCents: order.total_cents,
      trackingCode: order.tracking_code ?? null,
      trackingUrl: order.tracking_url ?? trackingUrl,
    },
  };

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(authorization ? { authorization: `Bearer ${authorization}` } : {}),
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(6_000),
    });
    if (!response.ok) {
      console.error(`Webhook WhatsApp ${event} respondeu HTTP ${response.status}.`);
      return false;
    }
    return true;
  } catch (error) {
    console.error(`Falha no webhook WhatsApp ${event}:`, error instanceof Error ? error.message : "erro desconhecido");
    return false;
  }
}

export async function sendTrackingUpdateEmail(order: OrderNotice): Promise<boolean | null> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.ORDER_EMAIL_FROM?.trim();
  const email = String(order.customer.email ?? "");
  if (!apiKey || !from || !email) return null;
  if (!order.tracking_code) return null;
  const siteUrl = process.env.SITE_URL?.replace(/\/$/, "") ?? "";
  const trackingUrl = order.tracking_url || `https://rastreamento.correios.com.br/app/index.php?codigo=${encodeURIComponent(order.tracking_code)}`;
  const items = order.item_lines.map((item) => {
    const customization = formatCustomization(item.customization);
    return `${item.title} · tamanho ${item.size} · ${item.quantity} un.${customization ? ` · ${customization}` : ""}`;
  }).join("\n");

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
      body: JSON.stringify({
        from,
        to: [email],
        subject: `Código de rastreio do seu pedido — ${SITE_NAME}`,
        text: `Olá, ${String(order.customer.fullName ?? "")}! O código de rastreio do pedido ${order.id.slice(0, 8).toUpperCase()} foi informado.\n\n${items}\n\nCódigo de rastreio: ${order.tracking_code}\nAcompanhe a entrega: ${trackingUrl}${siteUrl ? `\n\nConsulte também seu pedido em ${siteUrl}/rastreio` : ""}`,
      }),
      signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok) {
      console.error("E-mail de rastreio não enviado:", response.status);
      return false;
    }
    return true;
  } catch (error) {
    console.error("Falha no e-mail de rastreio:", error instanceof Error ? error.message : "erro desconhecido");
    return false;
  }
}
