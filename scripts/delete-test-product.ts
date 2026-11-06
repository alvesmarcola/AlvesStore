import { loadEnvConfig } from "@next/env";
import { getSupabaseOrdersClient } from "@/lib/server/supabase-orders";
import { checkProductOrders, extractStoragePaths } from "@/lib/server/admin-product-deletion";

loadEnvConfig(process.cwd());

export async function runDeleteTestProduct(options?: { confirmar?: boolean; silent?: boolean }) {
  const isConfirm = options?.confirmar ?? process.argv.includes("--confirmar");
  const log = options?.silent ? () => {} : console.log;

  log("======================================================");
  log("  SCRIPT DE REMOÇÃO DO PRODUTO DE TESTE (R$ 1,50)");
  log("======================================================");
  log(`Modo de execução: ${isConfirm ? "🔴 EXECUÇÃO REAL (--confirmar)" : "🟡 SIMULAÇÃO / DRY-RUN (nenhuma alteração será gravada)"}\n`);

  const supabase = getSupabaseOrdersClient();

  // Localiza produtos com slug "teste", nome contendo "teste" ou preço R$ 1,50
  const { data: candidates, error } = await supabase
    .from("products")
    .select("id,yupoo_id,slug,nome,preco,images,created_at")
    .like("yupoo_id", "manual:%");

  if (error) {
    throw new Error(`Falha ao consultar produtos manuais no Supabase: ${error.message}`);
  }

  const testProducts = (candidates ?? []).filter((p) => {
    const slugMatch = p.slug?.toLowerCase() === "teste";
    const nameMatch = p.nome?.toLowerCase().includes("teste");
    const priceMatch = Number(p.preco) === 1.5;
    return slugMatch || nameMatch || priceMatch;
  });

  if (testProducts.length === 0) {
    log("Nenhum produto manual de teste correspondente (slug 'teste', nome 'teste' ou R$ 1,50) foi encontrado no Supabase.");
    return { found: 0, deleted: false };
  }

  log(`Foram encontrados ${testProducts.length} produto(s) manual(is) de teste:\n`);

  for (const product of testProducts) {
    log(`------------------------------------------------------`);
    log(`ID:      ${product.id}`);
    log(`Yupoo:   ${product.yupoo_id}`);
    log(`Nome:    ${product.nome}`);
    log(`Slug:    ${product.slug}`);
    log(`Preço:   R$ ${Number(product.preco).toFixed(2)}`);

    const storagePaths = extractStoragePaths(product.images);
    log(`Fotos no Storage (${storagePaths.length}):`);
    for (const p of storagePaths) {
      log(`  - ${p}`);
    }

    // Consulta de pedidos vinculados
    const orderCount = await checkProductOrders(supabase, product.id, product.slug);
    log(`Pedidos vinculados em store_orders: ${orderCount}`);

    if (orderCount > 0) {
      log(`⚠️  ATENÇÃO: Este produto possui ${orderCount} pedido(s) associado(s).`);
      log(`   Os pedidos existentes guardam o snapshot completo (nome, preço, tamanho) e continuarão intactos no histórico.`);
    }

    if (!isConfirm) {
      log("\n[DRY-RUN] Nenhuma exclusão foi realizada.");
      log("Para confirmar e executar a remoção deste produto e suas fotos, execute:");
      log("  npx tsx scripts/delete-test-product.ts --confirmar\n");
      return { found: testProducts.length, deleted: false, dryRun: true };
    }

    // Execução real
    log("\nExecutando exclusão...");

    // 1. Remover fotos do Storage
    if (storagePaths.length > 0) {
      log(`Removendo ${storagePaths.length} foto(s) do bucket 'produtos'...`);
      const { error: storageErr } = await supabase.storage.from("produtos").remove(storagePaths);
      if (storageErr) {
        log(`Aviso ao remover fotos do Storage: ${storageErr.message}`);
      } else {
        log(`✓ Fotos removidas do Storage.`);
      }
    }

    // 2. Remover fornecedor
    await supabase.from("admin_product_supplier_details").delete().eq("product_id", product.id);

    // 3. Remover produto
    const { error: deleteErr } = await supabase.from("products").delete().eq("id", product.id);
    if (deleteErr) {
      throw new Error(`Erro ao deletar produto do Supabase: ${deleteErr.message}`);
    }
    log(`✓ Produto "${product.nome}" (${product.id}) removido da tabela products.`);

    // 4. Log de auditoria
    try {
      await supabase.from("admin_audit_log").insert({
        acao: "script_excluir_produto_teste",
        entidade: "products",
        entidade_id: product.id,
        resumo: {
          nome: product.nome,
          slug: product.slug,
          preco: product.preco,
          pedidos_vinculados: orderCount,
          fotos_removidas: storagePaths,
          executado_por: "script_delete_test_product",
        },
      });
      log(`✓ Log registrado na tabela admin_audit_log.`);
    } catch (auditErr) {
      log(`Aviso ao registrar log de auditoria: ${(auditErr as Error).message}`);
    }

    log(`\n🎉 Exclusão concluída com sucesso! O produto foi apagado e o histórico de pedidos foi preservado.`);
  }

  return { found: testProducts.length, deleted: isConfirm };
}

if (process.argv[1]?.endsWith("delete-test-product.ts")) {
  runDeleteTestProduct().catch((err) => {
    console.error("Erro na execução do script:", err);
    process.exitCode = 1;
  });
}
