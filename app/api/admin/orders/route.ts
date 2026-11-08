import { z } from "zod";
import { NextResponse } from "next/server";
import {
  describeSupabaseError,
  getSupabaseOrdersClient,
  SupabaseOrdersConfigurationError,
} from "@/lib/server/supabase-orders";
import { sendTrackingUpdateEmail, sendWhatsAppOrderNotice, type OrderNotice } from "@/lib/server/order-notifications";
import { enqueuePaidOrderNotifications, dispatchOrderNotificationOutbox } from "@/lib/server/order-notification-outbox";
import { ADMIN_PRIVATE_HEADERS, getAdminAuthFailure, isPartnerRole } from "@/lib/server/admin-auth";
import { reconcileMercadoPagoOrder } from "@/lib/server/mercado-pago-payments";

export const runtime = "nodejs";

const operationalStatuses = [
  "aguardando_pagamento", "pagamento_aprovado", "aguardando_fornecedor",
  "pedido_realizado", "em_preparacao", "enviado", "cancelado",
] as const;
const supplierStatuses = ["nao_solicitado", "solicitado", "confirmado", "em_preparacao", "recebido", "cancelado"] as const;
const orderPatchSchema = z.discriminatedUnion("action", [
  z.object({
    orderId: z.string().uuid(),
    action: z.literal("save_shipping"),
    trackingCode: z.string().trim().max(80),
    trackingUrl: z.union([z.string().url().max(2048), z.literal("")]).optional(),
  }).strict(),
  z.object({
    orderId: z.string().uuid(),
    action: z.literal("mark_shipped"),
  }).strict(),
  z.object({
    orderId: z.string().uuid(),
    action: z.literal("reconcile"),
  }).strict(),
  z.object({
    orderId: z.string().uuid(),
    action: z.literal("resend_notification"),
  }).strict(),
  z.object({
    orderId: z.string().uuid(),
    action: z.literal("toggle_test"),
    isTest: z.boolean().optional(),
  }).strict(),
  z.object({
    orderId: z.string().uuid(),
    action: z.literal("update_operations"),
    operationalStatus: z.enum(operationalStatuses),
    supplierName: z.string().trim().max(160),
    supplierStatus: z.enum(supplierStatuses),
    supplierOrderedAt: z.string().datetime().nullable(),
    supplierCost: z.number().finite().min(0).max(100000).nullable(),
    paymentFee: z.number().finite().min(0).max(100000).nullable().optional(),
    shippingCost: z.number().finite().min(0).max(100000).nullable(),
    otherExpenses: z.number().finite().min(0).max(100000).nullable(),
    internalNotes: z.string().max(4000),
  }).strict(),
]);

const paidStatuses = ["pago", "enviado", "approved"];
const paid = (status: string, mercadoPagoStatus: string | null) =>
  paidStatuses.includes(status) || mercadoPagoStatus === "approved";

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, {
    status,
    headers: ADMIN_PRIVATE_HEADERS,
  });
}

function reportFailure(operation: string, error: unknown) {
  console.error(operation, describeSupabaseError(error));
  return error instanceof SupabaseOrdersConfigurationError
    ? "Supabase não configurado neste ambiente. Verifique as variáveis de ambiente do servidor."
    : undefined;
}

export async function GET(request: Request) {
  const authFailure = getAdminAuthFailure(request);
  if (authFailure) return jsonError(authFailure.message, authFailure.status);
  try {
    const supabase = getSupabaseOrdersClient();
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

    const { data, error } = await supabase.from("store_orders")
      .select("id,status,item_lines,customer,shipping,shipping_cents,total_cents,promo,valor_desconto,tracking_code,tracking_url,shipped_at,operational_status,supplier_name,supplier_status,supplier_ordered_at,supplier_cost_cents,shipping_cost_cents,other_expenses_cents,internal_notes,payment_method_id,payment_type_id,mercado_pago_status,mercado_pago_id,is_test,paid_notified_at,payment_fee_cents,refunded_cents,created_at,updated_at")
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw error;

    let paymentEvents: unknown[] = [];
    try {
      const { data: eventsData } = await supabase.from("payment_events")
        .select("id,payment_id,order_id,topic,action,status,payload,is_orphan,is_divergent,processed,error_message,created_at")
        .order("created_at", { ascending: false })
        .limit(300);
      if (eventsData) paymentEvents = eventsData;
    } catch {
      // Ignora erro caso a tabela payment_events ainda não tenha sido criada no ambiente atual
    }

    const isPartner = isPartnerRole(request);
    const sanitizedOrders = (data ?? []).map((order) => {
      if (!isPartner) return order;
      // Perfil de parceiro/sócio não visualiza custos, despesas ou taxas
      const {
        supplier_cost_cents: _sc,
        shipping_cost_cents: _sh,
        other_expenses_cents: _oe,
        payment_fee_cents: _pf,
        supplier_name: _sn,
        ...safeOrder
      } = order;
      void _sc; void _sh; void _oe; void _pf; void _sn;
      return safeOrder;
    });

    return NextResponse.json({ orders: sanitizedOrders, paymentEvents, isPartner }, { headers: ADMIN_PRIVATE_HEADERS });
  } catch (error) {
    const configurationError = reportFailure("Falha ao carregar pedidos administrativos:", error);
    return jsonError(configurationError ?? "Não foi possível carregar os pedidos. Verifique se a migração de gestão administrativa foi aplicada.", 503);
  }
}

