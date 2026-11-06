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

async function checkSupabaseNba() {
  const res = await fetch(`${supabaseUrl}/rest/v1/products?select=id,slug,nome,clube,images&liga=eq.nba`, {
    headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` }
  });
  const data = await res.json();
  console.log('Total regatas NBA no Supabase:', data.length);
  
  let suspiciousNba = 0;
  for (const item of data) {
    if (!item.images || item.images.length === 0) continue;
    // Verificar se as imagens apontam para caminhos consistentes
    const paths = item.images.map(img => img.src);
    const basePath = paths[0]?.split('/').slice(0, -1).join('/');
    const allSameFolder = paths.every(p => p.startsWith(basePath));
    if (!allSameFolder) {
      suspiciousNba++;
      console.log('Inconsistência na NBA:', item.slug, paths);
    }
  }
  console.log('Regatas NBA com imagens de pastas diferentes:', suspiciousNba);
}

checkSupabaseNba();

