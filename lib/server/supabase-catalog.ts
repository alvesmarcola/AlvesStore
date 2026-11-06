import type { Product, ProductImage } from "@/lib/types";
import bundledProducts from "@/data/products.json";
import f1BundledProducts from "@/data/f1-products.json";
import supabaseProductsCache from "@/data/supabase-products-cache.json";
import { isFeminineProduct, prepareFeminineProduct } from "@/lib/feminine-catalog";
import { isFormulaOneEvidence, isFormulaOneProduct, isJacketFormulaOneProduct } from "@/lib/formula-one";
import { unstable_cache } from "next/cache";

const PAGE_SIZE = 1000;
const PRODUCT_COLUMNS = "id,yupoo_id,slug,clube,clubeSlug,liga,publico,tipo,temporada,uniforme,nome,preco,tamanhos,cor,imageSeed";
const LIST_PRODUCT_COLUMNS = `${PRODUCT_COLUMNS},images`;
const DETAIL_PRODUCT_COLUMNS = `${PRODUCT_COLUMNS},images,description,brand,tem_variacao_uniforme,oculto`;
const bundledCatalog = [...(bundledProducts as unknown as Product[]), ...(f1BundledProducts as unknown as Product[])];

export function getBundledFormulaOneProducts(): Product[] {
  return bundledCatalog.filter((product) => isPublishedProduct(product) && isFormulaOneProduct(product));
}

export function getBundledFeminineProducts(): Product[] {
  return bundledCatalog.filter((product) => isPublishedProduct(product) && isFeminineProduct(product))
    .map(prepareFeminineProduct);
}

export function hasBundledProductSlug(slug: string) {
  const normalized = slug.toLocaleLowerCase("en-US");
  return bundledCatalog.some((product) => product.slug.toLocaleLowerCase("en-US") === normalized);
}

function supabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || process.env.SUPABASE_URL?.trim();
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim()
    || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()
    || process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
    || process.env.SUPABASE_SECRET_KEY?.trim();
  return url && key ? { url: url.replace(/\/$/, ""), key } : null;
}

