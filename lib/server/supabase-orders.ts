import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export class SupabaseOrdersConfigurationError extends Error {}

const globalForOrders = globalThis as typeof globalThis & { alvesSupabaseOrders?: SupabaseClient };

function isPublicSupabaseKey(key: string) {
  if (key.startsWith("sb_publishable_")) return true;
  try {
    const payload = key.split(".")[1];
    return Boolean(payload && JSON.parse(Buffer.from(payload, "base64url").toString("utf8")).role === "anon");
  } catch {
    return false;
  }
}

export function getSupabaseOrdersClient() {
  if (globalForOrders.alvesSupabaseOrders) return globalForOrders.alvesSupabaseOrders;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
    || process.env.SUPABASE_SECRET_KEY?.trim()
    || process.env.SUPABASE_SERVICE_KEY?.trim()
    || process.env.SUPABASE_ROLE_KEY?.trim();
  if (!url || !key || isPublicSupabaseKey(key)) {
    const missing = [
      !url ? "NEXT_PUBLIC_SUPABASE_URL" : null,
      !key ? "SUPABASE_SERVICE_ROLE_KEY (ou SUPABASE_SECRET_KEY)" : null,
      key && isPublicSupabaseKey(key) ? "a chave configurada é pública; use a chave secreta/service_role no servidor" : null,
    ].filter(Boolean);
    throw new SupabaseOrdersConfigurationError("Credenciais ausentes: " + missing.join(", ") + ".");
  }

  globalForOrders.alvesSupabaseOrders = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
  return globalForOrders.alvesSupabaseOrders;
}
