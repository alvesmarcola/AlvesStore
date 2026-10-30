import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const token = process.env.REVALIDATE_TOKEN?.trim();
  const auth = request.headers.get("authorization") ?? "";
  const provided = (auth.startsWith("Bearer ") ? auth.slice(7) : new URL(request.url).searchParams.get("secret"))?.trim() ?? "";

  if (!token || provided.length !== token.length) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }
  const a = Buffer.from(provided);
  const b = Buffer.from(token);
  if (!timingSafeEqual(a, b)) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }
  revalidateTag("catalog");
  return NextResponse.json({ revalidated: true, tag: "catalog" });
}