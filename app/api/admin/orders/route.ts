import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { getSupabaseOrdersClient } from "@/lib/server/supabase-orders";
import { sendTrackingUpdateEmail, sendWhatsAppOrderNotice, type OrderNotice } from "@/lib/server/order-notifications";

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
    const { data, error } = await getSupabaseOrdersClient().from("store_orders")
      .select("id,status,item_lines,customer,shipping,shipping_cents,total_cents,tracking_code,created_at")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw error;
    return NextResponse.json({ orders: data }, { headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" } });
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
    const supabase = getSupabaseOrdersClient();
    const existing = await supabase.from("store_orders")
      .select("id,status,item_lines,customer,shipping_cents,total_cents,tracking_code")
      .eq("id", body.orderId)
      .maybeSingle();
    if (existing.error) throw existing.error;
    const order = existing.data as (OrderNotice & { tracking_code: string | null }) | null;
    if (!order) return NextResponse.json({ error: "Pedido não encontrado." }, { status: 404 });

    const trackingCode = body.trackingCode.trim() || null;
    // O pedido só pode ser despachado após a confirmação do pagamento.
    if (trackingCode && !["pago", "enviado", "approved"].includes(order.status)) {
      return NextResponse.json({ error: "Só é possível cadastrar o rastreio de pedidos com pagamento aprovado." }, { status: 409 });
    }
    const updated = await supabase.from("store_orders")
      .update({
        tracking_code: trackingCode,
        ...(trackingCode ? { status: "enviado" } : {}),
        updated_at: new Date().toISOString(),
      })
      .eq("id", body.orderId)
      .in("status", ["pago", "enviado", "approved"])
      .select("id")
      .maybeSingle();
    if (updated.error) throw updated.error;
    if (!updated.data) return NextResponse.json({ error: "O pedido não foi atualizado. Confirme se ele está pago e tente novamente." }, { status: 409 });

    let whatsappSent: boolean | null = null;
    let notificationWarning: string | undefined;
    if (trackingCode && trackingCode !== order.tracking_code) {
      const updatedOrder = { ...order, status: "enviado", tracking_code: trackingCode };
      const [, whatsappResult] = await Promise.all([
        sendTrackingUpdateEmail(updatedOrder),
        sendWhatsAppOrderNotice("tracking_code_updated", updatedOrder),
      ]);
      whatsappSent = whatsappResult;
      if (order.customer.whatsappUpdates === true && whatsappResult !== true) {
        notificationWarning = "O rastreio foi salvo, mas o WhatsApp não foi enviado. Verifique a configuração do provedor.";
      } else if (order.customer.whatsappUpdates !== true) {
        notificationWarning = "O rastreio foi salvo. O cliente não autorizou atualizações pelo WhatsApp.";
      }
    }
    return NextResponse.json({ updated: true, whatsappSent, message: notificationWarning });
  } catch (error) {
    console.error("Falha ao salvar rastreio:", error instanceof Error ? error.message : "erro desconhecido");
    return NextResponse.json({ error: "Não foi possível salvar o rastreio." }, { status: 503 });
  }
}
