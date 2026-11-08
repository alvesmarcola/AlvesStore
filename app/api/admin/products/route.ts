import { randomUUID } from "node:crypto";
import { revalidateTag, revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";
import { manualProductSchema, type ManualProductInput } from "@/lib/admin/product-validation";
import { ADMIN_PRIVATE_HEADERS, getAdminAuthFailure } from "@/lib/server/admin-auth";
import { checkProductOrders, extractStoragePaths } from "@/lib/server/admin-product-deletion";
import { hasBundledProductSlug } from "@/lib/server/supabase-catalog";
import {
  describeSupabaseError,
  getSupabaseOrdersClient,
  SupabaseOrdersConfigurationError,
} from "@/lib/server/supabase-orders";
import { SITE_NAME } from "@/lib/site";

export const runtime = "nodejs";

const PRODUCT_COLUMNS = "id,yupoo_id,slug,clube,clubeSlug,liga,publico,tipo,temporada,uniforme,nome,preco,tamanhos,cor,imageSeed,images,description,stock_by_size,brand,tem_variacao_uniforme,oculto";

interface ProductImage {
  src: string;
  source?: string;
  alt?: string;
  credit?: string;
  focalPoint?: { x: number; y: number };
  blurDataURL?: string;
  [key: string]: unknown;
}

function publicImageRecords(imageUrls: string[], productName: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || process.env.SUPABASE_URL?.trim();
  if (!supabaseUrl) throw new Error("SUPABASE_URL não está configurada.");
  const supabaseOrigin = new URL(supabaseUrl).origin;
  return imageUrls.map((imageUrl, index) => {
    const image = new URL(imageUrl);
    const isSupabaseStorage = image.protocol === "https:" && image.origin === supabaseOrigin
      && image.pathname.startsWith("/storage/v1/object/public/produtos/");
    const isYupooProxy = image.pathname.startsWith("/api/yupoo-image") || image.hostname.includes("yupoo.com");
    if (!isSupabaseStorage && !isYupooProxy) {
      throw new Error("As fotos precisam ter sido enviadas pelo painel para o bucket de produtos.");
    }
    return {
      src: image.toString(),
      source: image.toString(),
      alt: `${productName} · foto ${index + 1}`,
      credit: SITE_NAME,
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
  const images = Array.isArray(input.images) && input.images.length > 0
    ? input.images.map((img, idx) => ({
        src: img.src,
        source: img.source || img.src,
        alt: img.alt || `${input.nome} · foto ${idx + 1}`,
        credit: img.credit || SITE_NAME,
        focalPoint: img.focalPoint || { x: 50, y: 50 },
        blurDataURL: img.blurDataURL || "",
      }))
    : publicImageRecords(imageUrls, input.nome);

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
    images,
    description: input.description,
    stock_by_size: stockBySize,
    brand: input.brand,
    tem_variacao_uniforme: Boolean(input.tem_variacao_uniforme),
    oculto: Boolean(input.oculto) || images.length === 0,
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
    headers: ADMIN_PRIVATE_HEADERS,
  });
}

function reportFailure(operation: string, error: unknown) {
  console.error(operation, describeSupabaseError(error));
  return error instanceof SupabaseOrdersConfigurationError
    ? "Supabase não configurado neste ambiente. Verifique as variáveis de ambiente do servidor."
    : undefined;
}

export async function GET(request: Request) {
  const authFailure = getAdminAuthFailure(request);
  if (authFailure) return jsonError(authFailure.message, authFailure.status);

  const url = new URL(request.url);
  const checkId = url.searchParams.get("check_orders");
  if (checkId) {
    const parsedId = z.string().trim().min(1).max(100).safeParse(checkId);
    if (!parsedId.success) return jsonError("ID de produto inválido.", 400);
    try {
      const supabase = getSupabaseOrdersClient();
      const prod = await supabase.from("products").select("id, slug").eq("id", checkId).maybeSingle();
      if (prod.error) throw prod.error;
      if (!prod.data) return jsonError("Produto não encontrado.", 404);
      const orderCount = await checkProductOrders(supabase, prod.data.id, prod.data.slug);
      return NextResponse.json({ orderCount }, { headers: ADMIN_PRIVATE_HEADERS });
    } catch (error) {
      const configurationError = reportFailure("Falha ao checar pedidos do produto:", error);
      return jsonError(configurationError ?? "Não foi possível verificar os pedidos do produto.", 500);
    }
  }

  try {
    const searchQuery = url.searchParams.get("q")?.trim();
    const supabase = getSupabaseOrdersClient();
    let query = supabase.from("products").select("*");

    if (searchQuery) {
      query = query.or(`nome.ilike.%${searchQuery}%,slug.ilike.%${searchQuery}%,id.eq.${searchQuery}`).limit(100);
    } else {
      query = query.or("yupoo_id.like.manual:*,preco.gt.0").order("nome", { ascending: true }).limit(500);
    }

    const { data, error } = await query;
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
      headers: ADMIN_PRIVATE_HEADERS,
    });
  } catch (error) {
    const configurationError = reportFailure("Falha ao carregar produtos manuais:", error);
    return jsonError(configurationError ?? "Não foi possível carregar os produtos. Verifique se as migrações de produtos e gestão administrativa foram aplicadas.", 503);
  }
}

