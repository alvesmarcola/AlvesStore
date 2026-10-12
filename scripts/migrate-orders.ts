import { readFile } from "node:fs/promises";
import path from "node:path";
import { getDatabasePool } from "../lib/server/database";

async function main() {
  const pool = getDatabasePool();
  try {
    const migration = await readFile(path.join(process.cwd(), "db", "migrations", "001_store_orders.sql"), "utf8");
    for (const statement of migration.split(";").map((part) => part.trim()).filter(Boolean)) {
      await pool.query(statement);
    }
    console.log("Migração 001_store_orders aplicada.");
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error("Falha ao preparar as tabelas de pedidos:", error instanceof Error ? error.message : "erro desconhecido");
  process.exitCode = 1;
});
