import { randomUUID } from "node:crypto";
import { revalidateTag } from "next/cache";
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
    tem_variacao_uniforme: Boolean(input.tem_variacao_uniforme),
    oculto: Boolean(input.oculto),
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
    const parsedId = z.string().uuid().safeParse(checkId);
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
        tem_variacao_uniforme: Boolean(parsed.data.tem_variacao_uniforme),
        oculto: Boolean(parsed.data.oculto),
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
    if (orderCount > 0) {
      return NextResponse.json(
        {
          error: `Este produto possui ${orderCount} pedido(s) associado(s) e não pode ser apagado para preservar o histórico financeiro. Em vez de excluir, use a opção "Ocultar" para tirá-lo do site sem perder o histórico.`,
          orderCount,
          canHide: true,
        },
        { status: 409, headers: ADMIN_PRIVATE_HEADERS }
      );
    }

    // 1. Remover fotos do Storage (apenas dentro de manual/ no bucket produtos)
    const storagePaths = extractStoragePaths(existing.data.images);
    if (storagePaths.length > 0) {
      try {
        await supabase.storage.from("produtos").remove(storagePaths);
      } catch (storageErr) {
        console.error("Erro ao remover fotos do Storage:", storageErr);
      }
    }

    // 2. Remover fornecedor
    await supabase.from("admin_product_supplier_details").delete().eq("product_id", productId);

    // 3. Remover produto
    const { error: deleteError } = await supabase.from("products").delete().eq("id", productId);
    if (deleteError) throw deleteError;

    // 4. Log de auditoria
    try {
      await supabase.from("admin_audit_log").insert({
        acao: "produto_excluido",
        entidade: "products",
        entidade_id: productId,
        resumo: {
          nome: existing.data.nome,
          slug: existing.data.slug,
          preco: existing.data.preco,
          fotos_removidas: storagePaths,
        },
      });
    } catch (auditErr) {
      console.warn("Falha ao registrar auditoria de exclusão de produto:", auditErr);
    }

    // 5. Invalidação de cache
    revalidateTag("catalog");

    return NextResponse.json(
      {
        deleted: true,
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