export async function POST(request: Request) {
  const authFailure = getAdminAuthFailure(request);
  if (authFailure) return jsonError(authFailure.message, authFailure.status);
  const parsed = manualProductSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Revise os dados do produto e os estoques por tamanho.", 400);
  if (parsed.data.imageUrls.length === 0 && (!parsed.data.images || parsed.data.images.length === 0)) {
    return jsonError("Envie pelo menos uma foto antes de cadastrar o produto.", 400);
  }
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
    return NextResponse.json({ product: { ...data, supplier_name: parsed.data.supplier_name, supplier_cost: parsed.data.supplier_cost } }, { status: 201, headers: ADMIN_PRIVATE_HEADERS });
  } catch (error) {
    const configurationError = reportFailure("Falha ao cadastrar produto manual:", error);
    const code = typeof error === "object" && error !== null && "code" in error
      ? String(error.code) : "";
    if (code === "23505") return jsonError("Já existe um produto com esse endereço (slug). Escolha outro.", 409);
    return jsonError(configurationError ?? "Não foi possível cadastrar o produto. Confirme se as migrações de produtos e gestão administrativa foram aplicadas.", 503);
  }
}

export async function PATCH(request: Request) {
  const authFailure = getAdminAuthFailure(request);
  if (authFailure) return jsonError(authFailure.message, authFailure.status);
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
    if (!existing.data) {
      return jsonError("Produto não encontrado.", 404);
    }
    let finalImages: ProductImage[] = [];
    if (Array.isArray(parsed.data.images)) {
      finalImages = parsed.data.images.map((img, idx) => ({
        src: img.src,
        source: img.source || img.src,
        alt: img.alt || `${parsed.data.nome} · foto ${idx + 1}`,
        credit: img.credit || SITE_NAME,
        focalPoint: img.focalPoint || { x: 50, y: 50 },
        blurDataURL: img.blurDataURL || "",
      }));
    } else {
      finalImages = Array.isArray(existing.data.images) ? existing.data.images : [];
    }

    if (parsed.data.imageUrls && parsed.data.imageUrls.length > 0) {
      const addedImages = publicImageRecords(parsed.data.imageUrls, parsed.data.nome);
      finalImages = [...finalImages, ...addedImages];
    }

    if (finalImages.length > 6) {
      return jsonError("Cada produto pode ter no máximo 6 fotos.", 400);
    }

    // Se o produto ficar sem nenhuma foto limpa, oculte-o em vez de deixar o card vazio
    const isOculto = Boolean(parsed.data.oculto) || finalImages.length === 0;

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
        images: finalImages,
        description: parsed.data.description,
        stock_by_size: stockBySize,
        brand: parsed.data.brand,
        tem_variacao_uniforme: Boolean(parsed.data.tem_variacao_uniforme),
        oculto: isOculto,
        updated_at: new Date().toISOString(),
      })
      .eq("id", parsed.data.id)
      .select(PRODUCT_COLUMNS)
      .single();
    if (error) throw error;
    await saveSupplierDetails(supabase, parsed.data.id, parsed.data);
    revalidateTag("catalog");
    return NextResponse.json({ product: { ...data, supplier_name: parsed.data.supplier_name, supplier_cost: parsed.data.supplier_cost } }, { headers: ADMIN_PRIVATE_HEADERS });
  } catch (error) {
    const configurationError = reportFailure("Falha ao atualizar produto manual:", error);
    const code = typeof error === "object" && error !== null && "code" in error
      ? String(error.code) : "";
    if (code === "23505") return jsonError("Já existe um produto com esse endereço (slug). Escolha outro.", 409);
    if (configurationError) return jsonError(configurationError, 503);
    return jsonError("Não foi possível atualizar o produto. Confirme se as migrações de produtos e gestão administrativa foram aplicadas.", 503);
  }
}

