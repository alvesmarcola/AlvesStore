import { buildOrderPaidEmail, buildOwnerOrderPaidEmail, sendOrderEmail } from "@/lib/server/order-emails";
import {
  formatNoticeAddress,
  formatNoticePaymentMethod,
  sendWhatsAppOrderNotice,
  type OrderNotice,
} from "@/lib/server/order-notifications";
import { describeSupabaseError, getSupabaseOrdersClient } from "@/lib/server/supabase-orders";
import type { SupabaseClient } from "@supabase/supabase-js";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isWhatsAppConfigured(): boolean {
  return Boolean(process.env.WHATSAPP_ORDER_WEBHOOK_URL?.trim());
}

export function isEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY?.trim() && process.env.ORDER_EMAIL_FROM?.trim());
}

export const MAX_NOTIFICATION_ATTEMPTS = 5;

function isValidWhatsAppRecipient(customer: Record<string, unknown>) {
  const phone = String(customer.phone ?? "").replace(/\D/g, "");
  return customer.whatsappUpdates === true && (phone.length === 10 || phone.length === 11 || phone.length >= 12);
}

export async function enqueuePaidOrderNotifications(
  supabase: SupabaseClient,
  orderId: string,
  customer: unknown,
  options?: { force?: boolean; isTest?: boolean },
) {
  if (options?.isTest) return;
  if (!isRecord(customer)) throw new Error("O pedido aprovado não possui dados de cliente válidos.");

  const ownerEmail = process.env.OWNER_NOTIFY_EMAIL?.trim();
  const ownerWhatsApp = process.env.OWNER_NOTIFY_WHATSAPP?.trim();

  const entries: Array<{
    order_id: string;
    event_name: "order_paid" | "order_paid_owner";
    channel: "email" | "whatsapp";
  }> = [];

  // 1. Notificações do cliente: apenas se o canal estiver configurado no servidor E cliente tiver dados
  if (isEmailConfigured() && typeof customer.email === "string" && customer.email.trim()) {
    entries.push({ order_id: orderId, event_name: "order_paid", channel: "email" });
  }
  if (isWhatsAppConfigured() && isValidWhatsAppRecipient(customer)) {
    entries.push({ order_id: orderId, event_name: "order_paid", channel: "whatsapp" });
  }

  // 2. Notificações do dono da loja: apenas se o canal estiver configurado E a variável do dono preenchida
  if (isEmailConfigured() && ownerEmail) {
    entries.push({ order_id: orderId, event_name: "order_paid_owner", channel: "email" });
  }
  if (isWhatsAppConfigured() && ownerWhatsApp) {
    entries.push({ order_id: orderId, event_name: "order_paid_owner", channel: "whatsapp" });
  }

  if (!entries.length) {
    // Nenhum canal configurado ou aplicável: conclui de imediato para não deixar pedido travado em "Aviso pendente"
    await supabase.from("store_orders")
      .update({ paid_notified_at: new Date().toISOString() })
      .eq("id", orderId)
      .is("paid_notified_at", null);
    return;
  }

  if (options?.force) {
    // No reenvio manual pelo admin (force: true):
    // Preserva linhas que já foram entregues com sucesso (status: 'sent')
    // e re-enfileira apenas as pendentes ou falhas
    const existing = await supabase
      .from("store_order_notification_outbox")
      .select("event_name, channel, status")
      .eq("order_id", orderId);

    const alreadySent = new Set(
      (existing.data ?? [])
        .filter((row: { status: string; event_name: string; channel: string }) => row.status === "sent")
        .map((row: { event_name: string; channel: string }) => `${row.event_name}:${row.channel}`)
    );

    const entriesToRequeue = entries.filter((e) => !alreadySent.has(`${e.event_name}:${e.channel}`));

    if (entriesToRequeue.length > 0) {
      const result = await supabase.from("store_order_notification_outbox").upsert(
        entriesToRequeue.map((entry) => ({
          order_id: entry.order_id,
          event_name: entry.event_name,
          channel: entry.channel,
          status: "pending",
          available_at: new Date().toISOString(),
          attempt_count: 0,
          lease_until: null,
          last_error: null,
        })),
        { onConflict: "order_id,event_name,channel" },
      );
      if (result.error) throw result.error;
    }
  } else {
    const result = await supabase.from("store_order_notification_outbox").upsert(
      entries.map((entry) => ({
        order_id: entry.order_id,
        event_name: entry.event_name,
        channel: entry.channel,
      })),
      { onConflict: "order_id,event_name,channel", ignoreDuplicates: true },
    );
    if (result.error) throw result.error;
  }
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
  is_test?: boolean | null;
  paid_notified_at?: string | null;
  payment_method_id?: string | null;
  payment_type_id?: string | null;
  shipping?: Record<string, unknown> | null;
};

