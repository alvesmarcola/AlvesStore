const { safeFetch, getSupabaseConfig } = require('./seguro_fetch');

async function main() {
  const config = getSupabaseConfig();
  console.log('=== TESTE DE RLS COM CHAVE ANON PÚBLICA (SOMENTE GET) ===');
  const headers = {
    apikey: config.anonKey,
    Authorization: `Bearer ${config.anonKey}`,
    Prefer: 'count=exact',
  };

  const res = await safeFetch(`${config.url}/rest/v1/products?select=id&limit=1`, { headers });
  console.log(`Status HTTP: ${res.status}`);
  const range = res.headers.get('content-range');
  console.log(`Content-Range com anonKey: ${range}`);

  // Verificar se consegue ler produtos com liga="revisar"
  const resRevisar = await safeFetch(`${config.url}/rest/v1/products?select=id,nome,liga&liga=eq.revisar&limit=5`, { headers });
  console.log(`Status HTTP consulta liga=revisar: ${resRevisar.status}`);
  const dataRevisar = await resRevisar.json();
  console.log(`Quantidade retornada de produtos com liga=revisar: ${dataRevisar.length}`);
}

main().catch(console.error);