const deleteSchema = z.object({
  id: z.string().uuid("ID de produto inválido."),
});

export async function DELETE(request: Request) {
  const authFailure = getAdminAuthFailure(request);
  if (authFailure) return jsonError(authFailure.message, authFailure.status);

  let idToValidate: unknown;
  const url = new URL(request.url);
  const searchId = url.searchParams.get("id");
  if (searchId) {
    idToValidate = searchId;
  } else {
    try {
      const body = await request.json();
      idToValidate = body?.id;
    } catch {
      // corpo vazio ou sem json
    }
  }

  const parsed = deleteSchema.safeParse({ id: idToValidate });
  if (!parsed.success) {
    return jsonError("ID de produto inválido.", 400);
  }

  const productId = parsed.data.id;

  try {
    const supabase = getSupabaseOrdersClient();
    const existing = await supabase
      .from("products")
      .select("id,yupoo_id,nome,slug,preco,images")
      .eq("id", productId)
      .maybeSingle();

    if (existing.error) throw existing.error;
    if (!existing.data) {
      return jsonError("Produto não encontrado.", 404);
    }

    if (!existing.data.yupoo_id.startsWith("manual:")) {
      return jsonError("Apenas produtos manuais cadastrados no banco podem ser excluídos pelo painel.", 400);
    }

    const orderCount = await checkProductOrders(supabase, existing.data.id, existing.data.slug);

    // Fotos usadas por outras linhas de products nao podem ser apagadas.
    const allProductsResult = await supabase.from("products").select("id, images");
    const usedByOthers = new Set<string>();
    if (!allProductsResult.error && Array.isArray(allProductsResult.data)) {
      for (const row of allProductsResult.data) {
        if (row.id === productId) continue;
        for (const path of extractStoragePaths(row.images)) usedByOthers.add(path);
      }
    } else if (allProductsResult.error) {
      console.warn("Falha ao verificar reuso de imagens; nenhuma foto sera removida por seguranca.", allProductsResult.error);
    }
    const candidatePaths = extractStoragePaths(existing.data.images);
    const storagePaths = candidatePaths.filter((path) => !usedByOthers.has(path));

    // 1. Remover fotos do Storage (apenas dentro de manual/ no bucket produtos)
    if (storagePaths.length > 0) {
      try {
        await supabase.storage.from("produtos").remove(storagePaths);
      } catch (storageErr) {
        console.error("Erro ao remover fotos do Storage:", storageErr);
      }
    }

    // 2. Remover fornecedor
    await supabase.from("admin_product_supplier_details").delete().eq("product_id", productId);

    // 3. Remover produto (exclusao real)
    const { error: deleteError } = await supabase.from("products").delete().eq("id", productId);
    if (deleteError) throw deleteError;

    // 4. Log de auditoria (opcional: se a tabela nao existir, apenas avisa)
    try {
      await supabase.from("admin_audit_log").insert({
        acao: "produto_excluido",
        entidade: "products",
        entidade_id: productId,
        resumo: {
          nome: existing.data.nome,
          slug: existing.data.slug,
          preco: existing.data.preco,
          pedidos_vinculados: orderCount,
          fotos_removidas: storagePaths,
        },
      });
    } catch (auditErr) {
      console.warn("Falha ao registrar auditoria de exclusao de produto:", auditErr);
    }

    // 5. Invalidacao de cache
    revalidateTag("catalog");
    revalidatePath("/");
    revalidatePath(`/produto/${existing.data.slug}`);
    revalidatePath("/ligas");
    revalidatePath("/ligas/[slug]", "page");
    revalidatePath("/sitemap.xml");

    return NextResponse.json(
      {
        deleted: true,
        orderCount,
        message: `Produto "${existing.data.nome}" excluído com sucesso.`,
      },
      { headers: ADMIN_PRIVATE_HEADERS }
    );
  } catch (error) {
    const configurationError = reportFailure("Falha ao excluir produto manual:", error);
    if (configurationError) return jsonError(configurationError, 503);
    return jsonError("Não foi possível excluir o produto. Tente novamente mais tarde.", 500);
  }
}
