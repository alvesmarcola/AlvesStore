import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { getDatabasePool } from "@/lib/server/database";

export const runtime = "nodejs";
function authorized(request: Request) {
  const expected = process.env.ADMIN_ORDERS_TOKEN;
  const provided = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!expected || provided.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(provided), Buffer.from(expected));
}

export async function GET(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: "Acesso não autorizado." }, { status: 401 });
  try {
    const result = await getDatabasePool().query(
      `SELECT id, status, item_lines, customer, shipping, shipping_cents, total_cents, tracking_code, created_at
       FROM store_orders WHERE status = 'approved' ORDER BY created_at DESC LIMIT 500`,
    );
    return NextResponse.json({ orders: result.rows }, { headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" } });
  } catch (error) {
    console.error("Falha ao carregar pedidos administrativos:", error instanceof Error ? error.message : "erro desconhecido");
    return NextResponse.json({ error: "Não foi possível carregar os pedidos." }, { status: 503 });
  }
}

export async function PATCH(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: "Acesso não autorizado." }, { status: 401 });
  const body = await request.json().catch(() => null) as { orderId?: string; trackingCode?: string } | null;
  if (!body?.orderId || !/^[0-9a-f-]{36}$/i.test(body.orderId) || typeof body.trackingCode !== "string" || body.trackingCode.length > 80) {
    return NextResponse.json({ error: "Informe o pedido e um código de rastreio válido." }, { status: 400 });
  }
  try {
    const result = await getDatabasePool().query("UPDATE store_orders SET tracking_code = $1, updated_at = NOW() WHERE id = $2 RETURNING id", [body.trackingCode.trim() || null, body.orderId]);
    if (!result.rowCount) return NextResponse.json({ error: "Pedido não encontrado." }, { status: 404 });
    return NextResponse.json({ updated: true });
  } catch (error) {
    console.error("Falha ao salvar rastreio:", error instanceof Error ? error.message : "erro desconhecido");
    return NextResponse.json({ error: "Não foi possível salvar o rastreio." }, { status: 503 });
  }
}