function retryDelaySeconds(attempt: number) {
  return Math.min(60 * 2 ** Math.min(Math.max(attempt - 1, 0), 9), 21_600);
}

export async function dispatchOrderNotificationOutbox({
  orderId,
  limit = 20,
  force = false,
}: {
  orderId?: string;
  limit?: number;
  force?: boolean;
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
    .select("id,status,operational_status,customer,item_lines,shipping_cents,total_cents,tracking_code,tracking_url,is_test,paid_notified_at,payment_method_id,payment_type_id,shipping")
    .in("id", orderIds);
  if (ordersResult.error) throw ordersResult.error;
  const orders = new Map((ordersResult.data ?? []).map((order) => [order.id, order as StoredOrder]));
  let delivered = 0;

  for (const queued of notices) {
    const order = orders.get(queued.order_id);
    const orderCode = queued.order_id.slice(0, 8).toUpperCase();

    // 1. Pedidos marcados como teste não disparam avisos
    if (order?.is_test) {
      await supabase.rpc("complete_store_order_notification", {
        p_notification_id: queued.notification_id,
        p_succeeded: true,
      });
      continue;
    }

    // 2. Se já foi notificado anteriormente e não é um reenvio forçado, conclui sem reenviar
    if (order?.paid_notified_at && !force) {
      await supabase.rpc("complete_store_order_notification", {
        p_notification_id: queued.notification_id,
        p_succeeded: true,
      });
      delivered += 1;
      continue;
    }

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
        payment_method_id: order.payment_method_id,
        payment_type_id: order.payment_type_id,
        shipping: order.shipping,
        is_test: order.is_test,
        paid_notified_at: order.paid_notified_at,
      };

      if (queued.channel === "whatsapp") {
        const result = await sendWhatsAppOrderNotice("order_paid", notice);
        succeeded = result === true;
        failure = result === null ? "whatsapp_provider_not_configured" : "whatsapp_delivery_failed";
        let ownerSuccess = true;
        let customerSuccess = true;
        let attemptedAny = false;

        // Aviso ao dono da loja (independente do opt-in do cliente)
        const ownerWhatsApp = process.env.OWNER_NOTIFY_WHATSAPP?.trim();
        if (ownerWhatsApp) {
          attemptedAny = true;
          const ownerResult = await sendWhatsAppOrderNotice("order_paid_owner", notice, { to: ownerWhatsApp });
          if (ownerResult !== true) {
            ownerSuccess = false;
            failure = ownerResult === null ? "whatsapp_provider_not_configured" : "whatsapp_delivery_failed";
          }
        }

        // Aviso ao cliente (se optado)
        if (isValidWhatsAppRecipient(order.customer)) {
          attemptedAny = true;
          const custResult = await sendWhatsAppOrderNotice("order_paid", notice);
          if (custResult !== true) {
            customerSuccess = false;
            if (failure === "order_not_found") {
              failure = custResult === null ? "whatsapp_provider_not_configured" : "whatsapp_delivery_failed";
            }
          }
        }

        succeeded = attemptedAny && ownerSuccess && customerSuccess;
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
        let ownerEmailSuccess = true;
        let customerEmailSuccess = true;
        let attemptedAnyEmail = false;

        // E-mail para o dono da loja (reserva)
        const ownerEmail = process.env.OWNER_NOTIFY_EMAIL?.trim();
        if (ownerEmail) {
          attemptedAnyEmail = true;
          const shippingLabel = typeof order.shipping === "object" && order.shipping && "label" in order.shipping
            ? String((order.shipping as Record<string, unknown>).label)
            : null;

          const ownerEmailMsg = buildOwnerOrderPaidEmail({
            orderId: order.id,
            customerName: String(order.customer.fullName ?? "Cliente"),
            customerPhone: String(order.customer.phone ?? ""),
            customerEmail: String(order.customer.email ?? ""),
            items: order.item_lines,
            shippingCents: Number(order.shipping_cents),
            totalCents: Number(order.total_cents),
            paymentMethod: formatNoticePaymentMethod(order.payment_method_id, order.payment_type_id),
            addressText: formatNoticeAddress(order.customer),
            shippingOption: shippingLabel,
          });

          const res = await sendOrderEmail(ownerEmail, ownerEmailMsg);
          if (res !== true) {
            ownerEmailSuccess = false;
            failure = res === null ? "email_provider_not_configured" : "email_delivery_failed";
          }
        }

        // E-mail para o cliente
        const customerEmail = String(order.customer.email ?? "").trim();
        if (customerEmail) {
          attemptedAnyEmail = true;
          const customerEmailMsg = buildOrderPaidEmail({
            orderId: order.id,
            customerName: String(order.customer.fullName ?? "Cliente"),
            items: order.item_lines,
            shippingCents: Number(order.shipping_cents),
            totalCents: Number(order.total_cents),
            siteUrl: process.env.SITE_URL?.replace(/\/$/, "") || "https://importsalves.com.br",
          });

          const res = await sendOrderEmail(customerEmail, customerEmailMsg);
          if (res !== true) {
            customerEmailSuccess = false;
            if (failure === "order_not_found") {
              failure = res === null ? "email_provider_not_configured" : "email_delivery_failed";
            }
          }
        }

        succeeded = attemptedAnyEmail && ownerEmailSuccess && customerEmailSuccess;
      }
    }

    const isExhausted = !succeeded && queued.attempt_count >= MAX_NOTIFICATION_ATTEMPTS;

    const completed = await supabase.rpc("complete_store_order_notification", {
      p_notification_id: queued.notification_id,
      p_succeeded: succeeded,
      p_error: succeeded ? null : failure,
      p_retry_seconds: retryDelaySeconds(queued.attempt_count),
      p_max_attempts: MAX_NOTIFICATION_ATTEMPTS,
    });

    if (completed.error || completed.data !== true) {
      console.error("Não foi possível concluir a tentativa de notificação do pedido:", describeSupabaseError(completed.error ?? new Error("Notificação não estava mais reservada.")));
      console.error("[OrderOutbox] Falha ao concluir reserva da notificação:", describeSupabaseError(completed.error ?? new Error("Notificação expirada")));
      continue;
    }

    if (isExhausted) {
      const updateFailed = await supabase.from("store_order_notification_outbox")
        .update({ status: "failed", last_error: failure, updated_at: new Date().toISOString() })
        .eq("id", queued.notification_id);

      if (updateFailed.error) {
        // Se a constraint antiga no banco ainda rejeitar 'failed', afasta available_at para não tentar mais em loop
        await supabase.from("store_order_notification_outbox")
          .update({
            available_at: new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString(),
            last_error: `${failure} (limite de ${MAX_NOTIFICATION_ATTEMPTS} tentativas atingido)`,
            updated_at: new Date().toISOString(),
          })
          .eq("id", queued.notification_id);
      }
      console.warn(`[OrderOutbox] Aviso para pedido #${orderCode} canal ${queued.channel} atingiu o limite de ${MAX_NOTIFICATION_ATTEMPTS} tentativas e permanece como aviso pendente.`);
    }

    if (succeeded) {
      delivered += 1;

      // Verifica se ainda existem outros avisos deste pedido pendentes, em processamento ou falhos
      const remaining = await supabase
        .from("store_order_notification_outbox")
        .select("id")
        .eq("order_id", queued.order_id)
        .neq("status", "sent")
        .limit(1);

      // Só carimba paid_notified_at quando TODOS os avisos (cliente e dono) estiverem com status 'sent'
      if (!remaining.error && (!remaining.data || remaining.data.length === 0)) {
        await supabase.from("store_orders")
          .update({ paid_notified_at: new Date().toISOString() })
          .eq("id", queued.order_id)
          .is("paid_notified_at", null);
      }
    }
  }

  return { claimed: notices.length, delivered };
}
