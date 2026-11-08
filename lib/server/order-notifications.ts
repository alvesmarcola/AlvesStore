import { formatCustomization } from "@/lib/customization";
import { SITE_NAME } from "@/lib/site";

export type OrderItemNotice = {
  title: string;
  size: string;
  quantity: number;
  uniformVariation?: string | null;
  customization?: { name?: string; number?: string } | null;
  patches?: { name: string; position?: string }[];
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
  payment_method_id?: string | null;
  payment_type_id?: string | null;
  shipping?: Record<string, unknown> | null;
  is_test?: boolean | null;
  paid_notified_at?: string | null;
};

export type OrderNoticeEvent = "order_paid" | "order_paid_owner" | "tracking_code_updated";

const money = (cents: number) => `R$ ${(cents / 100).toFixed(2).replace(".", ",")}`;

export function formatNoticePaymentMethod(paymentMethodId?: string | null, paymentTypeId?: string | null): string {
  const method = (paymentMethodId || "").toLowerCase();
  const type = (paymentTypeId || "").toLowerCase();
  if (method === "pix" || type === "bank_transfer") return "PIX";
  if (type === "credit_card" || method.includes("credit") || ["visa", "master", "elo", "hipercard", "amex"].includes(method)) {
    return "Cartão de Crédito";
  }
  if (type === "ticket" || method.includes("bol")) return "Boleto Bancário";
  if (method) return method.toUpperCase();
  return "Mercado Pago";
}

export function formatNoticeAddress(customer: Record<string, unknown>): string {
  const street = customer.street ? String(customer.street).trim() : "";
  const number = customer.number ? String(customer.number).trim() : "s/n";
  const complement = customer.complement ? ` (${String(customer.complement).trim()})` : "";
  const neighborhood = customer.neighborhood ? String(customer.neighborhood).trim() : "";
  const city = customer.city ? String(customer.city).trim() : "";
  const state = customer.state ? String(customer.state).trim() : "";
  const cep = customer.cep ? String(customer.cep).trim() : "";

  if (!street && !city) return "Endereço não informado";
  return `${street}, ${number}${complement} - ${neighborhood ? `${neighborhood}, ` : ""}${city}/${state} - CEP ${cep}`;
}

export function describeNoticeItems(items: OrderItemNotice[]): string {
  return items.map((item) => {
    const parts = [`${item.title} (tam. ${item.size} × ${item.quantity})`];
    if (item.uniformVariation) {
      parts.push(item.uniformVariation === "fora" ? "Uniforme: Fora" : "Uniforme: Casa");
    }
    const customization = formatCustomization(item.customization);
    if (customization) parts.push(`personalização: ${customization}`);
    if (item.patches?.length) {
      parts.push(`patches: ${item.patches.map((p) => p.name).join(", ")}`);
    }
    return `• ${parts.join(" · ")}`;
  }).join("\n");
}

function whatsappRecipient(order: OrderNotice) {
  if (order.customer.whatsappUpdates !== true) return "";
  const phone = String(order.customer.phone ?? "").replace(/\D/g, "");
  if (phone.length === 10 || phone.length === 11) return `55${phone}`;
  return phone;
}

export type WhatsAppNoticeOptions = {
  to?: string;
};

