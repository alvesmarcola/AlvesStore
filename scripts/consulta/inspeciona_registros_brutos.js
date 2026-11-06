const fs = require('fs');
const path = require('path');

// Ler .env.local
const envFile = fs.readFileSync(path.join(__dirname, '../../.env.local'), 'utf8');
let supabaseUrl = '';
let supabaseKey = '';
for (const line of envFile.split('\n')) {
  const [k, ...v] = line.trim().split('=');
  if (k === 'NEXT_PUBLIC_SUPABASE_URL') supabaseUrl = v.join('=').trim();
  if (k === 'SUPABASE_SERVICE_ROLE_KEY') supabaseKey = v.join('=').trim();
}

async function inspectSample() {
  const url = `${supabaseUrl}/rest/v1/products?select=id,yupoo_id,slug,clube,clubeSlug,liga,publico,tipo,temporada,uniforme,nome,preco,tamanhos,cor,imageSeed,images,description,brand&not.like.yupoo_id.manual:*&not.eq.liga.nba&limit=5`;
  const res = await fetch(url, {
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`
    }
  });

  if (!res.ok) {
    console.error('Erro:', res.status, await res.text());
    return;
  }

  const data = await res.json();
  console.log('--- 5 REGISTROS DO SUPABASE NÃO-MANUAL E NÃO-NBA ---');
  for (const item of data) {
    console.log(JSON.stringify({
      id: item.id,
      yupoo_id: item.yupoo_id,
      slug: item.slug,
      nome: item.nome,
      preco: item.preco,
      tamanhos: item.tamanhos,
      liga: item.liga,
      tipo: item.tipo,
      publico: item.publico,
      uniforme: item.uniforme,
      clube: item.clube,
      qtd_images: Array.isArray(item.images) ? item.images.length : typeof item.images,
      first_image: Array.isArray(item.images) && item.images[0] ? item.images[0] : null
    }, null, 2));
  }
}

inspectSample();

