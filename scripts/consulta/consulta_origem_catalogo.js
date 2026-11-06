const fs = require('fs');
const path = require('path');
const { safeFetch, getSupabaseConfig } = require('./seguro_fetch');

async function main() {
  const productsJsonPath = path.join(process.cwd(), 'data', 'products.json');
  const f1JsonPath = path.join(process.cwd(), 'data', 'f1-products.json');
  const cacheJsonPath = path.join(process.cwd(), 'data', 'supabase-products-cache.json');

  const productsJson = JSON.parse(fs.readFileSync(productsJsonPath, 'utf8'));
  const f1Json = JSON.parse(fs.readFileSync(f1JsonPath, 'utf8'));
  const cacheJson = fs.existsSync(cacheJsonPath) ? JSON.parse(fs.readFileSync(cacheJsonPath, 'utf8')) : [];

  console.log('=== CONTAGEM DE ARQUIVOS LOCAIS ===');
  console.log(`data/products.json: ${productsJson.length} itens`);
  console.log(`data/f1-products.json: ${f1Json.length} itens`);
  console.log(`data/supabase-products-cache.json: ${cacheJson.length} itens`);

  // Supabase
  const config = getSupabaseConfig();
  console.log('\n=== CONSULTANDO SUPABASE (SOMENTE LEITURA GET) ===');
  const headers = {
    apikey: config.serviceKey,
    Authorization: `Bearer ${config.serviceKey}`,
    Prefer: 'count=exact',
  };

  // 1. Contagem total
  const countRes = await safeFetch(`${config.url}/rest/v1/products?select=id&limit=1`, { headers });
  const contentRange = countRes.headers.get('content-range');
  console.log(`Content-Range retornado: ${contentRange}`);

  const columns = 'id,yupoo_id,slug,clube,clubeSlug,liga,publico,tipo,temporada,uniforme,nome,preco,tamanhos,cor,imageSeed,images,description,brand,tem_variacao_uniforme';
  let allSupabaseRows = [];
  const PAGE_SIZE = 1000;
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const res = await safeFetch(`${config.url}/rest/v1/products?select=${columns}&order=id.asc&limit=${PAGE_SIZE}&offset=${offset}`, { headers });
    if (!res.ok) {
      console.error(`Erro ao buscar página ${offset}: status ${res.status}`);
      const err = await res.text();
      console.error('Detalhe do erro:', err);
      break;
    }
    const page = await res.json();
    allSupabaseRows.push(...page);
    console.log(`Baixadas ${allSupabaseRows.length} linhas...`);
    if (page.length < PAGE_SIZE) break;
  }
  console.log(`Total de linhas baixadas do Supabase: ${allSupabaseRows.length}`);

  // Analisar prefixos de yupoo_id no Supabase
  const yupooPrefixes = {};
  for (const row of allSupabaseRows) {
    const yid = String(row.yupoo_id || '');
    let prefix = 'vazio';
    if (yid.startsWith('manual:')) prefix = 'manual:';
    else if (yid.startsWith('nba:')) prefix = 'nba:';
    else if (/^\d+$/.test(yid)) prefix = 'numérico (Yupoo album id)';
    else prefix = 'outro: ' + (yid.split(':')[0] || 'sem_prefixo');
    yupooPrefixes[prefix] = (yupooPrefixes[prefix] || 0) + 1;
  }
  console.log('\nPrefixos de yupoo_id no Supabase:', yupooPrefixes);

  // Analisar por liga no Supabase
  const ligasSupabase = {};
  for (const row of allSupabaseRows) {
    const l = String(row.liga || 'indefinida');
    ligasSupabase[l] = (ligasSupabase[l] || 0) + 1;
  }
  console.log('\nLigas no Supabase:', ligasSupabase);

  // Analisar por tipo no Supabase
  const tiposSupabase = {};
  for (const row of allSupabaseRows) {
    const t = String(row.tipo || 'indefinido');
    tiposSupabase[t] = (tiposSupabase[t] || 0) + 1;
  }
  console.log('\nTipos no Supabase:', tiposSupabase);

  // Salvar dump resumido para scripts de diagnóstico posteriores
  fs.writeFileSync(path.join(process.cwd(), 'scripts', 'consulta', 'supabase_dump.json'), JSON.stringify(allSupabaseRows));
  console.log('\nDump salvo com sucesso em scripts/consulta/supabase_dump.json.');
}

main().catch(console.error);
