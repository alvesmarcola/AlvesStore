import { randomUUID } from "node:crypto";
import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";
import { manualProductSchema, type ManualProductInput } from "@/lib/admin/product-validation";
import { isAuthorizedAdmin } from "@/lib/server/admin-auth";
import { hasBundledProductSlug } from "@/lib/server/supabase-catalog";
import { getSupabaseOrdersClient } from "@/lib/server/supabase-orders";

export const runtime = "nodejs";

const PRODUCT_COLUMNS = "id,yupoo_id,slug,clube,clubeSlug,liga,publico,tipo,temporada,uniforme,nome,preco,tamanhos,cor,imageSeed,images,description,stock_by_size,brand";

function publicImageRecords(imageUrls: string[], productName: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || process.env.SUPABASE_URL?.trim();
  if (!supabaseUrl) throw new Error("SUPABASE_URL não está configurada.");
  const supabaseOrigin = new URL(supabaseUrl).origin;
  return imageUrls.map((imageUrl, index) => {
    const image = new URL(imageUrl);
    if (image.protocol !== "https:" || image.origin !== supabaseOrigin
      || !image.pathname.startsWith("/storage/v1/object/public/produtos/manual/")) {
      throw new Error("As fotos precisam ter sido enviadas pelo painel para o bucket de produtos.");
    }
    return {
      src: image.toString(),
      source: image.toString(),
      alt: `${productName} · foto ${index + 1}`,
      credit: "Resenha Sports Cia",
      focalPoint: { x: 50, y: 50 },
      blurDataURL: "",
    };
  });
}

function productValues(input: ManualProductInput, id: string, imageUrls: string[]) {
  const clubSlug = input.clube.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const stockBySize = Object.fromEntries(input.tamanhos.map((size) => [
    size,
    input.stock_by_size[size] ?? 0,
  ]));
  return {
    id,
    yupoo_id: `manual:${id}`,
    slug: input.slug,
    clube: input.clube,
    clubeSlug: clubSlug || "revisar",
    liga: input.liga,
    publico: input.publico,
    tipo: input.tipo,
    temporada: input.temporada,
    uniforme: input.uniforme,
    nome: input.nome,
    preco: input.preco,
    tamanhos: input.tamanhos,
    cor: input.cor,
    imageSeed: input.nome,
    images: publicImageRecords(imageUrls, input.nome),
    description: input.description,
    stock_by_size: stockBySize,
    brand: input.brand,
    updated_at: new Date().toISOString(),
  };
}

async function saveSupplierDetails(supabase: ReturnType<typeof getSupabaseOrdersClient>, productId: string, input: ManualProductInput) {
  const { error } = await supabase.from("admin_product_supplier_details").upsert({
    product_id: productId,
    supplier_name: input.supplier_name,
    supplier_cost: input.supplier_cost,
    updated_at: new Date().toISOString(),
  }, { onConflict: "product_id" });
  if (error) throw error;
}

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, {
    status,
    headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" },
  });
}

export async function GET(request: Request) {
  if (!isAuthorizedAdmin(request)) return jsonError("Acesso não autorizado.", 401);
  try {
    const { data, error } = await getSupabaseOrdersClient().from("products")
      .select(PRODUCT_COLUMNS)
      .like("yupoo_id", "manual:%")
      .order("nome", { ascending: true })
      .limit(500);
    if (error) throw error;
    const supplierDetails = data?.length
      ? await getSupabaseOrdersClient().from("admin_product_supplier_details")
        .select("product_id,supplier_name,supplier_cost")
        .in("product_id", data.map((product) => product.id))
      : { data: [], error: null };
    if (supplierDetails.error) throw supplierDetails.error;
    const detailsByProduct = new Map((supplierDetails.data ?? []).map((details) => [details.product_id, details]));
    const products = (data ?? []).map((product) => ({
      ...product,
      supplier_name: detailsByProduct.get(product.id)?.supplier_name ?? "",
      supplier_cost: detailsByProduct.get(product.id)?.supplier_cost ?? 0,
    }));
    return NextResponse.json({ products }, {
      headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" },
    });
  } catch (error) {
    console.error("Falha ao carregar produtos manuais:", error instanceof Error ? error.message : "erro desconhecido");
    return jsonError("Não foi possível carregar os produtos. Verifique se as migrações de produtos e gestão administrativa foram aplicadas.", 503);
  }
}

