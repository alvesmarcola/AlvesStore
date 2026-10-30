import { readFileSync, writeFileSync } from "node:fs";

type Product = {
  id: string;
  slug: string;
  nome: string;
  title?: string;
  tags?: string[];
  imageSeed?: string;
  tipo: string;
};

const SIGNALS: { key: string; regex: RegExp; version: string }[] = [
  { key: "jogador/player/authentic/match", regex: /\b(jogador|player|authentic|match)\b/i, version: "jogador" },
  { key: "retrô/retro/vintage", regex: /\b(retro|retrô|vintage)\b/i, version: "retro" },
  { key: "manga longa/long sleeve", regex: /\b(manga longa|long sleeve)\b/i, version: "torcedor (manga longa)" },
  { key: "full patch/patches", regex: /\b(full ?patch|patches)\b/i, version: "full-patch" },
  { key: "infantil/kids", regex: /\b(infantil|kids|kid|junior|youth|children)\b/i, version: "infantil" },
  { key: "feminina/women", regex: /\b(feminin|women|female|mulher)\b/i, version: "feminino" },
  { key: "fórmula 1/F1", regex: /\b(f1|formula ?1|formula ?one)\b/i, version: "f1" },
  { key: "goleiro/goalkeeper", regex: /\b(goleiro|goalkeeper|keeper|\bgk\b)\b/i, version: "goleiro" },
];

function normalize(value: unknown) {
  return String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");
}

function signalsFor(product: Product) {
  const text = normalize([product.nome, product.title, product.slug, ...(product.tags ?? []), product.imageSeed].join(" "));
  const found: { key: string; version: string }[] = [];
  for (const signal of SIGNALS) {
    if (signal.regex.test(text)) found.push({ key: signal.key, version: signal.version });
  }
  return found;
}

function isDryRun() { return !process.argv.includes("--apply"); }
function wantsSupabase() { return process.argv.includes("--supabase"); }
function wantsGenerateSql() { return process.argv.includes("--generate-sql"); }

async function fetchSupabaseRevisar() {
  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim().replace(/\/$/, "");
  const key = (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "").trim();
  if (!url || !key) throw new Error("Supabase env vars ausentes.");
  const rows: any[] = [];
  let offset = 0;
  while (true) {
    const q = new URLSearchParams({ select: "id,nome,slug,imageSeed,tipo", tipo: "eq.revisar", limit: "1000", offset: String(offset) });
    const r = await fetch(`${url}/rest/v1/products?${q}`, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
    const data = await r.json();
    if (!Array.isArray(data)) throw new Error("Resposta inválida do Supabase.");
    rows.push(...data);
    if (data.length < 1000) break;
    offset += 1000;
  }
  return rows;
}

async function main() {
  const dryRun = isDryRun();
  console.log(`Modo: ${dryRun ? "DRY-RUN (simulação)" : "APLICAR"}`);
  console.log("");

  const products = JSON.parse(readFileSync("data/products.json", "utf8"));
  const revisarProducts = products.filter((p: any) => p.tipo === "revisar");

  const toTorcedor: any[] = [];
  const exceptions: { product: any; signals: { key: string; version: string }[] }[] = [];

  for (const product of revisarProducts) {
    const found = signalsFor(product);
    if (found.length === 0) toTorcedor.push(product);
    else exceptions.push({ product, signals: found });
  }

  console.log("=== data/products.json ===");
  console.log(`total produtos: ${products.length}`);
  console.log(`tipo "revisar": ${revisarProducts.length}`);
  console.log(`-> reclassificar como torcedor: ${toTorcedor.length}`);
  console.log(`-> exceções (manter revisar): ${exceptions.length}`);
  console.log("");
  console.log("=== EXCEÇÕES (lista completa) ===");
  for (const { product, signals } of exceptions) {
    console.log(`${product.id} | ${product.nome} | sinais: ${signals.map((s) => s.key).join(", ")} | versão provável: ${signals.map((s) => s.version).join(" + ")}`);
  }

  if (!dryRun) {
    const approvedIds = new Set(toTorcedor.map((p: any) => p.id));
    for (const product of products) {
      if (approvedIds.has(product.id)) product.tipo = "torcedor";
    }
    writeFileSync("data/products.json", JSON.stringify(products, null, 2) + "\n", "utf8");
    console.log(`\nAplicado em data/products.json: ${toTorcedor.length} produtos reclassificados.`);
  }


  if (wantsSupabase()) {
    console.log("\n=== Supabase ===");
    const sbProducts = await fetchSupabaseRevisar();
    const sbToTorcedor: any[] = [];
    const sbExceptions: { product: any; signals: { key: string; version: string }[] }[] = [];
    for (const product of sbProducts) {
      const found = signalsFor(product as any);
      if (found.length === 0) sbToTorcedor.push(product);
      else sbExceptions.push({ product, signals: found });
    }
    console.log(`tipo "revisar" no Supabase: ${sbProducts.length}`);
    console.log(`-> reclassificar como torcedor: ${sbToTorcedor.length}`);
    console.log(`-> exceções (manter revisar): ${sbExceptions.length}`);
    console.log("");
    console.log("=== EXCEÇÕES no Supabase (lista completa) ===");
    for (const { product, signals } of sbExceptions) {
      console.log(`${product.id} | ${product.nome} | sinais: ${signals.map((s) => s.key).join(", ")} | versão provável: ${signals.map((s) => s.version).join(" + ")}`);
    }

    if (wantsGenerateSql() && !dryRun) {
      const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
      const approvedIds = sbToTorcedor.map((p: any) => p.id);
      const sql = `-- Reclassificação de produtos tipo 'revisar' -> 'torcedor'\n-- Gerado por scripts/reclassificar-revisar.ts\n-- Apenas produtos sem sinal de outra versão.\n\n-- Backup da coluna tipo (executar antes)\nCREATE TABLE IF NOT EXISTS products_tipo_backup_${date} AS\nSELECT id, tipo FROM products WHERE tipo = 'revisar';\n\n-- Contagem antes\nSELECT tipo, COUNT(*) AS total FROM products WHERE tipo = 'revisar' GROUP BY tipo;\n\n-- Reclassificação (apenas aprovados)\nUPDATE products\nSET tipo = 'torcedor'\nWHERE tipo = 'revisar'\n  AND id IN (\n    ${approvedIds.map((id: string) => `'${id.replace(/'/g, "''")}'`).join(",\n    ")}\n  );\n\n-- Contagem depois\nSELECT tipo, COUNT(*) AS total FROM products WHERE tipo IN ('revisar', 'torcedor') GROUP BY tipo;\n`;
      const path = `supabase/migrations/${date}_reclassificar_revisar.sql`;
      writeFileSync(path, sql, "utf8");
      console.log(`\nSQL gerado em: ${path} (${approvedIds.length} ids)`);
    }
  }
}

main().catch((error) => {
  console.error("Erro:", error);
  process.exitCode = 1;
});
