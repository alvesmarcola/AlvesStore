import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { getDatabasePool } from "@/lib/server/database";
import { sendTrackingUpdateEmail, sendWhatsAppOrderNotice, type OrderNotice } from "@/lib/server/order-notifications";

export const runtime = "nodejs";
function authorized(request: Request) {
  const expected = process.env.ADMIN_ORDERS_TOKEN;
  const provided = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!expected || provided.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(provided), Buffer.from(expected));
}

export async function GET(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: "Acesso nao autorizado." }, { status: 401 });
  try {
    const result = await getDatabasePool().query(
      `SELECT id, status, item_lines, customer, shipping, shipping_cents, total_cents, tracking_code, created_at
       FROM store_orders ORDER BY created_at DESC LIMIT 200`,
    );
    return NextResponse.json({ orders: result.rows }, { headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" } });
  } catch (error) {
    console.error("Falha ao carregar pedidos administrativos:", error instanceof Error ? error.message : "erro desconhecido");
    return NextResponse.json({ error: "Nao foi possivel carregar os pedidos." }, { status: 503 });
  }
}

export async function PATCH(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: "Acesso nao autorizado." }, { status: 401 });
  const body = await request.json().catch(() => null) as { orderId?: string; trackingCode?: string } | null;
  if (!body?.orderId || !/^[0-9a-f-]{36}$/i.test(body.orderId) || typeof body.trackingCode !== "string" || body.trackingCode.length > 80) {
    return NextResponse.json({ error: "Informe o pedido e um codigo de rastreio valido." }, { status: 400 });
  }
  try {
    const pool = getDatabasePool();
    const existing = await pool.query<OrderNotice & { tracking_code: string | null }>("SELECT id, status, item_lines, customer, shipping_cents, total_cents, tracking_code FROM store_orders WHERE id = $1", [body.orderId]);
    const order = existing.rows[0];
    if (!order) return NextResponse.json({ error: "Pedido nao encontrado." }, { status: 404 });
    const trackingCode = body.trackingCode.trim() || null;
    await pool.query("UPDATE store_orders SET tracking_code = $1, updated_at = NOW() WHERE id = $2", [trackingCode, body.orderId]);
    if (trackingCode && trackingCode !== order.tracking_code) {
      await Promise.all([
        sendTrackingUpdateEmail({ ...order, tracking_code: trackingCode }),
        sendWhatsAppOrderNotice("tracking_code_updated", { ...order, tracking_code: trackingCode }),
      ]);
    }
    return NextResponse.json({ updated: true });
  } catch (error) {
    console.error("Falha ao salvar rastreio:", error instanceof Error ? error.message : "erro desconhecido");
    return NextResponse.json({ error: "Nao foi possivel salvar o rastreio." }, { status: 503 });
  }
}
