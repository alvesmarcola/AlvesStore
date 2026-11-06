const fs = require('fs');
const path = require('path');

const supabaseDump = require('./supabase_dump.json');
const sitemapProd = require('./sitemap_prod_parsed.json');
const productsJson = require('../../data/products.json');
const f1Json = require('../../data/f1-products.json');

// Analisar os 125 produtos do sitemap que não estão no código novo
const prodSlugs = new Set(sitemapProd.produtos.map(p => p.slug));
const missingInNew = [];
for (const slug of prodSlugs) {
  // Procurar no Supabase dump
  const matchSupabase = supabaseDump.find(r => r.slug === slug);
  const matchProducts = productsJson.find(r => r.slug === slug);
  const matchF1 = f1Json.find(r => r.slug === slug);
  missingInNew.push({
    slug,
    inSupabase: Boolean(matchSupabase),
    inProductsJson: Boolean(matchProducts),
    inF1Json: Boolean(matchF1),
    supabaseLiga: matchSupabase ? matchSupabase.liga : null,
    supabaseTipo: matchSupabase ? matchSupabase.tipo : null,
    supabaseNome: matchSupabase ? matchSupabase.nome : null,
    yupooId: matchSupabase ? matchSupabase.yupoo_id : null,
  });
}

console.log(`Total de produtos em produção ausentes no código novo: ${missingInNew.filter(x => !x.inProductsJson && !x.inF1Json && x.inSupabase).length}`);
const categoriasAusentes = {};
for (const item of missingInNew.filter(x => x.inSupabase)) {
  const isF1 = item.slug.includes('f1') || item.slug.includes('formula');
  const cat = isF1 ? 'F1 antigo (Yupoo não categorizado no Supabase)' : 'Outro';
  categoriasAusentes[cat] = (categoriasAusentes[cat] || 0) + 1;
}
console.log('Classificação das ausências:', categoriasAusentes);

// Investigar a reconciliação dos 172 produtos (Pergunta 4):
// Se o build dava timeout ao consultar o Supabase, o que acontecia?
// Quando fetchSupabaseProducts dava timeout no Supabase e não tinha cache:
// result = bundledCatalog (720 futebol + 12 F1 = 732, mas quantos passavam em isPublishedProduct?)
// Vamos verificar!

