import { NextResponse } from "next/server";

export const runtime = "nodejs";

// Checkout Pro uses POST notifications; GET is a harmless endpoint health check.
export { POST } from "@/app/api/mercado-pago/webhook/route";

export function GET() {
  return NextResponse.json({ received: true }, { status: 200 });
}
