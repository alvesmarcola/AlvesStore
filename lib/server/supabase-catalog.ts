import type { Product } from "@/lib/types";
import { products as localProducts } from "@/lib/catalog";

const PAGE_SIZE = 500;

function supabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return url && key ? { url: url.replace(/\/$/, ""), key } : null;
}

export async function getSupabaseProducts(): Promise<Product[]> {
  const config = supabaseConfig();
  if (!config) return localProducts;
  try {
    const response = await fetch(`${config.url}/rest/v1/products?select=id,slug,clube,clubeSlug,liga,publico,tipo,temporada,uniforme,nome,preco,tamanhos,cor,imageSeed,images&order=nome.asc&limit=${PAGE_SIZE}`, {
      headers: { apikey: config.key, Authorization: `Bearer ${config.key}` },
      next: { revalidate: 300, tags: ["products"] },
    });
    if (!response.ok) throw new Error(`Supabase catalog returned ${response.status}`);
    const rows = await response.json() as Product[];
    if (!rows.length) return localProducts;
    const merged = new Map(localProducts.map((product) => [product.id, product]));
    for (const product of rows) merged.set(product.id, product);
    return [...merged.values()];
  } catch (error) {
    console.error("Falha ao consultar catálogo Supabase; usando catálogo local.", error);
    return localProducts;
  }
}

export async function getSupabaseProduct(identifier: string): Promise<Product | undefined> {
  const config = supabaseConfig();
  if (!config) return localProducts.find((item) => item.slug === identifier || item.id === identifier);
  try {
    const escaped = encodeURIComponent(identifier);
    const response = await fetch(`${config.url}/rest/v1/products?select=id,slug,clube,clubeSlug,liga,publico,tipo,temporada,uniforme,nome,preco,tamanhos,cor,imageSeed,images&or=(slug.eq.${escaped},id.eq.${escaped})&limit=1`, {
      headers: { apikey: config.key, Authorization: `Bearer ${config.key}` },
      next: { revalidate: 300, tags: ["products", `product-${identifier}`] },
    });
    if (!response.ok) throw new Error(`Supabase product returned ${response.status}`);
    const rows = await response.json() as Product[];
    return rows[0] ?? localProducts.find((item) => item.slug === identifier || item.id === identifier);
  } catch (error) {
    console.error("Falha ao consultar produto Supabase; usando catálogo local.", error);
    return localProducts.find((item) => item.slug === identifier || item.id === identifier);
  }
}
