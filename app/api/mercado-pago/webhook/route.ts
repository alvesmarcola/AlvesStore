import { after, NextResponse } from "next/server";
import { applyMercadoPagoPayment } from "@/lib/server/mercado-pago-payments";
import { dispatchOrderNotificationOutbox } from "@/lib/server/order-notification-outbox";
import { describeSupabaseError } from "@/lib/server/supabase-orders";
import { isValidMercadoPagoSignature } from "@/lib/server/webhook-signature";

export const runtime = "nodejs";

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null ? value as Record<string, unknown> : undefined;
}

export async function POST(request: Request) {
  const url = new URL(request.url);
  const query = url.searchParams;

  const rawBody = await request.text().catch(() => "");
  let body: unknown;
  if (rawBody.trim()) {
    try {
      body = JSON.parse(rawBody);
    } catch {
      console.warn("[Webhook Mercado Pago] Falha ao processar corpo JSON:", rawBody);
      return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
    }
  }

  const event = asRecord(body);
  const data = asRecord(event?.data);

  const queryType = query.get("type") || query.get("topic") || "";
  const bodyType = typeof event?.type === "string" ? event.type : "";
  const actionType = typeof event?.action === "string" ? event.action : "";
  const isPaymentEvent = queryType === "payment" || bodyType === "payment" || actionType.startsWith("payment");

  const queryDataId = query.get("data.id") || query.get("id") || "";
  const bodyDataId = typeof data?.id === "string" || typeof data?.id === "number" ? String(data.id) : "";
  const eventId = isPaymentEvent && (typeof event?.id === "string" || typeof event?.id === "number") ? String(event.id) : "";
  const paymentId = String(queryDataId || bodyDataId || eventId).trim();

  const signatureHeader = request.headers.get("x-signature");
  const requestIdHeader = request.headers.get("x-request-id");

  console.log("[Webhook Mercado Pago] Notificação recebida:", {
    url: request.url,
    queryType,
    bodyType,
    actionType,
    isPaymentEvent,
    paymentId,
    hasSignature: Boolean(signatureHeader),
    hasRequestId: Boolean(requestIdHeader),
  });

  // Aceita tanto MERCADOPAGO_WEBHOOK_SECRET quanto MERCADO_PAGO_WEBHOOK_SECRET
  const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET?.trim()
    || process.env.MERCADO_PAGO_WEBHOOK_SECRET?.trim();

  if (!secret) {
    console.error("[Webhook Mercado Pago] ERRO CRÍTICO: Nem MERCADOPAGO_WEBHOOK_SECRET nem MERCADO_PAGO_WEBHOOK_SECRET estão configuradas na Vercel! A notificação não pode ser validada.");
    return NextResponse.json({ error: "Assinatura de webhook não configurada no servidor." }, { status: 401 });
  }

  const isValid = isValidMercadoPagoSignature({
    secret,
    signature: signatureHeader,
    requestId: requestIdHeader,
    dataId: queryDataId || paymentId,
  });

  if (!isValid) {
    console.warn("[Webhook Mercado Pago] Assinatura do webhook inválida:", {
      signatureHeader,
      requestIdHeader,
      dataIdChecked: queryDataId || paymentId,
    });
    return NextResponse.json({ error: "Assinatura de webhook inválida." }, { status: 401 });
  }

  // Eventos não relacionados a pagamento ou sem ID válido são confirmados com 200
  if (!isPaymentEvent || !/^\d{1,30}$/.test(paymentId)) {
    console.log("[Webhook Mercado Pago] Evento ignorado (não é pagamento ou ID inválido):", { isPaymentEvent, paymentId });
    return NextResponse.json({ received: true });
  }

  try {
    console.log(`[Webhook Mercado Pago] Iniciando aplicação do pagamento ${paymentId}...`);
    const result = await applyMercadoPagoPayment(paymentId, {
      topic: queryType || bodyType,
      action: actionType,
      rawEvent: body,
    });

    if (result.orphan) {
      console.warn(`[Webhook Mercado Pago] Pagamento ${paymentId} registrado como ÓRFÃO (sem pedido correspondente).`);
      return NextResponse.json({ received: true, orphan: true });
    }

    if (result.divergent) {
      console.warn(`[Webhook Mercado Pago] Pagamento ${paymentId} registrado como DIVERGENTE para o pedido ${result.orderId}.`);
      return NextResponse.json({ received: true, divergent: true, orderId: result.orderId });
    }

    if (!result.applied) {
      console.warn(`[Webhook Mercado Pago] Pagamento ${paymentId} não foi aplicado. Motivo: status não aprovado ou valor/ambiente divergente.`);
      return NextResponse.json({ received: true });
    }

    console.log(`[Webhook Mercado Pago] Sucesso! Pagamento ${paymentId} aplicado ao pedido ${result.orderId}.`);

    if (result.status === "approved" && result.orderId) {
      after(async () => {
        try {
          await dispatchOrderNotificationOutbox({ orderId: result.orderId });
        } catch (error) {
          console.error("Notificações do pedido ficaram pendentes no outbox:", describeSupabaseError(error));
        }
      });
    }

    return NextResponse.json({ received: true, orderId: result.orderId, status: result.status });
  } catch (error) {
    console.error(`[Webhook Mercado Pago] Falha técnica ao processar pagamento ${paymentId}:`, error);
    // Retorna status 500 para falhas de infraestrutura, permitindo que o Mercado Pago tente reenviar a notificação
    return NextResponse.json({
      error: "Erro transitório ao processar pagamento. Tentativa será reagendada.",
      details: error instanceof Error ? error.message : String(error),
    }, { status: 500 });
  }
}
