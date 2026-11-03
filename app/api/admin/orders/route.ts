import { z } from "zod";
import { NextResponse } from "next/server";
import { getSupabaseOrdersClient } from "@/lib/server/supabase-orders";
import { sendTrackingUpdateEmail, sendWhatsAppOrderNotice, type OrderNotice } from "@/lib/server/order-notifications";
import { isAuthorizedAdmin } from "@/lib/server/admin-auth";

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
    action: z.literal("update_operations"),
    operationalStatus: z.enum(operationalStatuses),
    supplierName: z.string().trim().max(160),
    supplierStatus: z.enum(supplierStatuses),
    supplierOrderedAt: z.string().datetime().nullable(),
    supplierCost: z.number().finite().min(0).max(100000).nullable(),
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
    headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" },
  });
}

export async function GET(request: Request) {
  if (!isAuthorizedAdmin(request)) return jsonError("Acesso não autorizado.", 401);
  try {
    const { data, error } = await getSupabaseOrdersClient().from("store_orders")
      .select("id,status,item_lines,customer,shipping,shipping_cents,total_cents,tracking_code,tracking_url,shipped_at,operational_status,supplier_name,supplier_status,supplier_ordered_at,supplier_cost_cents,shipping_cost_cents,other_expenses_cents,internal_notes,payment_method_id,payment_type_id,mercado_pago_status,mercado_pago_id,created_at,updated_at")
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw error;
    return NextResponse.json({ orders: data }, { headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" } });
  } catch (error) {
    console.error("Falha ao carregar pedidos administrativos:", error instanceof Error ? error.message : "erro desconhecido");
    return jsonError("Não foi possível carregar os pedidos. Verifique se a migração de gestão administrativa foi aplicada.", 503);
  }
}

export async function PATCH(request: Request) {
  if (!isAuthorizedAdmin(request)) return jsonError("Acesso não autorizado.", 401);
  const parsed = orderPatchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Revise os dados enviados para o pedido.", 400);

  try {
    const supabase = getSupabaseOrdersClient();
    const existing = await supabase.from("store_orders")
      .select("id,status,operational_status,item_lines,customer,shipping_cents,total_cents,tracking_code,tracking_url,mercado_pago_status")
      .eq("id", parsed.data.orderId)
      .maybeSingle();
    if (existing.error) throw existing.error;
    const order = existing.data as (OrderNotice & {
      tracking_code: string | null;
      tracking_url: string | null;
      mercado_pago_status: string | null;
      operational_status: string | null;
    }) | null;
    if (!order) return jsonError("Pedido não encontrado.", 404);

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
      return NextResponse.json({ updated: true, message: "Informações de rastreamento salvas." });
    }

    if (parsed.data.action === "mark_shipped") {
      if (order.operational_status === "enviado" || order.status === "enviado") {
        return NextResponse.json({ updated: true, message: "O pedido já está marcado como enviado." });
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
      return NextResponse.json({ updated: true, whatsappSent: whatsappResult, message });
    }

    const values = parsed.data;
    if (values.operationalStatus === "enviado" && order.operational_status !== "enviado") {
      return jsonError("Use a ação “Marcar como enviado” na seção de rastreamento para registrar a data e notificar o cliente.", 409);
    }
    const { data, error } = await supabase.from("store_orders")
      .update({
        operational_status: values.operationalStatus,
        supplier_name: values.supplierName || null,
        supplier_status: values.supplierStatus,
        supplier_ordered_at: values.supplierOrderedAt,
        supplier_cost_cents: values.supplierCost === null ? null : Math.round(values.supplierCost * 100),
        shipping_cost_cents: values.shippingCost === null ? null : Math.round(values.shippingCost * 100),
        other_expenses_cents: values.otherExpenses === null ? null : Math.round(values.otherExpenses * 100),
        internal_notes: values.internalNotes || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", order.id)
      .select("id")
      .maybeSingle();
    if (error) throw error;
    if (!data) return jsonError("O pedido não foi atualizado. Recarregue a lista e tente novamente.", 409);
    return NextResponse.json({ updated: true });
  } catch (error) {
    console.error("Falha ao atualizar pedido administrativo:", error instanceof Error ? error.message : "erro desconhecido");
    return jsonError("Não foi possível atualizar o pedido. Verifique se a migração de gestão administrativa foi aplicada.", 503);
  }
}
