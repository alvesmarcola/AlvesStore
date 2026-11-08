import { NextResponse } from "next/server";
import { ADMIN_PRIVATE_HEADERS, getAdminAuthFailure, isPartnerRole } from "@/lib/server/admin-auth";
import {
  describeSupabaseError,
  getSupabaseOrdersClient,
  SupabaseOrdersConfigurationError,
} from "@/lib/server/supabase-orders";

export const runtime = "nodejs";
const privateJson = (body: unknown, status = 200) =>
  NextResponse.json(body, { status, headers: ADMIN_PRIVATE_HEADERS });

function configured(value: string | undefined) {
  return Boolean(value?.trim());
}

function configuredAny(...values: (string | undefined)[]) {
  return values.some(configured);
}

export async function GET(request: Request) {
  const authFailure = getAdminAuthFailure(request);
  if (authFailure) return privateJson({ error: authFailure.message }, authFailure.status);
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

    const isPartner = isPartnerRole(request);
    const [metrics, orders, orderSuppliers, productSuppliers] = await Promise.all([
      supabase.from("store_order_admin_metrics")
        .select("*")
        .single(),
      supabase.from("store_orders")
        .select("id,status,mercado_pago_status,operational_status,total_cents,supplier_name,supplier_status,supplier_cost_cents,shipping_cost_cents,other_expenses_cents,created_at,is_test,payment_fee_cents,refunded_cents,customer,item_lines,promo,valor_desconto,tracking_code,tracking_url,shipped_at,payment_method_id,payment_type_id")
        .order("created_at", { ascending: false })
        .limit(2000),
      supabase.from("store_orders")
        .select("supplier_name,supplier_cost_cents")
        .not("supplier_name", "is", null)
        .limit(5000),
      supabase.from("admin_product_supplier_details")
        .select("supplier_name,supplier_cost")
        .neq("supplier_name", "")
        .limit(5000),
    ]);
    if (metrics.error) throw metrics.error;
    if (orders.error) throw orders.error;
    if (orderSuppliers.error) throw orderSuppliers.error;
    if (productSuppliers.error) throw productSuppliers.error;

    const suppliers = new Map<string, { name: string; orders: number; products: number; supplierSpendCents: number }>();
    for (const row of orderSuppliers.data ?? []) {
      const name = row.supplier_name?.trim();
      if (!name) continue;
      const key = name.toLocaleLowerCase("pt-BR");
      const entry = suppliers.get(key) ?? { name, orders: 0, products: 0, supplierSpendCents: 0 };
      entry.orders += 1;
      if (!isPartner) {
        entry.supplierSpendCents += Number(row.supplier_cost_cents ?? 0);
      }
      suppliers.set(key, entry);
    }
    for (const row of productSuppliers.data ?? []) {
      const name = row.supplier_name?.trim();
      if (!name) continue;
      const key = name.toLocaleLowerCase("pt-BR");
      const entry = suppliers.get(key) ?? { name, orders: 0, products: 0, supplierSpendCents: 0 };
      entry.products += 1;
      suppliers.set(key, entry);
    }
    const totals = (metrics.data ?? {}) as Record<string, unknown>;
    const revenueCents = Number(totals.revenue_cents ?? 0);
    const paymentFeeCents = Number(totals.payment_fee_cents ?? 0);
    const expensesCents = Number(totals.supplier_cost_cents ?? 0)
      + Number(totals.shipping_cost_cents ?? 0)
      + Number(totals.other_expenses_cents ?? 0)
      + paymentFeeCents;

    const rawOrders = orders.data ?? [];
    const sanitizedOrders = rawOrders.map((order) => {
      if (!isPartner) return order;
      const {
        supplier_cost_cents: _sc,
        shipping_cost_cents: _sh,
        other_expenses_cents: _oe,
        payment_fee_cents: _pf,
        supplier_name: _sn,
        ...rest
      } = order;
      void _sc; void _sh; void _oe; void _pf; void _sn;
      return rest;
    });

    return privateJson({
      isPartner,
      metrics: {
        orderCount: Number(totals.order_count ?? 0),
        paidOrderCount: Number(totals.paid_order_count ?? 0),
        awaitingSupplierCount: Number(totals.awaiting_supplier_count ?? 0),
        shippedOrderCount: Number(totals.shipped_order_count ?? 0),
        revenueCents: isPartner ? 0 : revenueCents,
        supplierCostCents: isPartner ? 0 : Number(totals.supplier_cost_cents ?? 0),
        shippingCostCents: isPartner ? 0 : Number(totals.shipping_cost_cents ?? 0),
        otherExpensesCents: isPartner ? 0 : Number(totals.other_expenses_cents ?? 0),
        paymentFeeCents: isPartner ? 0 : paymentFeeCents,
        estimatedProfitCents: isPartner ? 0 : (revenueCents - expensesCents),
        promoOrderCount: Number(totals.promo_order_count ?? 0),
        promoDiscountCents: isPartner ? 0 : Number(totals.promo_discount_cents ?? 0),
        promoRevenueCents: isPartner ? 0 : Number(totals.promo_revenue_cents ?? 0),
      },
      orders: sanitizedOrders,
      suppliers: [...suppliers.values()].sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
      configuration: isPartner ? {} : {
        supabase: configuredAny(process.env.SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_URL)
          && configuredAny(process.env.SUPABASE_SERVICE_ROLE_KEY, process.env.SUPABASE_SECRET_KEY,
            process.env.SUPABASE_SERVICE_KEY, process.env.SUPABASE_ROLE_KEY),
        mercadoPago: configuredAny(process.env.MERCADO_PAGO_ACCESS_TOKEN, process.env.MERCADOPAGO_ACCESS_TOKEN,
          process.env.MP_ACCESS_TOKEN, process.env.MP_TOKEN),
        mercadoPagoWebhook: configured(process.env.MERCADO_PAGO_WEBHOOK_SECRET),
        whatsapp: configured(process.env.WHATSAPP_ORDER_WEBHOOK_URL),
        whatsappToken: configured(process.env.WHATSAPP_ORDER_WEBHOOK_TOKEN),
        adminToken: configured(process.env.ADMIN_ORDERS_TOKEN),
      },
    });
  } catch (error) {
    const details = describeSupabaseError(error);
    console.error("Falha ao carregar visão administrativa:", details);
    return privateJson({
      error: error instanceof SupabaseOrdersConfigurationError
        ? "Supabase não configurado neste ambiente. Verifique as variáveis de ambiente do servidor."
        : "Não foi possível carregar o resumo. Verifique se a migração de gestão administrativa foi aplicada.",
    }, 503);
  }
}
