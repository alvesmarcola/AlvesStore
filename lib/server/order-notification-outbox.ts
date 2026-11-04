import { buildOrderPaidEmail, sendOrderEmail } from "@/lib/server/order-emails";
import { sendWhatsAppOrderNotice, type OrderNotice } from "@/lib/server/order-notifications";
import { describeSupabaseError, getSupabaseOrdersClient } from "@/lib/server/supabase-orders";
import type { SupabaseClient } from "@supabase/supabase-js";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isValidWhatsAppRecipient(customer: Record<string, unknown>) {
  const phone = String(customer.phone ?? "").replace(/\D/g, "");
  return customer.whatsappUpdates === true && (phone.length === 10 || phone.length === 11 || phone.length >= 12);
}

export async function enqueuePaidOrderNotifications(
  supabase: SupabaseClient,
  orderId: string,
  customer: unknown,
) {
  if (!isRecord(customer)) throw new Error("O pedido aprovado não possui dados de cliente válidos.");
  const channels = [
    ...(typeof customer.email === "string" && customer.email.trim() ? ["email"] : []),
    ...(isValidWhatsAppRecipient(customer) ? ["whatsapp"] : []),
  ];
  if (!channels.length) return;

  const result = await supabase.from("store_order_notification_outbox").upsert(
    channels.map((channel) => ({
      order_id: orderId,
      event_name: "order_paid",
      channel,
    })),
    { onConflict: "order_id,event_name,channel", ignoreDuplicates: true },
  );
  if (result.error) throw result.error;
}

type ClaimedNotice = {
  notification_id: string;
  order_id: string;
  event_name: string;
  channel: "email" | "whatsapp";
  attempt_count: number;
};

type StoredOrder = {
  id: string;
  status: string;
  operational_status: string | null;
  customer: Record<string, string | boolean>;
  item_lines: OrderNotice["item_lines"];
  shipping_cents: number;
  total_cents: number;
  tracking_code: string | null;
  tracking_url: string | null;
};

function retryDelaySeconds(attempt: number) {
  return Math.min(60 * 2 ** Math.min(Math.max(attempt - 1, 0), 9), 21_600);
}

export async function dispatchOrderNotificationOutbox({
  orderId,
  limit = 20,
}: {
  orderId?: string;
  limit?: number;
} = {}) {
  const supabase = getSupabaseOrdersClient();
  const claim = await supabase.rpc("claim_store_order_notifications", {
    p_limit: limit,
    p_order_id: orderId ?? null,
  });
  if (claim.error) throw claim.error;
  const notices = (Array.isArray(claim.data) ? claim.data : []) as ClaimedNotice[];
  if (!notices.length) return { claimed: 0, delivered: 0 };

  const orderIds = [...new Set(notices.map((notice) => notice.order_id))];
  const ordersResult = await supabase.from("store_orders")
    .select("id,status,operational_status,customer,item_lines,shipping_cents,total_cents,tracking_code,tracking_url")
    .in("id", orderIds);
  if (ordersResult.error) throw ordersResult.error;
  const orders = new Map((ordersResult.data ?? []).map((order) => [order.id, order as StoredOrder]));
  let delivered = 0;

  for (const queued of notices) {
    const order = orders.get(queued.order_id);
    let succeeded = false;
    let failure = "order_not_found";

    if (order && queued.event_name === "order_paid") {
      const notice: OrderNotice = {
        id: order.id,
        status: order.status,
        operational_status: order.operational_status,
        customer: order.customer,
        item_lines: order.item_lines,
        shipping_cents: Number(order.shipping_cents),
        total_cents: Number(order.total_cents),
        tracking_code: order.tracking_code,
        tracking_url: order.tracking_url,
      };
      if (queued.channel === "whatsapp") {
        const result = await sendWhatsAppOrderNotice("order_paid", notice);
        succeeded = result === true;
        failure = result === null ? "whatsapp_provider_not_configured" : "whatsapp_delivery_failed";
      } else {
        const email = String(order.customer.email ?? "");
        const result = await sendOrderEmail(email, buildOrderPaidEmail({
          orderId: order.id,
          customerName: String(order.customer.fullName ?? ""),
          items: order.item_lines,
          shippingCents: Number(order.shipping_cents),
          totalCents: Number(order.total_cents),
          siteUrl: process.env.SITE_URL?.replace(/\/$/, "") || "https://importsalves.com.br",
        }));
        succeeded = result === true;
        failure = result === null ? "email_provider_not_configured" : "email_delivery_failed";
      }
    }

    const completed = await supabase.rpc("complete_store_order_notification", {
      p_notification_id: queued.notification_id,
      p_succeeded: succeeded,
      p_error: succeeded ? null : failure,
      p_retry_seconds: retryDelaySeconds(queued.attempt_count),
    });
    if (completed.error || completed.data !== true) {
      console.error("Não foi possível concluir a tentativa de notificação do pedido:", describeSupabaseError(completed.error ?? new Error("Notificação não estava mais reservada.")));
      continue;
    }
    if (succeeded) delivered += 1;
  }

  return { claimed: notices.length, delivered };
}
