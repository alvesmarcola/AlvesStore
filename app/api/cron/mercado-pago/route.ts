import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { reconcileMercadoPagoOrder } from "@/lib/server/mercado-pago-payments";
import { dispatchOrderNotificationOutbox } from "@/lib/server/order-notification-outbox";
import { describeSupabaseError, getSupabaseOrdersClient, SupabaseOrdersConfigurationError } from "@/lib/server/supabase-orders";
import { PaymentConfigurationError } from "@/lib/server/mercado-pago";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function isAuthorized(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  const authorization = request.headers.get("authorization") ?? "";
  if (!secret || !authorization.startsWith("Bearer ")) return false;
  const supplied = Buffer.from(authorization.slice(7));
  const expected = Buffer.from(secret);
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json(
      { error: process.env.CRON_SECRET ? "Não autorizado." : "CRON_SECRET não está configurado no servidor." },
      { status: process.env.CRON_SECRET ? 401 : 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    const supabase = getSupabaseOrdersClient();

    // Expira pedidos pendentes com mais de 48 horas (abandonos de checkout)
    const cutoff48h = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
    await supabase.from("store_orders")
      .update({
        operational_status: "cancelado",
        status: "cancelled",
        updated_at: new Date().toISOString(),
      })
      .eq("status", "pending")
      .or("operational_status.is.null,operational_status.eq.aguardando_pagamento")
      .lt("created_at", cutoff48h);

    const claimed = await supabase.rpc("claim_store_orders_for_payment_reconciliation", { p_limit: 10 });
    if (claimed.error) throw claimed.error;

    let paymentsApplied = 0;
    for (const order of claimed.data ?? []) {
      try {
        const results = await reconcileMercadoPagoOrder(String(order.order_id));
        paymentsApplied += results.filter((result) => result.applied).length;
      } catch (error) {
        if (error instanceof PaymentConfigurationError) throw error;
        console.error("Reconciliação de pagamento será repetida:", describeSupabaseError(error));
      }
    }

    const notifications = await dispatchOrderNotificationOutbox({ limit: 30 });
    return NextResponse.json({
      checkedOrders: claimed.data?.length ?? 0,
      paymentsApplied,
      notificationsClaimed: notifications.claimed,
      notificationsDelivered: notifications.delivered,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const configurationError = error instanceof PaymentConfigurationError
      || error instanceof SupabaseOrdersConfigurationError;
    console.error("Falha na rotina de reconciliação Mercado Pago:", describeSupabaseError(error));
    return NextResponse.json(
      {
        error: configurationError
          ? error.message
          : "Não foi possível processar a rotina de pagamentos.",
      },
      { status: configurationError ? 503 : 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
