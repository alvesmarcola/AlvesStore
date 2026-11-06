const fs = require('fs');
const path = require('path');

const sitemapProd = require('./sitemap_prod_parsed.json');
const productsJson = require('../../data/products.json');
const f1Json = require('../../data/f1-products.json');
const cacheJson = require('../../data/supabase-products-cache.json');
const supabaseDump = require('./supabase_dump.json');

const prodSlugs = new Set(sitemapProd.produtos.map(p => p.slug));
const productsJsonSlugs = new Set(productsJson.map(p => p.slug));
const f1JsonSlugs = new Set(f1Json.map(p => p.slug));
const cacheSlugs = new Set(cacheJson.map(p => p.slug));
const supabaseSlugs = new Set(supabaseDump.map(p => p.slug));

console.log(`=== UNIVERSOS DE SLUGS ===`);
console.log(`- Sitemap Produção: ${prodSlugs.size} slugs`);
console.log(`- data/products.json: ${productsJsonSlugs.size} slugs`);
console.log(`- data/f1-products.json: ${f1JsonSlugs.size} slugs`);
console.log(`- data/supabase-products-cache.json: ${cacheSlugs.size} slugs`);
console.log(`- Supabase DB completo: ${supabaseSlugs.size} slugs`);

// Quantos do sitemap estão em products.json?
let sitemapInProductsJson = 0;
let sitemapInF1Json = 0;
let sitemapInCache = 0;
let sitemapInSupabaseOnly = 0;
let sitemapNowhere = 0;

const sitemapOriginList = [];

for (const slug of prodSlugs) {
  let origin = 'desconhecido';
  if (productsJsonSlugs.has(slug)) {
    origin = 'products.json';
    sitemapInProductsJson++;
  } else if (f1JsonSlugs.has(slug)) {
    origin = 'f1-products.json';
    sitemapInF1Json++;
  } else if (cacheSlugs.has(slug)) {
    origin = 'supabase-products-cache.json (NBA/manual)';
    sitemapInCache++;
  } else if (supabaseSlugs.has(slug)) {
    origin = 'supabase-revisar (álbuns brutos/F1 antigos)';
    sitemapInSupabaseOnly++;
  } else {
    origin = 'não encontrado em nenhuma base';
    sitemapNowhere++;
  }
  sitemapOriginList.push({ slug, origin });
}

console.log(`\n=== ORIGEM DOS 835 PRODUTOS EM PRODUÇÃO ===`);
console.log(`- data/products.json (futebol): ${sitemapInProductsJson}`);
console.log(`- data/f1-products.json (F1 novos): ${sitemapInF1Json}`);
console.log(`- data/supabase-products-cache.json (NBA/manual): ${sitemapInCache}`);
console.log(`- Supabase remoto apenas (álbuns não categorizados/F1 antigos): ${sitemapInSupabaseOnly}`);
console.log(`- Não encontrado em nenhuma base: ${sitemapNowhere}`);
console.log(`Soma: ${sitemapInProductsJson + sitemapInF1Json + sitemapInCache + sitemapInSupabaseOnly + sitemapNowhere}`);

// Salvar detalhe
fs.writeFileSync(path.join(process.cwd(), 'scripts', 'consulta', 'sitemap_origins_breakdown.json'), JSON.stringify(sitemapOriginList, null, 2));

