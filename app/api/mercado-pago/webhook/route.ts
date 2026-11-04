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

  const secret = process.env.MERCADO_PAGO_WEBHOOK_SECRET;
  if (!secret || !isValidMercadoPagoSignature({
    secret,
    signature: request.headers.get("x-signature"),
    requestId: request.headers.get("x-request-id"),
    dataId: paymentId,
  })) {
    return NextResponse.json({ error: "Assinatura de webhook inválida." }, { status: 401 });
  }
  if (eventType !== "payment" || !/^\d{1,30}$/.test(paymentId)) return NextResponse.json({ received: true });

  try {
    const result = await applyMercadoPagoPayment(paymentId);
    if (!result.applied) {
      console.warn("Webhook Mercado Pago ignorado: pagamento não corresponde a pedido/valor/ambiente válidos.");
      return NextResponse.json({ received: true });
    }

    if (result.status === "approved" && result.orderId) {
      after(async () => {
        try {
          await dispatchOrderNotificationOutbox({ orderId: result.orderId });
        } catch (error) {
          console.error("Notificações do pedido ficaram pendentes no outbox:", describeSupabaseError(error));
        }
      });
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Falha ao validar notificação do Mercado Pago:", describeSupabaseError(error));
    return NextResponse.json({ error: "Não foi possível confirmar a notificação." }, { status: 500 });
  }
}