/** Sends order events to a configured automation/provider that delivers WhatsApp messages. */
export async function sendWhatsAppOrderNotice(
  event: OrderNoticeEvent,
  order: OrderNotice,
  options?: WhatsAppNoticeOptions,
): Promise<boolean | null> {
  const endpoint = process.env.WHATSAPP_ORDER_WEBHOOK_URL?.trim();
  if (!endpoint) return null;

  let recipient = "";
  if (event === "order_paid_owner") {
    recipient = (options?.to || process.env.OWNER_NOTIFY_WHATSAPP || "").replace(/\D/g, "");
    if (!recipient) {
      // Notificação do dono não configurada (sem destinatário)
      return null;
    }
  } else {
    recipient = (options?.to ? options.to.replace(/\D/g, "") : whatsappRecipient(order));
    if (!recipient) {
      // Cliente sem opt-in ou sem telefone válido
      return false;
    }
  }

  let url: URL;
  try {
    url = new URL(endpoint);
    if (url.protocol !== "https:") throw new Error("webhook must use HTTPS");
  } catch {
    console.error("[OrderNotice] WHATSAPP_ORDER_WEBHOOK_URL precisa ser uma URL HTTPS válida.");
    return false;
  }

  const authorization = process.env.WHATSAPP_ORDER_WEBHOOK_TOKEN?.trim();
  const orderCode = order.id.slice(0, 8).toUpperCase();
  const trackingUrl = order.tracking_code
    ? order.tracking_url || `https://rastreamento.correios.com.br/app/index.php?codigo=${encodeURIComponent(order.tracking_code)}`
    : "";
  const customerFullName = String(order.customer.fullName ?? "").trim() || "Cliente";
  const customerFirstName = customerFullName.split(/\s+/)[0] || "cliente";
  const customerPhone = String(order.customer.phone ?? "").trim() || "Não informado";
  const customerEmail = String(order.customer.email ?? "").trim() || "Não informado";
  const itemsText = describeNoticeItems(order.item_lines);
  const totalText = money(order.total_cents);
  const shippingText = order.shipping_cents === 0 ? "Grátis" : money(order.shipping_cents);
  const paymentText = formatNoticePaymentMethod(order.payment_method_id, order.payment_type_id);
  const addressText = formatNoticeAddress(order.customer);

  let message = "";
  if (event === "order_paid_owner") {
    message = [
      `🚨 NOVO PEDIDO PAGO NA ${SITE_NAME}! 🚨`,
      ``,
      `Pedido: #${orderCode}`,
      `Cliente: ${customerFullName}`,
      `Telefone: ${customerPhone}`,
      `E-mail: ${customerEmail}`,
      ``,
      `📦 Itens:`,
      itemsText,
      ``,
      `💰 Total: ${totalText} (Frete: ${shippingText})`,
      `💳 Forma de Pagamento: ${paymentText}`,
      ``,
      `📍 Endereço de entrega:`,
      addressText,
    ].join("\n");
  } else if (event === "order_paid") {
    message = [
      `Olá, ${customerFirstName}! O pagamento do seu pedido #${orderCode} foi confirmado com sucesso.`,
      `Seu pedido da ${SITE_NAME} já está sendo preparado com muito carinho.`,
      ``,
      `📦 Itens:`,
      itemsText,
      ``,
      `💰 Total: ${totalText} (Frete: ${shippingText})`,
      `💳 Forma de Pagamento: ${paymentText}`,
      ``,
      `📍 Endereço de entrega:`,
      addressText,
      ``,
      `Assim que seu pacote for despachado, você receberá o código de rastreamento por aqui!`,
    ].join("\n");
  } else {
    message = `Olá, ${customerFirstName}! Seu pedido #${orderCode} da ${SITE_NAME} foi despachado pelos Correios.\n\n${itemsText}\n\nCódigo de rastreio: ${order.tracking_code}\nAcompanhe a entrega: ${trackingUrl}`;
  }

  const body = {
    event,
    to: recipient,
    store: SITE_NAME,
    message,
    order: {
      id: order.id,
      code: orderCode,
      status: order.status,
      operationalStatus: order.operational_status ?? null,
      items: order.item_lines,
      paymentMethod: paymentText,
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
          formatted: addressText,
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
      console.error(`[OrderNotice] Webhook WhatsApp ${event} para pedido #${orderCode} respondeu HTTP ${response.status}.`);
      return false;
    }
    return true;
  } catch (error) {
    const errorType = error instanceof Error ? error.name : "ErroDesconhecido";
    console.error(`[OrderNotice] Falha no webhook WhatsApp ${event} para pedido #${orderCode}: ${errorType}`);
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
  const orderCode = order.id.slice(0, 8).toUpperCase();
  const itemsText = describeNoticeItems(order.item_lines);

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
      body: JSON.stringify({
        from,
        to: [email],
        subject: `Código de rastreio do seu pedido — ${SITE_NAME}`,
        text: `Olá, ${String(order.customer.fullName ?? "")}! O código de rastreio do pedido #${orderCode} foi informado.\n\n${itemsText}\n\nCódigo de rastreio: ${order.tracking_code}\nAcompanhe a entrega: ${trackingUrl}${siteUrl ? `\n\nConsulte também seu pedido em ${siteUrl}/rastreio` : ""}`,
      }),
      signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok) {
      console.error(`[OrderEmails] E-mail de rastreio para pedido #${orderCode} não enviado (HTTP ${response.status}).`);
      return false;
    }
    return true;
  } catch (error) {
    const errorType = error instanceof Error ? error.name : "ErroDesconhecido";
    console.error(`[OrderEmails] Falha no e-mail de rastreio para pedido #${orderCode}: ${errorType}`);
    return false;
  }
}
