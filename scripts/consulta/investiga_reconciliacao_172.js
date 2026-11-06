const fs = require('fs');
const path = require('path');

const sitemapProd = require('./sitemap_prod_parsed.json');
const productsJson = require('../../data/products.json');
const f1Json = require('../../data/f1-products.json');
const cacheJson = require('../../data/supabase-products-cache.json');
const supabaseDump = require('./supabase_dump.json');

function isYupooImageUrl(value) {
  try {
    const hostname = new URL(value, 'https://catalog-image.invalid').hostname.toLocaleLowerCase('en-US');
    return hostname === 'yupoo.com' || hostname.endsWith('.yupoo.com');
  } catch {
    return false;
  }
}

function hasStorefrontImages(product) {
  const images = product.images || [];
  const isF1 = product.tipo === 'f1' || product.tipo === 'formula1' || product.liga === 'f1';
  return images.length > 0 && images.every((image) =>
    typeof image.src === 'string' && image.src.trim().length > 0 && (isF1 || !isYupooImageUrl(image.src)) &&
    (isF1 || !image.fallbackSrc || !isYupooImageUrl(image.fallbackSrc))
  );
}

function isPublishedProduct(product) {
  if (product.oculto === true) return false;
  const isNba = product.liga === 'nba' || product.tipo === 'regata';
  const isRetro = product.tipo === 'retro' || (product.slug && (product.slug.startsWith('retro-') || product.slug.includes('-retro')));
  const hasImage = hasStorefrontImages(product);
  const hasKnownAudience = product.publico !== 'revisar' || isNba || isRetro;
  const isF1 = product.tipo === 'f1' || product.tipo === 'formula1' || product.liga === 'f1';
  return hasImage && (product.tipo !== 'revisar' || isNba || isRetro) && (hasKnownAudience || isF1);
}

// 1. O que acontecia quando fetchSupabaseProducts() falhava e retornava array vazio?
// mergedBySlug pegava:
// bundledCatalog.filter(isPublishedProduct)
// getBundledFeminineProducts()
// getBundledFormulaOneProducts()
// e published = []
const publishedBundledOnly = [];
const mergedBundledOnly = new Map();

for (const p of productsJson) {
  if (isPublishedProduct(p)) mergedBundledOnly.set(p.slug, { ...p, origin: 'products.json' });
}
for (const p of f1Json) {
  if (isPublishedProduct(p)) mergedBundledOnly.set(p.slug, { ...p, origin: 'f1-products.json' });
}

console.log(`Produtos no build apenas com bundled (sem Supabase): ${mergedBundledOnly.size}`);

// 2. Quando o Supabase respondia com tudo (produção):
const prodSlugs = new Set(sitemapProd.produtos.map(p => p.slug));
console.log(`Produtos no sitemap de produção: ${prodSlugs.size}`);

const diffBetweenProdAndBundledOnly = prodSlugs.size - mergedBundledOnly.size;
console.log(`Diferença (Produção - Bundled Only): ${prodSlugs.size} - ${mergedBundledOnly.size} = ${diffBetweenProdAndBundledOnly}`);

// Vamos ver quais produtos de produção NÃO estavam no bundled only:
const missingWhenSupabaseFailed = [];
for (const slug of prodSlugs) {
  if (!mergedBundledOnly.has(slug)) {
    // de onde vinha esse produto?
    const inCache = cacheJson.find(c => c.slug === slug);
    const inDump = supabaseDump.find(d => d.slug === slug);
    const inProducts = productsJson.find(p => p.slug === slug);
    missingWhenSupabaseFailed.push({
      slug,
      nome: inCache?.nome || inDump?.nome || inProducts?.nome,
      origin: inCache ? 'Supabase: NBA/manual' : (inDump ? 'Supabase: F1 antigo / revisar' : (inProducts ? 'products.json (não publicado)' : 'outro')),
    });
  }
}

console.log(`Total de produtos de produção perdidos se o Supabase falhar: ${missingWhenSupabaseFailed.length}`);
const countsByOrigin = {};
for (const m of missingWhenSupabaseFailed) {
  countsByOrigin[m.origin] = (countsByOrigin[m.origin] || 0) + 1;
}
console.log('Origem dos produtos perdidos:', countsByOrigin);

// E sobre as "172 páginas de produto"?
// Vamos ver o histórico: 835 produtos em produção.
// Se na época o sitemap tinha 835 produtos, e num build parcial gerou menos:
// No histórico do prompt anterior:
// "QUEDA DE PÁGINAS: o build gerava 1015 páginas estáticas e agora gera 818 (diferença de 197, igual ao número de produtos do Brasileirão Série A)."
// E agora a pergunta 4: "Reconcilie: o build com timeout perdeu 172 páginas de produto, mas o Supabase contribui com 123 linhas (122 NBA + 1 teste). Liste os produtos que explicam a diferença, com a fonte de cada um."
// Vamos ver se 123 + 49 = 172? Ou 122 NBA + 1 teste + 49 produtos de F1?
// Ou quais 172 produtos eram?
fs.writeFileSync(path.join(process.cwd(), 'scripts', 'consulta', 'missing_when_supabase_failed.json'), JSON.stringify(missingWhenSupabaseFailed, null, 2));
