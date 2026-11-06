const { loadEnvConfig } = require('@next/env');
loadEnvConfig(process.cwd());

function safeFetch(url, options = {}) {
  const method = (options.method || 'GET').toUpperCase();
  if (method !== 'GET' && method !== 'HEAD') {
    throw new Error(`VIOLAÇÃO DE SEGURANÇA: Método ${method} não permitido em scripts de consulta. Apenas GET e HEAD são aceitos.`);
  }
  return fetch(url, { ...options, method });
}

function getSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url) {
    throw new Error('Supabase URL não encontrada no ambiente.');
  }
  return {
    url: url.replace(/\/$/, ''),
    serviceKey,
    anonKey,
  };
}

module.exports = {
  safeFetch,
  getSupabaseConfig,
};

