import type { getSupabaseOrdersClient } from "@/lib/server/supabase-orders";

export async function checkProductOrders(
  supabase: ReturnType<typeof getSupabaseOrdersClient>,
  productId: string,
  slug: string
): Promise<number> {
  try {
    const { data, error } = await supabase.rpc("count_product_orders", {
      p_product_id: productId,
      p_slug: slug,
    });
    if (!error && typeof data === "number") {
      return data;
    }
  } catch {
    // se rpc falhar ou não existir ainda, roda fallback
  }

  // Fallback seguro inspecionando store_orders
  const { data: orders, error: ordersError } = await supabase
    .from("store_orders")
    .select("id, item_lines")
    .limit(1000);

  if (ordersError || !orders) return 0;

  let count = 0;
  for (const order of orders) {
    const items = Array.isArray(order.item_lines) ? order.item_lines : [];
    const hasItem = items.some(
      (item: Record<string, unknown>) => item?.productId === productId || item?.slug === slug
    );
    if (hasItem) count++;
  }
  return count;
}

export function extractStoragePaths(images: unknown): string[] {
  if (!Array.isArray(images)) return [];
  const paths: string[] = [];
  for (const img of images) {
    const src = typeof img === "string" ? img : (img as { src?: string })?.src;
    if (typeof src !== "string") continue;
    try {
      const url = new URL(src);
      const match = url.pathname.match(/\/produtos\/(manual\/[^?#]+)/);
      if (match && match[1]) {
        paths.push(decodeURIComponent(match[1]));
      }
    } catch {
      const match = src.match(/manual\/[^?#]+/);
      if (match && match[0]) {
        paths.push(decodeURIComponent(match[0]));
      }
    }
  }
  return Array.from(new Set(paths));
}

