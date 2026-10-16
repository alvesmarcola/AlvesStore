import type { Product, ProductImage } from "@/lib/types";

const PAGE_SIZE = 500;
const PRODUCT_COLUMNS = "id,yupoo_id,slug,clube,clubeSlug,liga,publico,tipo,temporada,uniforme,nome,preco,tamanhos,cor,imageSeed,images";

function supabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim()
    || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  return url && key ? { url: url.replace(/\/$/, ""), key } : null;
}

function slugifyCatalogValue(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function mapImage(value: unknown, productName: string, index: number): ProductImage | null {
  if (!isRecord(value) || typeof value.src !== "string" || !/^https:\/\//i.test(value.src)) return null;
  const focalPoint = isRecord(value.focalPoint) ? value.focalPoint : {};
  return {
    src: value.src,
    source: typeof value.source === "string" ? value.source : value.src,
    alt: typeof value.alt === "string" && value.alt.trim() ? value.alt : `${productName} · imagem ${index + 1}`,
    credit: typeof value.credit === "string" ? value.credit : "Yupoo",
    focalPoint: {
      x: typeof focalPoint.x === "number" ? Math.min(100, Math.max(0, focalPoint.x)) : 50,
      y: typeof focalPoint.y === "number" ? Math.min(100, Math.max(0, focalPoint.y)) : 50,
    },
    blurDataURL: typeof value.blurDataURL === "string" ? value.blurDataURL : "",
  };
}

function mapProduct(value: unknown): Product | null {
  if (!isRecord(value) || typeof value.id !== "string" || typeof value.nome !== "string" || typeof value.slug !== "string") return null;
  const name = value.nome.trim();
  if (!name) return null;
  const club = typeof value.clube === "string" && value.clube.trim() ? value.clube.trim() : "Revisar";
  const clubSlug = typeof value.clubeSlug === "string" ? slugifyCatalogValue(value.clubeSlug) : slugifyCatalogValue(club);
  const league = typeof value.liga === "string" ? slugifyCatalogValue(value.liga) : "revisar";
  const images = Array.isArray(value.images)
    ? value.images.map((image, index) => mapImage(image, name, index)).filter((image): image is ProductImage => image !== null)
    : [];
  const sizes = Array.isArray(value.tamanhos)
    ? value.tamanhos.filter((size): size is string => typeof size === "string" && size !== "3GG")
    : [];
  const price = Number(value.preco);

  return {
    id: value.id,
    slug: value.slug,
    clube: club,
    clubeSlug: clubSlug || "revisar",
    liga: league || "revisar",
    publico: typeof value.publico === "string" ? value.publico as Product["publico"] : "revisar",
    tipo: typeof value.tipo === "string" ? value.tipo as Product["tipo"] : "revisar",
    temporada: typeof value.temporada === "string" ? value.temporada : "revisar",
    uniforme: typeof value.uniforme === "string" ? value.uniforme as Product["uniforme"] : "revisar",
    nome: name,
    preco: Number.isFinite(price) && price >= 0 ? price : 0,
    tamanhos: sizes,
    cor: typeof value.cor === "string" ? value.cor : "revisar",
    imageSeed: typeof value.imageSeed === "string" ? value.imageSeed : name,
    images,
  };
}

export async function getSupabaseProducts(): Promise<Product[]> {
  const config = supabaseConfig();
  if (!config) {
    console.error("Catálogo indisponível: configure NEXT_PUBLIC_SUPABASE_URL e uma chave pública de leitura.");
    return [];
  }

  const products: Product[] = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    // A unique, stable key prevents rows from being skipped or repeated between pages.
    const query = new URLSearchParams({ select: PRODUCT_COLUMNS, order: "slug.asc", limit: String(PAGE_SIZE), offset: String(offset) });
    const response = await fetch(`${config.url}/rest/v1/products?${query}`, {
      headers: {
        apikey: config.key,
        ...(config.key.startsWith("eyJ") ? { Authorization: `Bearer ${config.key}` } : {}),
      },
      next: { revalidate: 300, tags: ["products"] },
    });
    if (!response.ok) {
      console.error(`Falha ao consultar catálogo Supabase: HTTP ${response.status}.`);
      throw new Error("Não foi possível carregar o catálogo atual da loja.");
    }
    const rows = await response.json() as unknown[];
    products.push(...rows.map(mapProduct).filter((product): product is Product => product !== null));
    if (rows.length < PAGE_SIZE) break;
  }
  return products;
}

export async function getSupabaseProduct(identifier: string): Promise<Product | undefined> {
  const products = await getSupabaseProducts();
  return products.find((product) => product.slug === identifier || product.id === identifier);
}
