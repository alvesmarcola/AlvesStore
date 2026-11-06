const fs = require('fs');
const path = require('path');

const envFile = fs.readFileSync(path.join(__dirname, '../../.env.local'), 'utf8');
let supabaseUrl = '';
let supabaseKey = '';
for (const line of envFile.split('\n')) {
  const [k, ...v] = line.trim().split('=');
  if (k === 'NEXT_PUBLIC_SUPABASE_URL') supabaseUrl = v.join('=').trim();
  if (k === 'SUPABASE_SERVICE_ROLE_KEY') supabaseKey = v.join('=').trim();
}

async function checkCatalogSummary() {
  // 1. Produtos com preco > 0 (sintaxe correta: preco=gt.0)
  const res1 = await fetch(`${supabaseUrl}/rest/v1/products?select=id,nome,preco,liga,tipo,tamanhos&preco=gt.0`, {
    headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}`, Prefer: 'count=exact' }
  });
  console.log('Produtos com preco > 0 no Supabase:', res1.headers.get('content-range'));
  const prodsWithPrice = await res1.json();
  const ligasWithPrice = {};
  for (const p of prodsWithPrice) {
    ligasWithPrice[p.liga] = (ligasWithPrice[p.liga] || 0) + 1;
  }
  console.log('Ligas dos produtos com preco > 0:', ligasWithPrice);

  // 2. Total de produtos por liga
  const res2 = await fetch(`${supabaseUrl}/rest/v1/products?select=liga`, {
    headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}`, Prefer: 'count=exact' }
  });
  console.log('Total de produtos na tabela:', res2.headers.get('content-range'));

  // 3. Produtos onde liga != 'revisar'
  const res3 = await fetch(`${supabaseUrl}/rest/v1/products?select=id,liga,tipo,preco&liga=neq.revisar`, {
    headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}`, Prefer: 'count=exact' }
  });
  console.log('Produtos com liga != revisar:', res3.headers.get('content-range'));
  const nonRevisar = await res3.json();
  const mapNonRevisar = {};
  for (const p of nonRevisar) {
    mapNonRevisar[p.liga] = (mapNonRevisar[p.liga] || 0) + 1;
  }
  console.log('Distribuição dos produtos com liga != revisar:', mapNonRevisar);
}

checkCatalogSummary();
