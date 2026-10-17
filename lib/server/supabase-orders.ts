import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export class SupabaseOrdersConfigurationError extends Error {}

const globalForOrders = globalThis as typeof globalThis & { alvesSupabaseOrders?: SupabaseClient };

function isServerSecretKey(key: string) {
  if (key.startsWith("sb_secret_")) return true;
  try {
    const payload = key.split(".")[1];
    return Boolean(payload && JSON.parse(Buffer.from(payload, "base64url").toString("utf8")).role === "service_role");
  } catch {
    return false;
  }
}

export function getSupabaseOrdersClient() {
  if (globalForOrders.alvesSupabaseOrders) return globalForOrders.alvesSupabaseOrders;

  const url = process.env.SUPABASE_URL?.trim() || process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SECRET_KEY?.trim() || process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key || !isServerSecretKey(key)) {
    throw new SupabaseOrdersConfigurationError("Configure SUPABASE_URL e SUPABASE_SECRET_KEY no ambiente do servidor.");
  }

  globalForOrders.alvesSupabaseOrders = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
  return globalForOrders.alvesSupabaseOrders;
}
