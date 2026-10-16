import type { Product, ProductImage } from "@/lib/types";
import bundledProducts from "@/data/products.json";

const PAGE_SIZE = 100;
const PRODUCT_COLUMNS = "id,slug,clube,clubeSlug,liga,publico,tipo,temporada,uniforme,nome,preco,tamanhos,cor,imageSeed";
const LIST_PRODUCT_COLUMNS = `${PRODUCT_COLUMNS},images`;
const DETAIL_PRODUCT_COLUMNS = `${PRODUCT_COLUMNS},images`;
const bundledCatalog = bundledProducts as unknown as Product[];

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

function normalizeAudience(value: unknown): Product["publico"] {
  const normalized = typeof value === "string" ? slugifyCatalogValue(value) : "";
  if (["masculino", "homem", "homens", "men", "male"].some((term) => normalized.includes(term))) return "masculino";
  if (["feminino", "mulher", "mulheres", "women", "female"].some((term) => normalized.includes(term))) return "feminino";
  if (["unissex", "unisex", "unisexo"].some((term) => normalized.replaceAll("-", "").includes(term))) return "unissex";
  if (["infantil", "infantojuvenil", "kids", "kid", "junior", "youth", "children"].some((term) => normalized.includes(term))) return "infantil";
  return "revisar";
}

function normalizeProductType(value: unknown): Product["tipo"] {
  const normalized = typeof value === "string" ? slugifyCatalogValue(value) : "";
  if (["torcedor", "fan", "supporter"].some((term) => normalized.includes(term))) return "torcedor";
  if (["jogador", "player"].some((term) => normalized.includes(term))) return "jogador";
  if (["goleiro", "goalkeeper"].some((term) => normalized.includes(term))) return "goleiro";
  if (["retro", "vintage"].some((term) => normalized.includes(term))) return "retro";
  if (["treino", "training"].some((term) => normalized.includes(term))) return "treino";
  if (normalized.includes("cropped") || normalized === "crop") return "cropped";
  if (normalized.includes("regata") || normalized.includes("tank-top")) return "regata";
  if (normalized.includes("inverno") || normalized.includes("winter")) return "inverno";
  if (normalized.includes("vestido") || normalized.includes("dress")) return "vestido";
  const aliases: Record<string, Product["tipo"]> = {
    revisar: "revisar",
  };
  return aliases[normalized] ?? "revisar";
}

function normalizeLeague(value: unknown) {
  const slug = typeof value === "string" ? slugifyCatalogValue(value) : "";
  if (slug.includes("selec") || slug.includes("national-team")) return "selecoes";
  return slug || "revisar";
}

