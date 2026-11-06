import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "").trim().replace(/\/$/, "");
const supabaseKey = (
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SECRET_KEY ||
  process.env.SUPABASE_SERVICE_KEY ||
  process.env.SUPABASE_ROLE_KEY ||
  ""
).trim();

if (!supabaseUrl || !supabaseKey) {
  console.error("Credenciais do Supabase nao encontradas no .env.local.");
  process.exit(1);
}

const headers: Record<string, string> = {
  apikey: supabaseKey,
  Authorization: `Bearer ${supabaseKey}`,
};

async function get(path: string): Promise<{ status: number; body: any; text: string }> {
  const response = await fetch(`${supabaseUrl}${path}`, { method: "GET", headers });
  const text = await response.text();
  let body: any = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { status: response.status, body, text };
}

async function columnExists(table: string, column: string): Promise<boolean> {
  const result = await get(`/rest/v1/${table}?select=${encodeURIComponent(column)}&limit=1`);
  return result.status === 200;
}

async function tableExists(table: string): Promise<boolean> {
  const result = await get(`/rest/v1/${table}?limit=1`);
  return result.status === 200;
}

async function main() {
  console.log("=== VERIFICACAO REMOTA DE MIGRACOES (somente GET) ===");
  console.log(`URL: ${supabaseUrl}`);
  console.log("");

  const openApi = await get("/rest/v1/");
  const rpcNames = new Set<string>();
  const tableNames = new Set<string>();
  if (openApi.status === 200 && openApi.body && typeof openApi.body === "object") {
    const paths = (openApi.body as { paths?: Record<string, unknown> }).paths || {};
    for (const path of Object.keys(paths)) {
      const match = path.match(/^\/([A-Za-z0-9_]+)$/);
      if (match) tableNames.add(match[1]);
      const rpcMatch = path.match(/^\/rpc\/([A-Za-z0-9_]+)$/);
      if (rpcMatch) rpcNames.add(rpcMatch[1]);
    }
  }
  console.log(`PostgREST OpenAPI: status ${openApi.status}`);
  console.log(`Tabelas/views expostas: ${tableNames.size}`);
  console.log(`Funcoes (rpc) expostas: ${rpcNames.size} (${[...rpcNames].join(", ") || "nenhuma"})`);
  console.log("");

  const productCols = ["description", "stock_by_size", "brand", "tem_variacao_uniforme", "oculto"];
  const storeOrderCols = [
    "mercado_pago_status", "mercado_pago_id", "paid_notified_at", "operational_status",
    "supplier_name", "supplier_status", "supplier_ordered_at", "supplier_cost_cents",
    "shipping_cost_cents", "other_expenses_cents", "internal_notes", "tracking_url",
    "shipped_at", "payment_method_id", "payment_type_id", "payment_reconciliation_attempts",
    "payment_reconciliation_after", "promo", "valor_desconto",
  ];
  const avaliacaoCols = ["status", "moderated_at", "moderated_by", "produto"];

  const productColStatus: Record<string, boolean> = {};
  for (const col of productCols) productColStatus[col] = await columnExists("products", col);
  const storeOrderColStatus: Record<string, boolean> = {};
  for (const col of storeOrderCols) storeOrderColStatus[col] = await columnExists("store_orders", col);
  const avaliacaoColStatus: Record<string, boolean> = {};
  for (const col of avaliacaoCols) avaliacaoColStatus[col] = await columnExists("avaliacoes", col);

  const tablesToCheck = [
    "store_orders", "store_order_payments", "admin_product_supplier_details",
    "store_order_notification_outbox", "payment_events", "admin_audit_log",
  ];
  const tableStatus: Record<string, boolean> = {};
  for (const t of tablesToCheck) tableStatus[t] = await tableExists(t);

  const viewsToCheck = ["store_order_admin_metrics", "approved_review_summary"];
  const viewStatus: Record<string, boolean> = {};
  for (const v of viewsToCheck) viewStatus[v] = await tableExists(v);

  function summarizeMigration(name: string, required: { columns?: string[]; tables?: string[]; views?: string[]; rpcs?: string[] }, note?: string) {
    const cols = (required.columns || []).map((c) => {
      const [table, col] = c.split(".");
      if (table === "products") return productColStatus[col];
      if (table === "store_orders") return storeOrderColStatus[col];
      if (table === "avaliacoes") return avaliacaoColStatus[col];
      return false;
    });
    const tbls = (required.tables || []).map((t) => tableStatus[t] ?? tableNames.has(t));
    const vws = (required.views || []).map((v) => viewStatus[v] ?? tableNames.has(v));
    const rpcs = (required.rpcs || []).map((r) => rpcNames.has(r));
    const allChecks = [...cols, ...tbls, ...vws, ...rpcs];
    let state = "nao aplicada";
    if (allChecks.length > 0) {
      const okCount = allChecks.filter(Boolean).length;
      if (okCount === allChecks.length) state = "aplicada";
      else if (okCount > 0) state = "parcialmente aplicada";
      else state = "nao aplicada";
    }
    console.log(`### ${name}`);
    console.log(`Estado (por evidencia GET): ${state}`);
    if (required.columns?.length) console.log(`  Colunas: ${required.columns.map((c) => `${c}=${cols[required.columns!.indexOf(c)] ? "OK" : "FALTA"}`).join(", ")}`);
    if (required.tables?.length) console.log(`  Tabelas: ${required.tables.map((t) => `${t}=${tbls[required.tables!.indexOf(t)] ? "OK" : "FALTA"}`).join(", ")}`);
    if (required.views?.length) console.log(`  Views: ${required.views.map((v) => `${v}=${vws[required.views!.indexOf(v)] ? "OK" : "FALTA"}`).join(", ")}`);
    if (required.rpcs?.length) console.log(`  Funcoes: ${required.rpcs.map((r) => `${r}=${rpcs[required.rpcs!.indexOf(r)] ? "OK" : "FALTA"}`).join(", ")}`);
    if (note) console.log(`  Obs: ${note}`);
    console.log("");
  }

  summarizeMigration("20261017000000_store_orders.sql", { tables: ["store_orders", "store_order_payments"], rpcs: ["prepare_store_order", "apply_store_payment", "find_store_order_for_tracking"] }, "Constraints CHECK de status e definicao original de apply_store_payment nao sao verificaveis via GET.");
  summarizeMigration("20261018000000_mercado_pago_order_fields.sql", { columns: ["store_orders.mercado_pago_status", "store_orders.mercado_pago_id"] });
  summarizeMigration("20261019000000_order_paid_notice.sql", { columns: ["store_orders.paid_notified_at"] });
  summarizeMigration("20261103000000_post_sale_order_status.sql", { rpcs: ["apply_store_payment"] }, "Reescreve apply_store_payment e constraint store_orders_status_check; versao exata nao verificavel via GET.");
  summarizeMigration("20261103000001_manual_product_fields.sql", { columns: ["products.description", "products.stock_by_size"] }, "Constraint products_tipo_check e products_stock_by_size_object_check nao verificaveis via GET.");
  summarizeMigration("20261103000002_order_operations_finance.sql", { columns: ["store_orders.operational_status", "store_orders.supplier_name", "products.brand"], tables: ["admin_product_supplier_details"] });
  summarizeMigration("20261103000003_review_moderation.sql", { columns: ["avaliacoes.status", "avaliacoes.moderated_at", "avaliacoes.moderated_by", "avaliacoes.produto"], views: ["approved_review_summary"] });
  summarizeMigration("20261104000000_mercado_pago_reliability.sql", { columns: ["store_orders.payment_reconciliation_attempts", "store_orders.payment_reconciliation_after"], tables: ["store_order_notification_outbox"], rpcs: ["claim_store_order_notifications"] });
  summarizeMigration("20261105000000_black_friday_nba.sql", { columns: ["store_orders.promo", "store_orders.valor_desconto"], views: ["store_order_admin_metrics"] });
  summarizeMigration("20261105000001_product_uniform_variation.sql", { columns: ["products.tem_variacao_uniforme"] });
  summarizeMigration("20261105000002_payment_events_and_reconciliation.sql", { columns: ["products.oculto"], tables: ["payment_events"] }, "Reescreve apply_store_payment e constraints de status/operational_status; versao exata nao verificavel via GET.");
  summarizeMigration("20261105000003_admin_product_deletion_and_audit.sql", { tables: ["admin_audit_log"], rpcs: ["count_product_orders"] });

  console.log("=== FIM ===");
}

main().catch((error) => {
  console.error("Falha na verificacao remota:", error instanceof Error ? error.message : error);
  process.exit(1);
});