export function hasSupabaseCatalogConfiguration() {
  return supabaseConfig() !== null;
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
  if (normalized.includes("regata") || normalized.includes("tank-top")) return "regata";
  if (["f1", "formula-1", "formula-one", "formula1"].includes(normalized) || /\b(?:f1|formula[-\s]*1|formula[-\s]*one)\b/.test(normalized)) return "f1";
  if (isFormulaOneEvidence(normalized)) return "f1";
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
  if (["f1", "formula-1", "formula-one", "formula1"].includes(slug) || isFormulaOneEvidence(slug)) return "f1";
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

function inferF1Team(name: string): { club: string; clubSlug: string } {
  const lower = name.toLowerCase();
  if (lower.includes("ferrari")) return { club: "Ferrari", clubSlug: "ferrari" };
  if (lower.includes("mercedes")) return { club: "Mercedes-AMG", clubSlug: "mercedes-amg" };
  if (lower.includes("red bull")) return { club: "Red Bull Racing", clubSlug: "red-bull-racing" };
  if (lower.includes("mclaren")) return { club: "McLaren", clubSlug: "mclaren" };
  if (lower.includes("williams")) return { club: "Williams", clubSlug: "williams" };
  if (lower.includes("aston martin")) return { club: "Aston Martin", clubSlug: "aston-martin" };
  if (lower.includes("alpine")) return { club: "Alpine", clubSlug: "alpine" };
  if (lower.includes("haas")) return { club: "Haas", clubSlug: "haas" };
  if (lower.includes("cadillac")) return { club: "Cadillac F1", clubSlug: "cadillac-f1" };
  if (lower.includes("audi")) return { club: "Audi F1", clubSlug: "audi-f1" };
  if (lower.includes("senna")) return { club: "Ayrton Senna", clubSlug: "senna" };
  return { club: "F1 Racing", clubSlug: "f1-racing" };
}

function mapProduct(value: unknown): Product | null {
  if (!isRecord(value) || typeof value.id !== "string" || typeof value.slug !== "string") return null;
  const rawName = typeof value.nome === "string" ? value.nome : typeof value.title === "string" ? value.title : value.name;
  if (typeof rawName !== "string") return null;
  const name = rawName.trim();
  if (!name) return null;
  let club = typeof value.clube === "string" && value.clube.trim() ? value.clube.trim() : "Revisar";
  const candidateClubSlug = typeof value.clubeSlug === "string" ? slugifyCatalogValue(value.clubeSlug) : "";
  const rawClubSlug = candidateClubSlug && candidateClubSlug !== "revisar" ? candidateClubSlug : club;
  let clubSlug = slugifyCatalogValue(rawClubSlug);
  const imageValues = productImageValues(value);
  const images = imageValues
    .map((image, index) => mapImage(image, name, index))
    .filter((image): image is ProductImage => image !== null);
  let sizes = Array.isArray(value.tamanhos)
    ? value.tamanhos.filter((size): size is string => typeof size === "string" && size !== "3GG")
    : [];
  let price = Number(value.preco);
  const tags = Array.isArray(value.tags) ? value.tags.filter((tag): tag is string => typeof tag === "string")
    : typeof value.tags === "string" ? value.tags.split(/[,|]/).map((tag) => tag.trim()).filter(Boolean) : [];
  const evidence = [value.publico, value.gender, value.category, value.liga, value.league, value.subcategory,
    value.tipo, value.title, value.name, value.model, value.version, name, value.slug, value.imageSeed, ...tags,
    ...images.flatMap((image) => [image.source, image.src])]
    .filter((item): item is string => typeof item === "string").join(" ");
  const normalizedEvidence = slugifyCatalogValue(evidence);
  let audience: Product["publico"] = /feminin|baby-look|babylook|women|woman|ladies/.test(normalizedEvidence)
    ? "feminino" : normalizeAudience(value.publico ?? value.gender);
  let type = normalizeProductType(value.tipo);
  if (type === "revisar") type = normalizeProductType(evidence);
  if (type === "revisar" && (audience === "feminino" || audience === "unissex" || audience === "infantil")) type = "torcedor";
  if (audience === "infantil" && sizes.length === 0) {
    sizes = ["16", "18", "20", "22", "24", "26", "28"];
  }
  if (audience === "infantil" && (!Number.isFinite(price) || price <= 0)) {
    price = 180;
  }
  let league = normalizeLeague(value.liga ?? value.league);

  const isManual = Boolean(
    (typeof value.yupoo_id === "string" && value.yupoo_id.startsWith("manual:")) ||
    (typeof value.id === "string" && value.id.startsWith("manual:")) ||
    value.slug === "teste" ||
    name.toLowerCase() === "teste"
  );

  const isNba = !isManual && (league === "nba" || type === "regata" || normalizedEvidence.includes("nba"));
  if (isNba) {
    league = "nba";
    if (type === "revisar" || type === "f1") type = "regata";
    if (audience === "revisar") audience = "masculino";
    if (!Number.isFinite(price) || price <= 0) price = 230;
    if (sizes.length === 0) sizes = ["P", "M", "G", "GG"];
  }

  const isRetro = !isNba && !isManual && (type === "retro" || slugifyCatalogValue(value.slug).startsWith("retro-") || slugifyCatalogValue(value.slug).includes("-retro"));
  if (isRetro) {
    if (type === "revisar") type = "retro";
    if (audience === "revisar") audience = "masculino";
    if (!Number.isFinite(price) || price <= 0) price = 185;
  }

  const isF1 = !isNba && !isRetro && !isManual && (type === "f1" || type === "formula1" || league === "f1" || isFormulaOneEvidence(normalizedEvidence));
  if (isF1) {
    type = "f1";
    league = "f1";
    if (audience === "revisar") audience = "unissex";
    if (!Number.isFinite(price) || price <= 0) price = 180;
    if (sizes.length === 0) sizes = ["P", "M", "G", "GG", "2GG"];
    if (club === "Revisar" || !clubSlug || clubSlug === "revisar") {
      const inferred = inferF1Team(name);
      club = inferred.club;
      clubSlug = inferred.clubSlug;
    }
  }

  if (isManual && Number.isFinite(Number(value.preco)) && Number(value.preco) >= 0) {
    price = Number(value.preco);
  }

  return {
    id: value.id,
    yupoo_id: typeof value.yupoo_id === "string" ? value.yupoo_id : undefined,
    slug: value.slug,
    clube: club,
    clubeSlug: clubSlug || "revisar",
    liga: league || "revisar",
    publico: audience,
    tipo: type,
    temporada: typeof value.temporada === "string" ? value.temporada : "revisar",
    uniforme: normalizeUniform(value.uniforme),
    nome: name,
    preco: Number.isFinite(price) && price >= 0 ? price : 0,
    tamanhos: sizes,
    cor: typeof value.cor === "string" ? value.cor : "revisar",
    imageSeed: typeof value.imageSeed === "string" ? value.imageSeed : name,
    images,
    category: typeof value.category === "string" ? value.category : undefined,
    gender: typeof value.gender === "string" ? value.gender : undefined,
    league: typeof value.league === "string" ? value.league : undefined,
    subcategory: typeof value.subcategory === "string" ? value.subcategory : undefined,
    tags: tags.length ? tags : undefined,
    description: typeof value.description === "string" ? value.description : undefined,
    brand: typeof value.brand === "string" ? value.brand : undefined,
    title: typeof value.title === "string" ? value.title : undefined,
    name: typeof value.name === "string" ? value.name : undefined,
    model: typeof value.model === "string" ? value.model : undefined,
    version: typeof value.version === "string" ? value.version : undefined,
    tem_variacao_uniforme: Boolean(value.tem_variacao_uniforme),
    oculto: Boolean(value.oculto),
    ignorar_regras_preco: Boolean(value.ignorar_regras_preco),
    sem_oferta_quantidade: Boolean(value.sem_oferta_quantidade),
  };
}

function isYupooImageUrl(value: string) {
  try {
    const hostname = new URL(value, "https://catalog-image.invalid").hostname.toLocaleLowerCase("en-US");
    return hostname === "yupoo.com" || hostname.endsWith(".yupoo.com");
  } catch {
    return false;
  }
}

function hasStorefrontImages(product: Product) {
  const images = product.images ?? [];
  const isF1 = product.tipo === "f1" || product.tipo === "formula1" || product.liga === "f1" || isFormulaOneProduct(product);
  return images.length > 0 && images.every((image) =>
    typeof image.src === "string" && image.src.trim().length > 0 && (isF1 || !isYupooImageUrl(image.src)) &&
    (isF1 || !image.fallbackSrc || !isYupooImageUrl(image.fallbackSrc)),
  );
}

function isPublishedProduct(product: Product) {
  if (product.oculto === true) return false;
  if (isJacketFormulaOneProduct(product)) return false;
  const isNba = product.liga === "nba" || product.tipo === "regata";
  const isRetro = product.tipo === "retro" || product.slug.startsWith("retro-") || product.slug.includes("-retro");
  const hasImage = (product.tipo === "f1" || product.tipo === "formula1" || product.liga === "f1" || isFormulaOneProduct(product))
    ? true
    : hasStorefrontImages(product);
  const hasKnownAudience = product.publico !== "revisar" || isNba || isRetro;
  const isFormulaOne = product.tipo === "f1" || product.tipo === "formula1" || product.liga === "f1" || isFormulaOneProduct(product);
  return hasImage && (product.tipo !== "revisar" || isNba || isRetro) && (hasKnownAudience || isFormulaOne);
}

export function getCachedSupabaseProducts(): Product[] {
  const cachedRows = (supabaseProductsCache as unknown[]).map(mapProduct).filter((product): product is Product => product !== null);
  return cachedRows.filter(isPublishedProduct);
}

export async function fetchSupabaseProducts(): Promise<Product[]> {
  const config = supabaseConfig();
  const cachedFallback = getCachedSupabaseProducts();

  const products: Product[] = [];
  let fetchFailed = false;

  if (config) {
    try {
      let activeColumns = LIST_PRODUCT_COLUMNS;
      for (let offset = 0; ; offset += PAGE_SIZE) {
        const headers = {
          apikey: config.key,
          ...(config.key.startsWith("eyJ") ? { Authorization: `Bearer ${config.key}` } : {}),
        };
        const query = new URLSearchParams({ select: activeColumns, order: "slug.asc", limit: String(PAGE_SIZE), offset: String(offset) });
        let response = await fetch(`${config.url}/rest/v1/products?${query}`, {
          headers,
          next: { revalidate: 300, tags: ["catalog"] },
          signal: AbortSignal.timeout(15_000),
        });
        if (!response.ok && offset === 0) {
          // Se a seleção falhar na primeira página, recorre para as colunas básicas
          activeColumns = LIST_PRODUCT_COLUMNS;
          query.set("select", activeColumns);
          response = await fetch(`${config.url}/rest/v1/products?${query}`, {
            headers,
            next: { revalidate: 300, tags: ["catalog"] },
            signal: AbortSignal.timeout(15_000),
          });
        }
        if (!response.ok) {
          console.warn(`Falha ao consultar catálogo Supabase: HTTP ${response.status}. Utilizando snapshot válido em cache.`);
          fetchFailed = true;
          break;
        }
        const rows = await response.json() as unknown[];
        const mapped = rows.map(mapProduct).filter((product): product is Product => product !== null)
          .filter(isPublishedProduct)
          .map((product) => ({ ...product, images: (product.images ?? []).slice(0, 2) }));
        products.push(...mapped);
        if (rows.length < PAGE_SIZE) break;
      }
    } catch (error) {
      console.warn("Falha de conexão com Supabase durante carregamento do catálogo; utilizando último snapshot válido em cache:", error);
      fetchFailed = true;
    }
  } else {
    fetchFailed = true;
  }

  let published = products.filter(isPublishedProduct);
  if (fetchFailed || !published.length) {
    if (cachedFallback.length > 0) {
      published = cachedFallback;
    } else {
      // Se nem o Supabase nem o cache trouxerem produtos e for build de produção, o build deve falhar
      if (process.env.NODE_ENV === "production" || process.env.NEXT_PHASE === "phase-production-build") {
        throw new Error("Falha crítica no build: catálogo do Supabase inacessível e nenhum cache de produtos válido encontrado.");
      }
    }
  }

  const mergedBySlug = new Map<string, Product>();
  for (const product of bundledCatalog.filter(isPublishedProduct)) mergedBySlug.set(product.slug, product);
  for (const product of getBundledFeminineProducts()) mergedBySlug.set(product.slug, product);
  for (const product of getBundledFormulaOneProducts()) mergedBySlug.set(product.slug, product);
  for (const product of published) mergedBySlug.set(product.slug, product);
  const result = [...mergedBySlug.values()];

  // Verificação de integridade no build: nunca publicar catálogo parcial sem NBA ou ligas principais
  const isBuildPhase = process.env.NODE_ENV === "production" || process.env.NEXT_PHASE === "phase-production-build";
  const hasNba = result.some((p) => p.liga === "nba" || p.tipo === "regata");
  const hasBrasileirao = result.some((p) => p.liga === "brasileirao-serie-a");
  if (isBuildPhase && (!hasNba || !hasBrasileirao || result.length < 500)) {
    throw new Error(`Integridade do catálogo violada no build: total=${result.length}, temNBA=${hasNba}, temBrasileirão=${hasBrasileirao}.`);
  }

  return result;
}

export const getSupabaseProducts = unstable_cache(
  fetchSupabaseProducts,
  ["supabase-products-v3"],
  { revalidate: 300, tags: ["catalog"] },
);

export async function getSupabaseProductBySlug(slug: string, options?: { allowHidden?: boolean }): Promise<Product | undefined> {
  const allowHidden = options?.allowHidden === true;
  const isMatch = (product: Product) => (allowHidden || isPublishedProduct(product));
  const bundledProduct = bundledCatalog.find((product) => product.slug.toLocaleLowerCase("en-US") === slug.toLocaleLowerCase("en-US") && isMatch(product));
  const cachedProduct = getCachedSupabaseProducts().find((product) => product.slug.toLocaleLowerCase("en-US") === slug.toLocaleLowerCase("en-US") && isMatch(product));
  const fallbackProduct = bundledProduct || cachedProduct;
  const config = supabaseConfig();
  if (!config) return fallbackProduct;

  const query = new URLSearchParams({ select: DETAIL_PRODUCT_COLUMNS, slug: `ilike.${slug.toLocaleLowerCase("en-US")}`, limit: "1" });
  let response = await fetch(`${config.url}/rest/v1/products?${query}`, {
    next: { revalidate: 300, tags: ["catalog"] },
    signal: AbortSignal.timeout(8_000),
    headers: {
      apikey: config.key,
      ...(config.key.startsWith("eyJ") ? { Authorization: `Bearer ${config.key}` } : {}),
    },
  }).catch((error: unknown) => {
    console.warn("Falha ao consultar produto no Supabase; usando fallback local:", error);
    return null;
  });
  if (!response) return fallbackProduct;
  if (!response.ok) {
    query.set("select", `${PRODUCT_COLUMNS},images`);
    response = await fetch(`${config.url}/rest/v1/products?${query}`, {
      next: { revalidate: 300, tags: ["catalog"] },
      signal: AbortSignal.timeout(8_000),
      headers: {
        apikey: config.key,
        ...(config.key.startsWith("eyJ") ? { Authorization: "Bearer " + config.key } : {}),
      },
    }).catch((error: unknown) => {
      console.warn("Falha ao consultar produto no schema legado do Supabase; usando fallback local:", error);
      return null;
    });
  }
  if (!response || !response.ok) {
    return fallbackProduct;
  }
  const rows = await response.json() as unknown[];
  const product = rows.length ? mapProduct(rows[0]) ?? undefined : undefined;
  return product && isMatch(product) ? product : fallbackProduct;
}

export function getBundledRelatedProducts(product: Product): Product[] {
  return bundledCatalog.filter((item) => isPublishedProduct(item) && item.id !== product.id && item.slug !== product.slug &&
    ((product.clubeSlug !== "revisar" && item.clubeSlug === product.clubeSlug) ||
      (product.liga !== "revisar" && item.liga === product.liga))).slice(0, 5);
}