function normalizeUniform(value: unknown): Product["uniforme"] {
  const normalized = typeof value === "string" ? slugifyCatalogValue(value) : "";
  const aliases: Record<string, Product["uniforme"]> = {
    titular: "titular", home: "titular",
    reserva: "reserva", away: "reserva", visitante: "reserva",
    terceiro: "terceiro", third: "terceiro", "3rd": "terceiro",
    quarto: "quarto", fourth: "quarto", "4th": "quarto",
    revisar: "revisar",
  };
  return aliases[normalized] ?? "revisar";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function productImageValues(value: Record<string, unknown>): unknown[] {
  if (Array.isArray(value.images)) return value.images;
  if (isRecord(value.images)) return [value.images];
  if (typeof value.images === "string" && value.images.trim()) {
    const raw = value.images.trim();
    try {
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
      if (isRecord(parsed)) return [parsed];
      if (typeof parsed === "string") return [parsed];
    } catch {
      // Legacy text columns may contain a URL or comma-separated URLs.
    }
    return raw.split(/,\s*(?=(?:https?:)?\/\/)/i).filter(Boolean);
  }
  return [value.cover, value.alternate, value.image, value.imageSeed];
}

function mapImage(value: unknown, productName: string, index: number): ProductImage | null {
  if (typeof value === "string") value = { src: value };
  if (!isRecord(value) || typeof value.src !== "string") return null;
  let imageUrl: URL;
  try {
    imageUrl = new URL(value.src.startsWith("//") ? `https:${value.src}` : value.src);
  } catch {
    return null;
  }
  const isYupooHost = imageUrl.hostname === "yupoo.com" || imageUrl.hostname.endsWith(".yupoo.com");
  const isSupabaseHost = imageUrl.hostname.endsWith(".supabase.co");
  if (imageUrl.protocol === "http:" && isYupooHost) imageUrl.protocol = "https:";
  if (imageUrl.protocol !== "https:" || (!isYupooHost && !isSupabaseHost)) return null;
  const src = imageUrl.toString();
  const focalPoint = isRecord(value.focalPoint) ? value.focalPoint : {};
  return {
    src,
    source: typeof value.source === "string" ? value.source : src,
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
  const candidateClubSlug = typeof value.clubeSlug === "string" ? slugifyCatalogValue(value.clubeSlug) : "";
  const rawClubSlug = candidateClubSlug && candidateClubSlug !== "revisar" ? candidateClubSlug : club;
  const clubSlug = slugifyCatalogValue(rawClubSlug);
  const league = normalizeLeague(value.liga);
  const imageValues = productImageValues(value);
  const images = imageValues
    .map((image, index) => mapImage(image, name, index))
    .filter((image): image is ProductImage => image !== null);
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
    publico: normalizeAudience(value.publico),
    tipo: normalizeProductType(value.tipo),
    temporada: typeof value.temporada === "string" ? value.temporada : "revisar",
    uniforme: normalizeUniform(value.uniforme),
    nome: name,
    preco: Number.isFinite(price) && price >= 0 ? price : 0,
    tamanhos: sizes,
    cor: typeof value.cor === "string" ? value.cor : "revisar",
    imageSeed: typeof value.imageSeed === "string" ? value.imageSeed : name,
    images,
  };
}

function isPublishedProduct(product: Product) {
  return (product.images?.length ?? 0) > 0 && product.publico !== "revisar" && product.tipo !== "revisar";
}

export async function getSupabaseProducts(): Promise<Product[]> {
  const config = supabaseConfig();
  if (!config) {
    return bundledCatalog.filter(isPublishedProduct);
  }

  const products: Product[] = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    // A unique, stable key prevents rows from being skipped or repeated between pages.
    const query = new URLSearchParams({ select: LIST_PRODUCT_COLUMNS, order: "slug.asc", limit: String(PAGE_SIZE), offset: String(offset) });
    const response = await fetch(`${config.url}/rest/v1/products?${query}`, {
      cache: "no-store",
      headers: {
        apikey: config.key,
        ...(config.key.startsWith("eyJ") ? { Authorization: `Bearer ${config.key}` } : {}),
      },
    });
    if (!response.ok) {
      console.error(`Falha ao consultar catálogo Supabase: HTTP ${response.status}.`);
      throw new Error("Não foi possível carregar o catálogo atual da loja.");
    }
    const rows = await response.json() as unknown[];
    products.push(...rows.map(mapProduct).filter((product): product is Product => product !== null));
    if (rows.length < PAGE_SIZE) break;
  }
  const published = products.filter(isPublishedProduct);
  return published.length ? published : bundledCatalog.filter(isPublishedProduct);
}

export async function getSupabaseProductBySlug(slug: string): Promise<Product | undefined> {
  const bundledProduct = bundledCatalog.find((product) => product.slug.toLocaleLowerCase("en-US") === slug.toLocaleLowerCase("en-US") && isPublishedProduct(product));
  const config = supabaseConfig();
  if (!config) return bundledProduct;

  const query = new URLSearchParams({ select: DETAIL_PRODUCT_COLUMNS, slug: `ilike.${slug.toLocaleLowerCase("en-US")}`, limit: "1" });
  const response = await fetch(`${config.url}/rest/v1/products?${query}`, {
    cache: "no-store",
    signal: AbortSignal.timeout(8_000),
    headers: {
      apikey: config.key,
      ...(config.key.startsWith("eyJ") ? { Authorization: `Bearer ${config.key}` } : {}),
    },
  }).catch((error: unknown) => {
    console.error("Falha ao consultar produto no Supabase.", error);
    return null;
  });
  if (!response) return bundledProduct;
  if (!response.ok) {
    console.error(`Falha ao consultar produto Supabase: HTTP ${response.status}.`);
    return bundledProduct;
  }
  const rows = await response.json() as unknown[];
  const product = rows.length ? mapProduct(rows[0]) ?? undefined : undefined;
  return product && isPublishedProduct(product) ? product : bundledProduct;
}

export function getBundledRelatedProducts(product: Product): Product[] {
  return bundledCatalog.filter((item) => isPublishedProduct(item) && item.id !== product.id &&
    ((product.clubeSlug !== "revisar" && item.clubeSlug === product.clubeSlug) ||
      (product.liga !== "revisar" && item.liga === product.liga))).slice(0, 5);
}
