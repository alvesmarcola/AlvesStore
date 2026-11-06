import { NextResponse } from "next/server";

export const runtime = "nodejs";

export { POST } from "@/app/api/mercado-pago/webhook/route";

export function GET() {
  return NextResponse.json({ received: true }, { status: 200 });
}

