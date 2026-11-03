import { NextResponse } from "next/server";
import { getInstagramFeed } from "@/lib/instagram";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(Math.max(Number(searchParams.get("limit")) || 6, 1), 12);

    const result = await getInstagramFeed(limit);

    return NextResponse.json(result, {
      status: 200,
      headers: {
        "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
      },
    });
  } catch (error) {
    console.error("GET /api/instagram failed:", error);
    return NextResponse.json(
      { posts: [], isLive: false, error: "Falha ao buscar feed do Instagram" },
      { status: 500 }
    );
  }
}
