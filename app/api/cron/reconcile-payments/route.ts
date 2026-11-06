import { NextResponse } from "next/server";
import { reconcilePendingPayments } from "@/lib/server/mercado-pago-payments";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization")?.trim();
  const cronSecret = process.env.CRON_SECRET?.trim();

  // Permite chamada com token no header Authorization: Bearer <CRON_SECRET>
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Acesso não autorizado." }, { status: 401 });
  }

  try {
    const summary = await reconcilePendingPayments();
    return NextResponse.json({ ok: true, ...summary });
  } catch (error) {
    console.error("[Cron Reconcile Payments] Falha ao reconciliar pagamentos pendentes:", error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Erro desconhecido na reconciliação.",
    }, { status: 500 });
  }
}

