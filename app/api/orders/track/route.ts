import { NextResponse } from "next/server";
import { z } from "zod";
import { describeSupabaseError, getSupabaseOrdersClient } from "@/lib/server/supabase-orders";
import { isRateLimited } from "@/lib/server/rate-limit";
import { isCompleteOrderCode, normalizeOrderCodeInput } from "@/lib/order-code";

export const runtime = "nodejs";
const schema = z.object({ code: z.string().trim().min(4).max(36), contact: z.string().trim().min(5).max(120) }).strict();
const TRACK_LIMIT = 20;
const TRACK_WINDOW_MS = 10 * 60 * 1000;
const NO_MATCH = "Não encontramos um pedido com esses dados.";

function noMatch() {
  return NextResponse.json({ error: NO_MATCH }, { status: 404, headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  if (isRateLimited(request, "track", TRACK_LIMIT, TRACK_WINDOW_MS)) {
    return NextResponse.json({ error: "Muitas consultas seguidas. Aguarde alguns minutos e tente novamente." }, { status: 429, headers: { "Cache-Control": "no-store" } });
  }
  const input = schema.safeParse(await request.json().catch(() => null));
  if (!input.success || !isCompleteOrderCode(input.data.code)) return noMatch();

  const contact = input.data.contact.toLowerCase();
  const cpf = contact.replace(/\D/g, "");
  const prefix = normalizeOrderCodeInput(input.data.code);
  try {
    const { data, error } = await getSupabaseOrdersClient().rpc("find_store_order_tracking_details", {
      p_prefix: prefix,
      p_email: contact,
      p_cpf: cpf,
    });
    if (error) throw error;
    if (!Array.isArray(data) || data.length !== 1) return noMatch();
    const order = data[0];
    const operationalStatus = order.operational_status ?? (
      order.status === "enviado"
        ? "enviado"
        : order.status === "cancelled"
          ? "cancelado"
        : ["pago", "approved"].includes(order.status)
          ? "aguardando_fornecedor"
          : "aguardando_pagamento"
    );
    return NextResponse.json({ order: {
      code: prefix.toUpperCase(),
      status: order.status,
      operationalStatus,
      trackingCode: order.tracking_code,
      trackingUrl: order.tracking_url,
    } }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Falha ao consultar pedido:", describeSupabaseError(error));
    return NextResponse.json({ error: "Não foi possível consultar o pedido agora." }, { status: 503 });
  }
}
