import { getPaymentClient, getPaymentEnvironment } from "@/lib/server/mercado-pago";
import { enqueuePaidOrderNotifications } from "@/lib/server/order-notification-outbox";
import { getSupabaseOrdersClient } from "@/lib/server/supabase-orders";
import { validateMercadoPagoPayment } from "@/lib/payment/mercado-pago-validation";

export type PaymentEventRecord = {
  paymentId: string;
  orderId?: string | null;
  topic?: string | null;
  action?: string | null;
  status: string;
  payload?: Record<string, unknown> | null;
  isOrphan?: boolean;
  isDivergent?: boolean;
  processed?: boolean;
  errorMessage?: string | null;
};

export async function recordPaymentEvent({
  paymentId,
  orderId,
  topic,
  action,
  status,
  payload,
  isOrphan = false,
  isDivergent = false,
  processed = false,
  errorMessage,
}: PaymentEventRecord) {
  try {
    const supabase = getSupabaseOrdersClient();
    await supabase.from("payment_events").insert({
      payment_id: paymentId,
      order_id: orderId || null,
      topic: topic || null,
      action: action || null,
      status,
      payload: payload ?? {},
      is_orphan: isOrphan,
      is_divergent: isDivergent,
      processed,
      error_message: errorMessage || null,
      created_at: new Date().toISOString(),
    });
  } catch (err) {
    // Falha ao registrar log de evento não deve abortar o processamento
    console.warn("[recordPaymentEvent] Falha ao registrar auditoria em payment_events:", err);
  }
}

export type ApplyPaymentOptions = {
  topic?: string | null;
  action?: string | null;
  rawEvent?: unknown;
};

