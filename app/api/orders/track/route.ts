import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseOrdersClient } from "@/lib/server/supabase-orders";

export const runtime = "nodejs";
const schema = z.object({ code: z.string().trim().min(4).max(36), contact: z.string().trim().min(5).max(120) }).strict();

export async function POST(request: Request) {
  const input = schema.safeParse(await request.json().catch(() => null));
  if (!input.success) return NextResponse.json({ error: "Informe o código do pedido e o e-mail ou CPF usado na compra." }, { status: 400 });

  const contact = input.data.contact.toLowerCase();
  const cpf = contact.replace(/\D/g, "");
  const prefix = input.data.code.replace(/[^a-f0-9-]/gi, "").toLowerCase();
  try {
    const { data, error } = await getSupabaseOrdersClient().rpc("find_store_order_for_tracking", {
      p_prefix: prefix,
      p_email: contact,
      p_cpf: cpf,
    });
    if (error) throw error;
    if (!Array.isArray(data) || data.length !== 1) return NextResponse.json({ error: "Não encontramos um pedido com esses dados." }, { status: 404 });
    const order = data[0];
    return NextResponse.json({ order: {
      code: String(order.id).slice(0, 8).toUpperCase(),
      status: order.status,
      trackingCode: order.tracking_code,
      shipping: order.shipping?.label ?? "Frete fixo",
      createdAt: order.created_at,
    } }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Falha ao consultar pedido:", error instanceof Error ? error.message : "erro desconhecido");
    return NextResponse.json({ error: "Não foi possível consultar o pedido agora." }, { status: 503 });
  }
}
