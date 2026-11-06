const fs = require('fs');
const path = require('path');

const products = JSON.parse(fs.readFileSync(path.join(__dirname, '../../data/products.json'), 'utf8'));

console.log('Total produtos em products.json:', products.length);

// 1. Verificar compartilhamento de imagens entre produtos diferentes
const imageToProducts = new Map();
for (const p of products) {
  for (const img of (p.images || [])) {
    if (!img.src) continue;
    const list = imageToProducts.get(img.src) || [];
    list.push({ id: p.id, slug: p.slug, nome: p.nome, clube: p.clube });
    imageToProducts.set(img.src, list);
  }
}

const sharedImages = [];
for (const [src, prods] of imageToProducts.entries()) {
  if (prods.length > 1) {
    sharedImages.push({ src, count: prods.length, prods });
  }
}
console.log('Imagens compartilhadas entre produtos diferentes:', sharedImages.length);
if (sharedImages.length > 0) {
  console.log('Exemplos de imagens compartilhadas (primeiros 5):');
  console.log(JSON.stringify(sharedImages.slice(0, 5), null, 2));
}

// 2. Verificar inconsistência entre o nome/clube do produto e o source/src da imagem
const mismatch = [];
for (const p of products) {
  const pName = (p.nome || '').toLowerCase();
  const pClube = (p.clube || '').toLowerCase();
  const pSlug = (p.slug || '').toLowerCase();

  for (const img of (p.images || [])) {
    const src = (img.src || '').toLowerCase();
    const source = (img.source || '').toLowerCase();

    // Extrair partes do source
    const sourceFilename = path.basename(source);
    
    // Verificar se o source tem palavras que não batem com o produto
    // Exemplo: produto é Al-Hilal mas o source fala de outro time, ou produto é infantil e a foto é de adulto, etc.
  }
}

// 3. Vamos inspecionar especificamente Al-Hilal, Ajax e Kits Infantis
console.log('\n--- DETALHES DE AL-HILAL ---');
const hilalProds = products.filter(p => JSON.stringify(p).toLowerCase().includes('hilal'));
for (const p of hilalProds) {
  console.log('Slug:', p.slug);
  console.log('Nome:', p.nome);
  console.log('Images:', p.images);
}

console.log('\n--- DETALHES DE AJAX ---');
const ajaxProds = products.filter(p => JSON.stringify(p).toLowerCase().includes('ajax'));
for (const p of ajaxProds) {
  console.log('Slug:', p.slug);
  console.log('Nome:', p.nome);
  console.log('Images:', p.images);
}

// 4. Inspecionar todos os kits infantis e suas fotos
console.log('\n--- KITS INFANTIS (34 PRODUTOS) ---');
const kids = products.filter(p => p.publico === 'infantil');
console.log('Total kits infantis:', kids.length);
const kidsWithMultiple = kids.filter(p => (p.images || []).length > 1);
console.log('Kits infantis com mais de 1 imagem:', kidsWithMultiple.length);
for (const p of kidsWithMultiple) {
  console.log(`\nKit: ${p.nome} (${p.slug})`);
  for (const [idx, img] of (p.images || []).entries()) {
    console.log(`  Foto ${idx + 1}: src=${img.src} source=${img.source}`);
  }
}

