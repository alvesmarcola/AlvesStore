import { NextResponse } from "next/server";
import { searchProducts } from "@/lib/smart-search";
import { getSupabaseProducts } from "@/lib/server/supabase-catalog";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get("q")?.trim().slice(0, 80) ?? "";
  if (query.length < 2) return NextResponse.json({ suggestions: [], alternativesOnly: false }, { headers: { "Cache-Control": "no-store" } });
  try {
    const products = await getSupabaseProducts();
    const search = searchProducts(products, query);
    const alternativesOnly = search.results.length === 0 && search.alternatives.length > 0;
    const rows = alternativesOnly ? search.alternatives : search.results;
    const suggestions = rows.slice(0, 5).map(({ id, slug, nome, clube, temporada }) => ({ id, slug, nome, clube, temporada }));
    return NextResponse.json({ suggestions, alternativesOnly }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Busca temporariamente indisponível." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
