const fs = require('fs');
const path = require('path');
const { loadEnvConfig } = require('@next/env');
loadEnvConfig(process.cwd());

// Importar as funções e dados do próprio código
const productsJson = require('../../data/products.json');
const f1Json = require('../../data/f1-products.json');
const cacheJson = require('../../data/supabase-products-cache.json');
const sitemapProd = require('./sitemap_prod_parsed.json');
const supabaseDump = require('./supabase_dump.json');

// Simular exatamente a lógica de mapProduct e isPublishedProduct do código atual
function slugifyCatalogValue(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function isYupooImageUrl(value) {
  try {
    const hostname = new URL(value, 'https://catalog-image.invalid').hostname.toLocaleLowerCase('en-US');
    return hostname === 'yupoo.com' || hostname.endsWith('.yupoo.com');
  } catch {
    return false;
  }
}

function isFormulaOneEvidence(value) {
  const normalized = String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR')
    .replace(/\bred[-\s]*bull[-\s]+bragantino\b/g, 'bragantino');
  if (/\b(?:nba|basquete|basketball|regata)\b/.test(normalized)) return false;
  return /\b(?:f1|formula[-\s]*1|formula[-\s]*one|automobilismo|scuderia|ferrari|red[-\s]*bull(?:[-\s]*racing)?|mclaren|mercedes(?:[-\s]*amg)?|senna|aston[-\s]*martin|alpine|williams|haas)\b/.test(normalized);
}

function isFormulaOneProduct(product) {
  if (product.liga === 'nba' || product.tipo === 'regata') return false;
  const evidence = [
    product.liga,
    product.tipo,
    product.nome,
    product.title,
    product.name,
    product.model,
    product.version,
    product.slug,
    product.clube,
    product.clubeSlug,
    product.category,
    product.league,
    product.subcategory,
    ...(product.tags || []),
    product.imageSeed,
    ...(product.images || []).flatMap((img) => [img.source, img.src]),
  ].join(' ').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR');

  return product.tipo === 'f1' || product.tipo === 'formula1' || product.liga === 'f1' || product.liga === 'formula-1' || isFormulaOneEvidence(evidence);
}

function isJacketFormulaOneProduct(product) {
  if (!isFormulaOneProduct(product)) return false;
  return /\bjacket\b/i.test([
    product.nome,
    product.title || '',
    product.name || '',
  ].join(' '));
}

function hasStorefrontImages(product) {
  const images = product.images || [];
  const isF1 = product.tipo === 'f1' || product.tipo === 'formula1' || product.liga === 'f1' || isFormulaOneProduct(product);
  return images.length > 0 && images.every((image) =>
    typeof image.src === 'string' && image.src.trim().length > 0 && (isF1 || !isYupooImageUrl(image.src)) &&
    (isF1 || !image.fallbackSrc || !isYupooImageUrl(image.fallbackSrc))
  );
}

function isPublishedProduct(product) {
  if (product.oculto === true) return false;
  if (isJacketFormulaOneProduct(product)) return false;
  const isNba = product.liga === 'nba' || product.tipo === 'regata';
  const isRetro = product.tipo === 'retro' || product.slug.startsWith('retro-') || product.slug.includes('-retro');
  const hasImage = (product.tipo === 'f1' || product.tipo === 'formula1' || product.liga === 'f1' || isFormulaOneProduct(product))
    ? true
    : hasStorefrontImages(product);
  const hasKnownAudience = product.publico !== 'revisar' || isNba || isRetro;
  const isF1 = product.tipo === 'f1' || product.tipo === 'formula1' || product.liga === 'f1' || isFormulaOneProduct(product);
  return hasImage && (product.tipo !== 'revisar' || isNba || isRetro) && (hasKnownAudience || isF1);
}

async function main() {
  console.log('=== COMPARATIVO DETALHADO DO CATÁLOGO ===');

  // 1. Catálogo Bundled
  const bundled = [...productsJson, ...f1Json];
  const publishedBundled = bundled.filter(isPublishedProduct);
  console.log(`Bundled total: ${bundled.length}, publicados: ${publishedBundled.length}`);

  // 2. F1 detalhado:
  // Quantos produtos em products.json e f1-products.json e Supabase satisfazem isFormulaOneProduct?
  const f1InProductsJson = productsJson.filter(isFormulaOneProduct);
  const f1InF1Json = f1Json.filter(isFormulaOneProduct);
  const f1InSupabase = supabaseDump.filter(isFormulaOneProduct);

  console.log('\n=== DIAGNÓSTICO DOS PRODUTOS DE F1 ===');
  console.log(`- Em data/f1-products.json: ${f1InF1Json.length} (total no arquivo: ${f1Json.length})`);
  console.log(`- Em data/products.json que batem regra F1: ${f1InProductsJson.length}`);
  console.log(`- No Supabase dump que batem regra F1: ${f1InSupabase.length}`);

  // Se perguntam "De onde vêm os 137 produtos de F1", vamos ver se no Supabase existem produtos de F1 ou de Red Bull!
  const redBullBragantino = supabaseDump.filter(p => /red[-\s]*bull/i.test(p.nome || '') || /red[-\s]*bull/i.test(p.clube || ''));
  console.log(`Produtos com termo Red Bull no Supabase: ${redBullBragantino.length}`);
  const redBullF1 = redBullBragantino.filter(isFormulaOneProduct);
  console.log(`Desses, quantos isFormulaOneProduct considera F1: ${redBullF1.length}`);

  // 3. Montar catálogo do código novo
  // No código novo, pegamos publishedBundled + Supabase filtrado por or=(liga.eq.nba,tipo.eq.regata,yupoo_id.like.manual:*,id.like.manual:*)&oculto=eq.false
  // No dump, quais passam no filtro do servidor?
  const supabaseFilteredServer = supabaseDump.filter(row => {
    const isNba = row.liga === 'nba' || row.tipo === 'regata';
    const isManual = String(row.yupoo_id || '').startsWith('manual:') || String(row.id || '').startsWith('manual:');
    return (isNba || isManual);
  });
  console.log(`Linhas do Supabase que passam pelo filtro do servidor: ${supabaseFilteredServer.length}`);

  const codeNewBySlug = new Map();
  for (const p of publishedBundled) codeNewBySlug.set(p.slug, { ...p, fonte: 'bundled' });
  for (const p of supabaseFilteredServer) {
    // Normalizar similar a mapProduct
    const isManual = String(p.yupoo_id || '').startsWith('manual:') || String(p.id || '').startsWith('manual:');
    let preco = Number(p.preco);
    if (!isManual && (p.liga === 'nba' || p.tipo === 'regata')) {
      if (!Number.isFinite(preco) || preco <= 0) preco = 230;
    }
    const mapped = {
      ...p,
      preco,
      fonte: isManual ? 'supabase:manual' : 'supabase:nba',
    };
    if (isPublishedProduct(mapped)) {
      codeNewBySlug.set(mapped.slug, mapped);
    }
  }

  const codeNewProducts = [...codeNewBySlug.values()];
  console.log(`\nCatálogo NOVO final: ${codeNewProducts.length} produtos.`);

  // 4. Slugs de Produção (sitemap)
  const prodSlugs = new Set(sitemapProd.produtos.map(p => p.slug));
  console.log(`Total de produtos em produção (sitemap): ${prodSlugs.size}`);

  // 5. Diferenças slug a slug
  const inProdNotNew = [];
  for (const slug of prodSlugs) {
    if (!codeNewBySlug.has(slug)) {
      inProdNotNew.push(slug);
    }
  }

  const inNewNotProd = [];
  for (const [slug, prod] of codeNewBySlug) {
    if (!prodSlugs.has(slug)) {
      inNewNotProd.push({ slug, fonte: prod.fonte, nome: prod.nome, liga: prod.liga, tipo: prod.tipo });
    }
  }

  console.log(`\n=== RESULTADO DA COMPARAÇÃO ===`);
  console.log(`Slugs em produção que NÃO estão no catálogo novo: ${inProdNotNew.length}`);
  if (inProdNotNew.length > 0) {
    console.log('Amostra:', inProdNotNew.slice(0, 20));
  }
  console.log(`Slugs no catálogo novo que NÃO estão no sitemap de produção: ${inNewNotProd.length}`);
  if (inNewNotProd.length > 0) {
    console.log('Lista completa:', inNewNotProd);
  }

  // 6. Contagem por liga e tipo nos dois lados
  const ligasNovo = {};
  const tiposNovo = {};
  for (const p of codeNewProducts) {
    const l = p.liga || 'indefinida';
    ligasNovo[l] = (ligasNovo[l] || 0) + 1;
    const t = p.tipo || 'indefinido';
    tiposNovo[t] = (tiposNovo[t] || 0) + 1;
  }

  console.log('\nContagem por Liga no Catálogo Novo:', ligasNovo);
  console.log('\nContagem por Tipo no Catálogo Novo:', tiposNovo);

  fs.writeFileSync(
    path.join(process.cwd(), 'scripts', 'consulta', 'comparativo_detalhado.json'),
    JSON.stringify({
      totalProd: prodSlugs.size,
      totalNovo: codeNewProducts.length,
      inProdNotNew,
      inNewNotProd,
      ligasNovo,
      tiposNovo,
    }, null, 2)
  );
}

main().catch(console.error);

