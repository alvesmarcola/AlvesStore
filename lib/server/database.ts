import { Pool } from "@neondatabase/serverless";

const globalForDatabase = globalThis as typeof globalThis & { alvesStorePool?: Pool };

export function getDatabasePool() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL não está configurada.");

  if (!globalForDatabase.alvesStorePool) {
    globalForDatabase.alvesStorePool = new Pool({
      connectionString,
      max: 1,
      connectionTimeoutMillis: 8_000,
    });
  }

  return globalForDatabase.alvesStorePool;
}
