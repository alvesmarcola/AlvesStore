import { NextResponse } from "next/server";
import { z } from "zod";
import { getDatabasePool } from "@/lib/server/database";

export const runtime = "nodejs";
const schema = z.object({ code: z.string().trim().min(4).max(36), contact: z.string().trim().min(5).max(120) }).strict();

export async function POST(request: Request) {
  const input = schema.safeParse(await request.json().catch(() => null));
  if (!input.success) return NextResponse.json({ error: "Informe o código do pedido e o e-mail ou CPF usado na compra." }, { status: 400 });
  const contact = input.data.contact.toLowerCase();
  const cpf = contact.replace(/\D/g, "");
  try {
    const result = await getDatabasePool().query<{ id: string; status: string; tracking_code: string | null; shipping: { label?: string }; created_at: string }>(
      `SELECT id, status, tracking_code, shipping, created_at FROM store_orders
       WHERE id::text LIKE $1 AND (lower(customer->>'email') = $2 OR regexp_replace(customer->>'cpf', '[^0-9]', '', 'g') = $3)
       LIMIT 2`, [`${input.data.code.replace(/[^a-f0-9-]/gi, "").toLowerCase()}%`, contact, cpf],
    );
    if (result.rows.length !== 1) return NextResponse.json({ error: "Não encontramos um pedido com esses dados." }, { status: 404 });
    const order = result.rows[0];
    return NextResponse.json({ order: { code: order.id.slice(0, 8).toUpperCase(), status: order.status, trackingCode: order.tracking_code, shipping: order.shipping?.label ?? "Frete fixo", createdAt: order.created_at } });
  } catch (error) {
    console.error("Falha ao consultar pedido:", error instanceof Error ? error.message : "erro desconhecido");
    return NextResponse.json({ error: "Não foi possível consultar o pedido agora." }, { status: 503 });
  }
}
