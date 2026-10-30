import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const token = process.env.ADMIN_ORDERS_TOKEN?.trim();
  const auth = request.headers.get("authorization") ?? "";
  const provided = auth.startsWith("Bearer ") ? auth.slice(7).trim() : new URL(request.url).searchParams.get("secret")?.trim();
  if (!token || provided !== token) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }
  revalidateTag("catalog");
  return NextResponse.json({ revalidated: true, tag: "catalog" });
}