export async function applyMercadoPagoPayment(paymentId: string, options: ApplyPaymentOptions = {}) {
  const environment = getPaymentEnvironment();
  console.log(`[applyMercadoPagoPayment] Consultando API Mercado Pago para pagamento ${paymentId} (ambiente: ${environment})...`);
  const payment = await getPaymentClient().get({ id: paymentId });
  console.log(`[applyMercadoPagoPayment] Dados recebidos da API Mercado Pago:`, {
    id: payment?.id,
    status: payment?.status,
    transaction_amount: payment?.transaction_amount,
    currency_id: payment?.currency_id,
    live_mode: payment?.live_mode,
    external_reference: payment?.external_reference,
  });

  const rawPaymentId = payment?.id !== undefined ? String(payment.id) : paymentId;
  const sanitizedPayload = {
    id: rawPaymentId,
    status: payment?.status,
    transaction_amount: payment?.transaction_amount,
    currency_id: payment?.currency_id,
    live_mode: payment?.live_mode,
    external_reference: payment?.external_reference,
    payment_method_id: payment?.payment_method_id,
    payment_type_id: payment?.payment_type_id,
    date_approved: payment?.date_approved,
  };

  const orderId = typeof payment?.external_reference === "string" ? payment.external_reference.trim() : "";
  const supabase = getSupabaseOrdersClient();

  // 1. Checa se o external_reference é um UUID válido e busca o pedido em store_orders
  const isValidUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(orderId);
  let orderData: { id: string; total_cents: number; status: string; operational_status: string | null } | null = null;

  if (isValidUuid) {
    const { data } = await supabase.from("store_orders")
      .select("id,total_cents,status,operational_status")
      .eq("id", orderId)
      .maybeSingle();
    orderData = data;
  }

  // 2. Pagamento sem pedido correspondente (ÓRFÃO)
  if (!orderData) {
    console.warn(`[applyMercadoPagoPayment] Pagamento ${paymentId} é ÓRFÃO. Pedido '${orderId}' não encontrado em store_orders.`);
    await recordPaymentEvent({
      paymentId: rawPaymentId,
      orderId: null,
      topic: options.topic,
      action: options.action,
      status: "orphan",
      payload: sanitizedPayload,
      isOrphan: true,
      processed: false,
      errorMessage: `Pedido '${orderId}' não encontrado no banco.`,
    });
    return { applied: false, orphan: true, orderId: undefined, status: payment?.status };
  }

  // 3. Validação dos campos do Mercado Pago (moeda, live_mode, id)
  const verified = validateMercadoPagoPayment(paymentId, payment, environment);
  if (!verified) {
    console.warn(`[applyMercadoPagoPayment] Pagamento ${paymentId} falhou na validação de campos do provedor.`);
    await recordPaymentEvent({
      paymentId: rawPaymentId,
      orderId: orderData.id,
      topic: options.topic,
      action: options.action,
      status: "validation_failed",
      payload: sanitizedPayload,
      processed: false,
      errorMessage: "Falha na validação de ambiente, moeda ou campos do Mercado Pago.",
    });
    return { applied: false, orderId: orderData.id, status: payment?.status };
  }

  // 4. Conferência de valor: transaction_amount vs total_cents do pedido
  if (orderData.total_cents !== verified.amountCents) {
    console.warn(`[applyMercadoPagoPayment] DIVERGÊNCIA DE VALOR para o pedido ${orderData.id}: total esperado = R$ ${(orderData.total_cents / 100).toFixed(2)}, valor pago = R$ ${(verified.amountCents / 100).toFixed(2)}.`);
    await supabase.from("store_orders")
      .update({
        operational_status: "divergencia_pagamento",
        status: "divergencia_pagamento",
        mercado_pago_id: verified.paymentId,
        mercado_pago_status: verified.providerStatus,
        payment_method_id: verified.paymentMethodId,
        payment_type_id: verified.paymentTypeId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", orderData.id);

    await recordPaymentEvent({
      paymentId: verified.paymentId,
      orderId: orderData.id,
      topic: options.topic,
      action: options.action,
      status: "divergent",
      payload: { ...sanitizedPayload, expectedTotalCents: orderData.total_cents },
      isDivergent: true,
      processed: false,
      errorMessage: `Divergência: esperado ${orderData.total_cents} centavos, recebido ${verified.amountCents} centavos.`,
    });

    return { applied: false, divergent: true, orderId: orderData.id, status: verified.status };
  }

  // 5. Idempotência e não-regressão: se o pedido já está pago ou enviado e o evento é atrasado
  const alreadyPaid = ["pago", "enviado", "approved"].includes(orderData.status);
  if (alreadyPaid && verified.status !== "approved" && verified.status !== "refunded") {
    console.log(`[applyMercadoPagoPayment] Pedido ${orderData.id} já está ${orderData.status}. Ignorando evento atrasado com status ${verified.status} para evitar regressão.`);
    await recordPaymentEvent({
      paymentId: verified.paymentId,
      orderId: orderData.id,
      topic: options.topic,
      action: options.action,
      status: "ignored_no_regression",
      payload: sanitizedPayload,
      processed: true,
    });
    return { applied: true, orderId: orderData.id, status: orderData.status, duplicate: true };
  }

  // 6. Aplicação no banco via RPC
  const result = await supabase.rpc("apply_store_payment", {
    p_payment_id: verified.paymentId,
    p_order_id: verified.orderId,
    p_status: verified.status,
    p_amount_cents: verified.amountCents,
    p_currency: verified.currency,
    p_live_mode: verified.liveMode,
  });

  if (result.error) {
    console.error(`[applyMercadoPagoPayment] Erro RPC Supabase apply_store_payment:`, result.error);
    await recordPaymentEvent({
      paymentId: verified.paymentId,
      orderId: orderData.id,
      topic: options.topic,
      action: options.action,
      status: "rpc_error",
      payload: sanitizedPayload,
      processed: false,
      errorMessage: result.error.message,
    });
    throw result.error;
  }

  const order = Array.isArray(result.data) ? result.data[0] : null;

  // Atualiza detalhes do Mercado Pago no pedido
  await supabase.from("store_orders")
    .update({
      mercado_pago_status: verified.providerStatus,
      mercado_pago_id: verified.paymentId,
      payment_method_id: verified.paymentMethodId,
      payment_type_id: verified.paymentTypeId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", verified.orderId);

  // Mapeamento operacional
  if (verified.status === "approved") {
    await supabase.from("store_orders")
      .update({ operational_status: "aguardando_fornecedor", updated_at: new Date().toISOString() })
      .eq("id", verified.orderId)
      .or("operational_status.is.null,operational_status.eq.aguardando_pagamento,operational_status.eq.pagamento_aprovado");

    if (order?.customer) {
      await enqueuePaidOrderNotifications(supabase, verified.orderId, order.customer);
    }
  } else if (verified.status === "rejected" || verified.status === "cancelled") {
    await supabase.from("store_orders")
      .update({ operational_status: "cancelado", updated_at: new Date().toISOString() })
      .eq("id", verified.orderId)
      .eq("status", "pending");
  }

  // Grava auditoria em payment_events com sucesso
  await recordPaymentEvent({
    paymentId: verified.paymentId,
    orderId: orderData.id,
    topic: options.topic,
    action: options.action,
    status: verified.status,
    payload: sanitizedPayload,
    processed: true,
  });

  console.log(`[applyMercadoPagoPayment] Sucesso! Pedido ${verified.orderId} atualizado para ${verified.status}.`);
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
    reconciled.push(await applyMercadoPagoPayment(paymentId, { topic: "reconciliation" }));
  }
  return reconciled;
}

export async function reconcilePendingPayments() {
  const supabase = getSupabaseOrdersClient();
  const now = Date.now();
  const fiveMinAgo = new Date(now - 5 * 60 * 1000).toISOString();
  const sevenDaysAgo = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();
  const cutoff48h = new Date(now - 48 * 60 * 60 * 1000).toISOString();

  // 1. Expira pedidos pendentes com mais de 48h
  const expireResult = await supabase.from("store_orders")
    .update({
      operational_status: "cancelado",
      status: "cancelled",
      updated_at: new Date().toISOString(),
    })
    .eq("status", "pending")
    .or("operational_status.is.null,operational_status.eq.aguardando_pagamento")
    .lt("created_at", cutoff48h);

  // 2. Busca pedidos pendentes criados entre 5 minutos e 7 dias atrás
  const { data: pendingOrders, error } = await supabase.from("store_orders")
    .select("id,created_at,total_cents")
    .eq("status", "pending")
    .lte("created_at", fiveMinAgo)
    .gte("created_at", sevenDaysAgo)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    console.error("[reconcilePendingPayments] Erro ao buscar pedidos pendentes:", error);
    throw error;
  }

  const results = [];
  let reconciledCount = 0;

  for (const order of pendingOrders ?? []) {
    try {
      const orderResults = await reconcileMercadoPagoOrder(order.id);
      const applied = orderResults.some((r) => r.applied);
      if (applied) reconciledCount += 1;
      results.push({ orderId: order.id, applied, results: orderResults });
    } catch (orderErr) {
      console.error(`[reconcilePendingPayments] Erro ao reconciliar pedido ${order.id}:`, orderErr);
      results.push({ orderId: order.id, error: String(orderErr) });
    }
  }

  return {
    checkedCount: (pendingOrders ?? []).length,
    reconciledCount,
    expiredCount: expireResult?.count ?? 0,
    results,
  };
}