export async function POST(request: Request) {
  if (!isAuthorizedAdmin(request)) return jsonError("Acesso não autorizado.", 401);
  const parsed = manualProductSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Revise os dados do produto e os estoques por tamanho.", 400);
  if (parsed.data.imageUrls.length === 0) return jsonError("Envie pelo menos uma foto antes de cadastrar o produto.", 400);
  if (hasBundledProductSlug(parsed.data.slug)) return jsonError("Esse endereço já pertence a um produto atual da loja. Escolha outro slug.", 409);

  try {
    const supabase = getSupabaseOrdersClient();
    const id = randomUUID();
    const values = productValues(parsed.data, id, parsed.data.imageUrls);
    const { data, error } = await supabase.from("products")
      .insert(values)
      .select(PRODUCT_COLUMNS)
      .single();
    if (error) throw error;
    await saveSupplierDetails(supabase, id, parsed.data);
    revalidateTag("catalog");
    return NextResponse.json({ product: { ...data, supplier_name: parsed.data.supplier_name, supplier_cost: parsed.data.supplier_cost } }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const code = typeof error === "object" && error !== null && "code" in error
      ? String(error.code) : "";
    if (code === "23505") return jsonError("Já existe um produto com esse endereço (slug). Escolha outro.", 409);
    console.error("Falha ao cadastrar produto manual:", error instanceof Error ? error.message : "erro desconhecido");
    return jsonError("Não foi possível cadastrar o produto. Confirme se as migrações de produtos e gestão administrativa foram aplicadas.", 503);
  }
}

export async function PATCH(request: Request) {
  if (!isAuthorizedAdmin(request)) return jsonError("Acesso não autorizado.", 401);
  const parsed = manualProductSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success || !parsed.data.id) return jsonError("Revise os dados do produto que deseja atualizar.", 400);
  if (hasBundledProductSlug(parsed.data.slug)) return jsonError("Esse endereço já pertence a um produto atual da loja. Escolha outro slug.", 409);

  try {
    const supabase = getSupabaseOrdersClient();
    const existing = await supabase.from("products")
      .select("id,yupoo_id,images")
      .eq("id", parsed.data.id)
      .maybeSingle();
    if (existing.error) throw existing.error;
    if (!existing.data || !existing.data.yupoo_id.startsWith("manual:")) {
      return jsonError("Produto manual não encontrado.", 404);
    }
    const existingImages = Array.isArray(existing.data.images) ? existing.data.images : [];
    if (existingImages.length + parsed.data.imageUrls.length > 6) {
      return jsonError("Cada produto pode ter no máximo 6 fotos.", 400);
    }

    const addedImages = publicImageRecords(parsed.data.imageUrls, parsed.data.nome);
    const stockBySize = Object.fromEntries(parsed.data.tamanhos.map((size) => [
      size,
      parsed.data.stock_by_size[size] ?? 0,
    ]));
    const { data, error } = await supabase.from("products")
      .update({
        slug: parsed.data.slug,
        clube: parsed.data.clube,
        clubeSlug: parsed.data.clube.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
          .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
        liga: parsed.data.liga,
        publico: parsed.data.publico,
        tipo: parsed.data.tipo,
        temporada: parsed.data.temporada,
        uniforme: parsed.data.uniforme,
        nome: parsed.data.nome,
        preco: parsed.data.preco,
        tamanhos: parsed.data.tamanhos,
        cor: parsed.data.cor,
        imageSeed: parsed.data.nome,
        images: [...existingImages, ...addedImages],
        description: parsed.data.description,
        stock_by_size: stockBySize,
        brand: parsed.data.brand,
        updated_at: new Date().toISOString(),
      })
      .eq("id", parsed.data.id)
      .select(PRODUCT_COLUMNS)
      .single();
    if (error) throw error;
    await saveSupplierDetails(supabase, parsed.data.id, parsed.data);
    revalidateTag("catalog");
    return NextResponse.json({ product: { ...data, supplier_name: parsed.data.supplier_name, supplier_cost: parsed.data.supplier_cost } }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const code = typeof error === "object" && error !== null && "code" in error
      ? String(error.code) : "";
    if (code === "23505") return jsonError("Já existe um produto com esse endereço (slug). Escolha outro.", 409);
    console.error("Falha ao atualizar produto manual:", error instanceof Error ? error.message : "erro desconhecido");
    return jsonError("Não foi possível atualizar o produto. Confirme se as migrações de produtos e gestão administrativa foram aplicadas.", 503);
  }
}
