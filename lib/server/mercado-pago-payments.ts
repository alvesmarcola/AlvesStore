import { getPaymentClient, getPaymentEnvironment } from "@/lib/server/mercado-pago";
import { enqueuePaidOrderNotifications } from "@/lib/server/order-notification-outbox";
import { getSupabaseOrdersClient } from "@/lib/server/supabase-orders";
import { validateMercadoPagoPayment } from "@/lib/payment/mercado-pago-validation";

export async function applyMercadoPagoPayment(paymentId: string) {
  const environment = getPaymentEnvironment();
  const payment = await getPaymentClient().get({ id: paymentId });
  const verified = validateMercadoPagoPayment(paymentId, payment, environment);
  if (!verified) return { applied: false, orderId: undefined, status: undefined };

  const supabase = getSupabaseOrdersClient();
  const result = await supabase.rpc("apply_store_payment", {
    p_payment_id: verified.paymentId,
    p_order_id: verified.orderId,
    p_status: verified.status,
    p_amount_cents: verified.amountCents,
    p_currency: verified.currency,
    p_live_mode: verified.liveMode,
  });
  if (result.error) throw result.error;
  const order = Array.isArray(result.data) ? result.data[0] : null;
  if (!order?.applied) return { applied: false, orderId: verified.orderId, status: verified.status };

  const savedPayment = await supabase.from("store_orders")
    .update({
      mercado_pago_status: verified.providerStatus,
      mercado_pago_id: verified.paymentId,
      payment_method_id: verified.paymentMethodId,
      payment_type_id: verified.paymentTypeId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", verified.orderId)
    .select("id")
    .maybeSingle();
  if (savedPayment.error || !savedPayment.data) {
    throw savedPayment.error ?? new Error("Pedido não encontrado ao salvar os dados do pagamento.");
  }

  if (verified.status === "approved") {
    const operational = await supabase.from("store_orders")
      .update({ operational_status: "aguardando_fornecedor", updated_at: new Date().toISOString() })
      .eq("id", verified.orderId)
      .or("operational_status.is.null,operational_status.eq.aguardando_pagamento")
      .select("id")
      .maybeSingle();
    if (operational.error) throw operational.error;
    await enqueuePaidOrderNotifications(supabase, verified.orderId, order.customer);
  }

  return { applied: true, orderId: verified.orderId, status: verified.status };
}

export async function reconcileMercadoPagoOrder(orderId: string) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(orderId)) {
    throw new Error("Código de pedido inválido para reconciliação.");
  }

  const result = await getPaymentClient().search({
    options: { external_reference: orderId, sort: "date_last_updated", criteria: "desc", limit: 20 },
  });
  const paymentIds = [...new Set((result.results ?? [])
    .filter((payment) => payment.external_reference === orderId && payment.id !== undefined)
    .map((payment) => String(payment.id))
    .filter((paymentId) => /^\d{1,30}$/.test(paymentId)))];
  const reconciled = [];
  for (const paymentId of paymentIds) {
    reconciled.push(await applyMercadoPagoPayment(paymentId));
  }
  return reconciled;
}
