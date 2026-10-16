type OrderItemNotice = {
  title: string;
  size: string;
  quantity: number;
  customization?: { name: string; number: string } | null;
  patches?: { name: string; position: string }[];
};

export type OrderNotice = {
  id: string;
  status: string;
  customer: Record<string, string | boolean>;
  item_lines: OrderItemNotice[];
  shipping_cents: number;
  total_cents: number;
  tracking_code?: string | null;
};

export type OrderNoticeEvent = "order_paid" | "tracking_code_updated";

function whatsappRecipient(event: OrderNoticeEvent, order: OrderNotice) {
  if (event === "order_paid") return process.env.WHATSAPP_ORDER_RECIPIENT?.replace(/\D/g, "") ?? "";
  if (order.customer.whatsappUpdates !== true) return "";
  return String(order.customer.phone ?? "").replace(/\D/g, "");
}

/** Sends order events to a configured automation/provider that delivers WhatsApp messages. */
export async function sendWhatsAppOrderNotice(event: OrderNoticeEvent, order: OrderNotice): Promise<boolean | null> {
  const endpoint = process.env.WHATSAPP_ORDER_WEBHOOK_URL?.trim();
  if (!endpoint) return null;
  const recipient = whatsappRecipient(event, order);
  if (!recipient) {
    console.warn(`Notificação WhatsApp ${event} ignorada: destinatário não configurado ou sem opt-in.`);
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
  const body = {
    event,
    to: recipient,
    store: "Alves Store",
    order: {
      id: order.id,
      status: order.status,
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
  const items = order.item_lines.map((item) => `${item.title} · tamanho ${item.size} · ${item.quantity} un.`).join("\n");

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
      body: JSON.stringify({
        from,
        to: [email],
        subject: "Código de rastreio do seu pedido — Alves Store",
        text: `Olá, ${String(order.customer.fullName ?? "")}! O código de rastreio do pedido ${order.id.slice(0, 8).toUpperCase()} foi informado.\n\n${items}\n\nCódigo de rastreio: ${order.tracking_code}${siteUrl ? `\n\nAcompanhe em ${siteUrl}/rastreio` : ""}`,
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
