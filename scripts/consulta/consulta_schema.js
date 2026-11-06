const { safeFetch, getSupabaseConfig } = require('./seguro_fetch');

async function main() {
  const config = getSupabaseConfig();
  const headers = {
    apikey: config.serviceKey,
    Authorization: `Bearer ${config.serviceKey}`,
  };

  // GET no OpenAPI spec do PostgREST
  const res = await safeFetch(`${config.url}/rest/v1/?apikey=${config.serviceKey}`, { headers });
  console.log(`OpenAPI schema status: ${res.status}`);
  if (!res.ok) {
    console.error('Falha ao obter schema OpenAPI');
    return;
  }
  const spec = await res.json();
  const definitions = spec.definitions || {};
  console.log('\nTabelas encontradas no PostgREST:');
  for (const table of Object.keys(definitions)) {
    console.log(`- ${table}`);
  }

  if (definitions.products) {
    console.log('\nColunas da tabela products:');
    console.log(Object.keys(definitions.products.properties || {}));
  }

  // Verificar tabelas mencionadas no item 13:
  // payment_events, admin_audit_log, order_notifications, store_orders
  console.log('\nVerificação de tabelas específicas:');
  const targetTables = ['products', 'store_orders', 'payment_events', 'admin_audit_log', 'order_notifications', 'admin_product_supplier_details'];
  for (const t of targetTables) {
    console.log(`Tabela ${t}: ${definitions[t] ? 'EXISTE' : 'NÃO EXISTE'}`);
  }

  // Verificar RPCs expostas
  console.log('\nFunções RPC disponíveis no schema:');
  const paths = Object.keys(spec.paths || {}).filter(p => p.startsWith('/rpc/'));
  for (const p of paths) {
    console.log(`- ${p.replace('/rpc/', '')}`);
  }
}

main().catch(console.error);

