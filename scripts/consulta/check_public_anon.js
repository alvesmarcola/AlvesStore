const { safeFetch } = require('./seguro_fetch');

async function main() {
  const res = await safeFetch('https://www.importsalves.com.br/');
  const html = await res.text();
  // Procurar por supabase anon key no html
  const match = html.match(/eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/g);
  console.log('JWTs encontrados no HTML público:', match ? match.length : 0);
  if (match) {
    for (const jwt of match) {
      console.log('Testando JWT no Supabase com GET...');
      const testRes = await safeFetch('https://rlbdgyajikbdhivwfyzk.supabase.co/rest/v1/products?select=id&limit=1', {
        headers: { apikey: jwt, Authorization: `Bearer ${jwt}`, Prefer: 'count=exact' }
      });
      console.log('Status HTTP:', testRes.status, 'Range:', testRes.headers.get('content-range'));
    }
  }
}

main().catch(console.error);

