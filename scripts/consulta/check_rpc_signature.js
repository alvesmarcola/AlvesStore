const { safeFetch, getSupabaseConfig } = require('./seguro_fetch');

async function main() {
  const config = getSupabaseConfig();
  const headers = {
    apikey: config.serviceKey,
    Authorization: `Bearer ${config.serviceKey}`,
  };

  const res = await safeFetch(`${config.url}/rest/v1/?apikey=${config.serviceKey}`, { headers });
  const spec = await res.json();
  const rpc = spec.paths['/rpc/apply_store_payment'];
  console.log('Endpoint /rpc/apply_store_payment:', rpc ? 'EXISTE' : 'NÃO EXISTE');
  if (rpc && rpc.post) {
    console.log('Parâmetros:', rpc.post.parameters?.map(p => `${p.name} (${p.type})`));
    console.log('Respostas:', JSON.stringify(rpc.post.responses, null, 2));
  }
}

main().catch(console.error);

