const { safeFetch, getSupabaseConfig } = require('./seguro_fetch');

async function main() {
  const config = getSupabaseConfig();
  const headers = {
    apikey: config.serviceKey,
    Authorization: `Bearer ${config.serviceKey}`,
  };

  const res = await safeFetch(`${config.url}/rest/v1/?apikey=${config.serviceKey}`, { headers });
  const spec = await res.json();
  const def = spec.definitions.store_orders;
  console.log('Colunas de store_orders:', def ? Object.keys(def.properties || {}) : 'Tabela não encontrada');
}

main().catch(console.error);

