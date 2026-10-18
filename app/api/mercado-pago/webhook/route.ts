import { NextResponse } from "next/server";
import { getPaymentClient, getSiteUrl, isProductionPaymentEnvironment } from "@/lib/server/mercado-pago";
import { getSupabaseOrdersClient } from "@/lib/server/supabase-orders";
import { isValidMercadoPagoSignature, normalizedPaymentStatus } from "@/lib/server/webhook-signature";
import { sendWhatsAppOrderNotice, type OrderNotice } from "@/lib/server/order-notifications";

export const runtime = "nodejs";

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null ? value as Record<string, unknown> : undefined;
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  const event = asRecord(body);
  const data = asRecord(event?.data);
  const query = new URL(request.url).searchParams;
  const eventType = String(query.get("type") ?? event?.type ?? "");
  const paymentId = String(query.get("data.id") ?? query.get("id") ?? data?.id ?? "");
  if (eventType !== "payment" || !/^\d{1,30}$/.test(paymentId)) return NextResponse.json({ received: true });

  const secret = process.env.MERCADO_PAGO_WEBHOOK_SECRET;
  const requestId = request.headers.get("x-request-id");
  if (!secret || !isValidMercadoPagoSignature({
    secret,
    signature: request.headers.get("x-signature"),
    requestId,
    dataId: paymentId,
  })) {
    return NextResponse.json({ error: "Assinatura de webhook inválida." }, { status: 401 });
  }

  try {
    const payment = await getPaymentClient().get({ id: paymentId });
    if (payment.live_mode !== isProductionPaymentEnvironment() || payment.currency_id !== "BRL"
      || !payment.external_reference || !/^[0-9a-f-]{36}$/i.test(payment.external_reference)) {
      return NextResponse.json({ received: true });
    }

    const status = normalizedPaymentStatus(payment.status);
    const amountCents = typeof payment.transaction_amount === "number"
      ? Math.round(payment.transaction_amount * 100)
      : undefined;
    if (!status || amountCents === undefined || amountCents < 0) return NextResponse.json({ received: true });

    const supabase = getSupabaseOrdersClient();
    const result = await supabase.rpc("apply_store_payment", {
      p_payment_id: paymentId,
      p_order_id: payment.external_reference,
      p_status: status,
      p_amount_cents: amountCents,
      p_currency: payment.currency_id,
      p_live_mode: payment.live_mode,
    });
    if (result.error) throw result.error;
    const order = Array.isArray(result.data) ? result.data[0] : null;
    if (!order?.applied) {
      console.warn("Webhook Mercado Pago ignorado: pedido ausente, valor divergente ou pagamento associado a outro pedido.");
      return NextResponse.json({ received: true });
    }

    const orderPayment = await supabase.from("store_orders")
      .update({
        mercado_pago_status: payment.status ?? status,
        mercado_pago_id: String(payment.id ?? paymentId),
        updated_at: new Date().toISOString(),
      })
      .eq("id", payment.external_reference)
      .select("id")
      .maybeSingle();
    if (orderPayment.error || !orderPayment.data) {
      throw orderPayment.error ?? new Error("Pedido não encontrado ao persistir os dados do Mercado Pago.");
    }

    if (status === "approved" && order.previous_status !== "approved") {
      const notice: OrderNotice = {
        id: payment.external_reference,
        status: "approved",
        customer: order.customer,
        item_lines: order.item_lines,
        shipping_cents: Number(order.shipping_cents),
        total_cents: Number(order.total_cents),
      };
      await sendWhatsAppOrderNotice("order_paid", notice);
      const apiKey = process.env.RESEND_API_KEY;
      const from = process.env.ORDER_EMAIL_FROM;
      if (apiKey && from) {
        const list = notice.item_lines.map((item) => `${item.title} · tamanho ${item.size} · ${item.quantity} un.${item.customization ? ` · personalizado ${item.customization.name} ${item.customization.number}` : ""}${item.patches?.length ? ` · patches: ${item.patches.map((patch) => `${patch.name} (${patch.position})`).join(", ")}` : ""}`).join("\n");
        const amount = (cents: number) => `R$ ${(cents / 100).toFixed(2).replace(".", ",")}`;
        try {
          const response = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
            body: JSON.stringify({
              from,
              to: [notice.customer.email],
              subject: "Pagamento aprovado — Alves Store",
              text: `Olá, ${notice.customer.fullName}! Seu pedido foi aprovado.\n\n${list}\nFrete: ${amount(notice.shipping_cents)}\nTotal: ${amount(notice.total_cents)}\n\nAcompanhe em ${getSiteUrl()}/rastreio`,
            }),
            signal: AbortSignal.timeout(5_000),
          });
          if (!response.ok) console.error("E-mail transacional não enviado:", response.status);
        } catch (error) {
          console.error("Falha no e-mail transacional:", error instanceof Error ? error.message : "erro desconhecido");
        }
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Falha ao validar notificação do Mercado Pago:", error instanceof Error ? error.message : "erro desconhecido");
    return NextResponse.json({ error: "Não foi possível confirmar a notificação." }, { status: 500 });
  }
}
