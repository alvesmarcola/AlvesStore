import { NextResponse } from "next/server";
import { getPaymentClient, getSiteUrl, isProductionPaymentEnvironment } from "@/lib/server/mercado-pago";
import { getDatabasePool } from "@/lib/server/database";
import { isValidMercadoPagoSignature, normalizedPaymentStatus } from "@/lib/server/webhook-signature";

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
  if (eventType !== "payment" || !/^\d{1,30}$/.test(paymentId)) {
    return NextResponse.json({ received: true });
  }

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
    if (!status || amountCents === undefined || amountCents < 0) {
      return NextResponse.json({ received: true });
    }

    const pool = getDatabasePool();
    const transaction = await pool.connect();
    try {
      await transaction.query("BEGIN");
      const orderResult = await transaction.query<{ total_cents: number; status: string; customer: Record<string, string>; item_lines: { title: string; size: string; quantity: number; customization?: { name: string; number: string } }[]; shipping_cents: number }>(
        "SELECT total_cents, status, customer, item_lines, shipping_cents FROM store_orders WHERE id = $1 FOR UPDATE",
        [payment.external_reference],
      );
      const order = orderResult.rows[0];
      if (!order || Number(order.total_cents) !== amountCents) {
        await transaction.query("ROLLBACK");
        console.warn("Webhook Mercado Pago ignorado: pedido ausente ou valor divergente.");
        return NextResponse.json({ received: true });
      }

      const savedPayment = await transaction.query(
        `INSERT INTO store_order_payments (payment_id, order_id, status, amount_cents, currency, live_mode)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (payment_id) DO UPDATE
           SET status = EXCLUDED.status, amount_cents = EXCLUDED.amount_cents,
               currency = EXCLUDED.currency, live_mode = EXCLUDED.live_mode, updated_at = NOW()
           WHERE store_order_payments.order_id = EXCLUDED.order_id`,
        [paymentId, payment.external_reference, status, amountCents, payment.currency_id, payment.live_mode],
      );
      if (savedPayment.rowCount !== 1) {
        await transaction.query("ROLLBACK");
        console.warn("Webhook Mercado Pago ignorado: pagamento já vinculado a outro pedido.");
        return NextResponse.json({ received: true });
      }

      await transaction.query(
        `UPDATE store_orders
         SET status = CASE
           WHEN EXISTS (SELECT 1 FROM store_order_payments WHERE order_id = $1 AND status = 'approved') THEN 'approved'
           WHEN EXISTS (SELECT 1 FROM store_order_payments WHERE order_id = $1 AND status = 'pending') THEN 'pending'
           WHEN EXISTS (SELECT 1 FROM store_order_payments WHERE order_id = $1 AND status = 'refunded') THEN 'refunded'
           WHEN EXISTS (SELECT 1 FROM store_order_payments WHERE order_id = $1 AND status = 'rejected') THEN 'rejected'
           ELSE 'cancelled'
         END, updated_at = NOW()
         WHERE id = $1`,
        [payment.external_reference],
      );
      await transaction.query("COMMIT");
      if (status === "approved" && order.status !== "approved") {
        const apiKey = process.env.RESEND_API_KEY;
        const from = process.env.ORDER_EMAIL_FROM;
        if (apiKey && from) {
          const list = order.item_lines.map((item) => `${item.title} · tamanho ${item.size} · ${item.quantity} un.${item.customization ? ` · personalizado ${item.customization.name} ${item.customization.number}` : ""}`).join("\n");
          const amount = (cents: number) => `R$ ${(cents / 100).toFixed(2).replace(".", ",")}`;
          try {
            const response = await fetch("https://api.resend.com/emails", { method: "POST", headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" }, body: JSON.stringify({ from, to: [order.customer.email], subject: "Pagamento aprovado — Alves Store", text: `Olá, ${order.customer.fullName}! Seu pedido foi aprovado.\n\n${list}\nFrete: ${amount(Number(order.shipping_cents))}\nTotal: ${amount(Number(order.total_cents))}\n\nAcompanhe em ${getSiteUrl()}/rastreio` }), signal: AbortSignal.timeout(5_000) });
            if (!response.ok) console.error("E-mail transacional não enviado:", response.status);
          } catch (error) { console.error("Falha no e-mail transacional:", error instanceof Error ? error.message : "erro desconhecido"); }
        }
      }
    } catch (error) {
      await transaction.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      transaction.release();
    }
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Falha ao validar notificação do Mercado Pago:", error instanceof Error ? error.message : "erro desconhecido");
    return NextResponse.json({ error: "Não foi possível confirmar a notificação." }, { status: 500 });
  }
}
