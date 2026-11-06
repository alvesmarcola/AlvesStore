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

async function searchSupabase() {
  console.log('--- BUSCANDO HILAL NO SUPABASE ---');
  const res1 = await fetch(`${supabaseUrl}/rest/v1/products?select=id,slug,nome,images,liga,clube&or=(nome.ilike.%hilal%,slug.ilike.%hilal%,clube.ilike.%hilal%)`, {
    headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` }
  });
  const data1 = await res1.json();
  console.log('Total Hilal no Supabase:', data1.length);
  for (const item of data1) {
    console.log(item.id, item.slug, item.nome);
    console.log('Images:', JSON.stringify(item.images?.slice(0, 3), null, 2));
  }

  console.log('\n--- BUSCANDO AJAX NO SUPABASE ---');
  const res2 = await fetch(`${supabaseUrl}/rest/v1/products?select=id,slug,nome,images,liga,clube&or=(nome.ilike.%ajax%,slug.ilike.%ajax%,clube.ilike.%ajax%)&limit=5`, {
    headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` }
  });
  const data2 = await res2.json();
  console.log('Total Ajax no Supabase:', data2.length);
  for (const item of data2) {
    console.log(item.id, item.slug, item.nome);
  }
}

searchSupabase();