export async function PATCH(request: Request) {
  const authFailure = getAdminAuthFailure(request);
  if (authFailure) return jsonError(authFailure.message, authFailure.status);
  const parsed = orderPatchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Revise os dados enviados para o pedido.", 400);

  try {
    const supabase = getSupabaseOrdersClient();
    const existing = await supabase.from("store_orders")
      .select("id,status,operational_status,item_lines,customer,shipping_cents,total_cents,tracking_code,tracking_url,mercado_pago_status,is_test")
      .eq("id", parsed.data.orderId)
      .maybeSingle();
    if (existing.error) throw existing.error;
    const order = existing.data as (OrderNotice & {
      tracking_code: string | null;
      tracking_url: string | null;
      mercado_pago_status: string | null;
      operational_status: string | null;
      is_test?: boolean;
    }) | null;
    if (!order) return jsonError("Pedido não encontrado.", 404);

    if (parsed.data.action === "toggle_test") {
      const fullAdminFailure = getAdminAuthFailure(request, { requireFullAdmin: true });
      if (fullAdminFailure) return jsonError(fullAdminFailure.message, fullAdminFailure.status);

      const nextIsTest = typeof parsed.data.isTest === "boolean" ? parsed.data.isTest : !order.is_test;
      const { data, error } = await supabase.from("store_orders")
        .update({ is_test: nextIsTest, updated_at: new Date().toISOString() })
        .eq("id", order.id)
        .select("id, is_test")
        .maybeSingle();
      if (error) throw error;
      if (!data) return jsonError("Não foi possível atualizar o status de teste do pedido.", 409);
      return NextResponse.json({ updated: true, isTest: nextIsTest, message: nextIsTest ? "Pedido marcado como teste." : "Pedido removido dos testes." }, { headers: ADMIN_PRIVATE_HEADERS });
    }

    if (parsed.data.action === "save_shipping") {
      if (!paid(order.status, order.mercado_pago_status)) {
        return jsonError("Só é possível cadastrar o envio após a confirmação do pagamento.", 409);
      }
      const trackingCode = parsed.data.trackingCode || null;
      const trackingUrl = parsed.data.trackingUrl?.trim() || null;
      if (trackingUrl && new URL(trackingUrl).protocol !== "https:") {
        return jsonError("O link de rastreamento precisa usar HTTPS.", 400);
      }
      const { data, error } = await supabase.from("store_orders")
        .update({ tracking_code: trackingCode, tracking_url: trackingUrl, updated_at: new Date().toISOString() })
        .eq("id", order.id)
        .select("id")
        .maybeSingle();
      if (error) throw error;
      if (!data) return jsonError("O pedido não foi atualizado. Recarregue a lista e tente novamente.", 409);
      return NextResponse.json({ updated: true, message: "Informações de rastreamento salvas." }, { headers: ADMIN_PRIVATE_HEADERS });
    }

    if (parsed.data.action === "mark_shipped") {
      if (order.operational_status === "enviado" || order.status === "enviado") {
        return NextResponse.json({ updated: true, message: "O pedido já está marcado como enviado." }, { headers: ADMIN_PRIVATE_HEADERS });
      }
      if (!paid(order.status, order.mercado_pago_status)) {
        return jsonError("Só é possível marcar como enviado após a confirmação do pagamento.", 409);
      }
      if (!order.tracking_code) return jsonError("Salve um código de rastreio antes de marcar como enviado.", 409);
      const shippedAt = new Date().toISOString();
      const { data, error } = await supabase.from("store_orders")
        .update({ operational_status: "enviado", shipped_at: shippedAt, updated_at: shippedAt })
        .eq("id", order.id)
        .neq("status", "enviado")
        .or("operational_status.is.null,operational_status.neq.enviado")
        .select("id")
        .maybeSingle();
      if (error) throw error;
      if (!data) return jsonError("O pedido não foi atualizado. Recarregue a lista e tente novamente.", 409);

      const shippedOrder = { ...order, operational_status: "enviado" };
      const [, whatsappResult] = await Promise.all([
        sendTrackingUpdateEmail(shippedOrder),
        sendWhatsAppOrderNotice("tracking_code_updated", shippedOrder),
      ]);
      const message = order.customer.whatsappUpdates === true && whatsappResult !== true
        ? "Pedido marcado como enviado, mas o WhatsApp não foi enviado. Verifique a configuração do provedor."
        : order.customer.whatsappUpdates !== true
          ? "Pedido marcado como enviado. O cliente não autorizou atualizações pelo WhatsApp."
          : undefined;
      return NextResponse.json({ updated: true, whatsappSent: whatsappResult, message }, { headers: ADMIN_PRIVATE_HEADERS });
    }

    if (parsed.data.action === "reconcile") {
      try {
        const results = await reconcileMercadoPagoOrder(order.id);
        const applied = results.some((r) => r.applied);
        return NextResponse.json({
          updated: applied,
          reconciled: true,
          applied,
          message: applied
            ? "Pagamento aprovado confirmado com o Mercado Pago! O pedido foi atualizado."
            : "Consulta realizada: nenhum pagamento aprovado foi retornado pelo Mercado Pago para este pedido até o momento.",
        }, { headers: ADMIN_PRIVATE_HEADERS });
      } catch (reconcileError) {
        console.error("Erro ao reconciliar pedido com Mercado Pago:", reconcileError);
        return jsonError(reconcileError instanceof Error ? reconcileError.message : "Falha ao consultar Mercado Pago.", 500);
      }
    }

    if (parsed.data.action === "resend_notification") {
      if (!paid(order.status, order.mercado_pago_status)) {
        return jsonError("Só é possível reenviar o aviso após a confirmação do pagamento.", 409);
      }
      try {
        await enqueuePaidOrderNotifications(supabase, order.id, order.customer, { force: true });
        const result = await dispatchOrderNotificationOutbox({ orderId: order.id, force: true });
        return NextResponse.json({
          updated: true,
          delivered: result.delivered > 0,
          message: result.delivered > 0
            ? "Aviso de pagamento reenviado com sucesso!"
            : "Tentativa de envio realizada, mas os serviços de aviso não confirmaram a entrega. Verifique as configurações na Vercel.",
        }, { headers: ADMIN_PRIVATE_HEADERS });
      } catch (notifyError) {
        console.error("[AdminOrders] Erro ao reenviar aviso do pedido:", describeSupabaseError(notifyError));
        return jsonError(notifyError instanceof Error ? notifyError.message : "Falha ao reenviar aviso.", 500);
      }
    }

    const values = parsed.data;
    if (values.operationalStatus === "enviado" && order.operational_status !== "enviado") {
      return jsonError("Use a ação “Marcar como enviado” na seção de rastreamento para registrar a data e notificar o cliente.", 409);
    }

    if (isPartnerRole(request)) {
      if (values.supplierCost !== null || values.shippingCost !== null || values.otherExpenses !== null || values.paymentFee !== undefined) {
        return jsonError("Perfil parceiro não possui permissão para editar custos, despesas ou taxas.", 403);
      }
    }

    const updatePayload: Record<string, unknown> = {
      operational_status: values.operationalStatus,
      supplier_name: values.supplierName || null,
      supplier_status: values.supplierStatus,
      supplier_ordered_at: values.supplierOrderedAt,
      supplier_cost_cents: values.supplierCost === null ? null : Math.round(values.supplierCost * 100),
      shipping_cost_cents: values.shippingCost === null ? null : Math.round(values.shippingCost * 100),
      other_expenses_cents: values.otherExpenses === null ? null : Math.round(values.otherExpenses * 100),
      internal_notes: values.internalNotes || null,
      updated_at: new Date().toISOString(),
    };
    if (values.paymentFee !== undefined) {
      updatePayload.payment_fee_cents = values.paymentFee === null ? null : Math.round(values.paymentFee * 100);
    }

    const { data, error } = await supabase.from("store_orders")
      .update(updatePayload)
      .eq("id", order.id)
      .select("id")
      .maybeSingle();
    if (error) throw error;
    if (!data) return jsonError("O pedido não foi atualizado. Recarregue a lista e tente novamente.", 409);
    return NextResponse.json({ updated: true }, { headers: ADMIN_PRIVATE_HEADERS });
  } catch (error) {
    const configurationError = reportFailure("Falha ao atualizar pedido administrativo:", error);
    return jsonError(configurationError ?? "Não foi possível atualizar o pedido. Verifique se a migração de gestão administrativa foi aplicada.", 503);
  }
}
