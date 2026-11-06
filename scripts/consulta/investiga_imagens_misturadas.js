const fs = require('fs');
const path = require('path');

const products = JSON.parse(fs.readFileSync(path.join(__dirname, '../../data/products.json'), 'utf8'));

console.log('--- BUSCANDO AL-HILAL ---');
const hilal = products.filter(p => JSON.stringify(p).toLowerCase().includes('hilal'));
console.log('Total Hilal:', hilal.length);
for (const p of hilal) {
  console.log('ID:', p.id);
  console.log('Slug:', p.slug);
  console.log('Nome:', p.nome);
  console.log('Imagens:', p.images?.map(i => ({ src: i.src, source: i.source })));
}

console.log('\n--- BUSCANDO AJAX ---');
const ajax = products.filter(p => JSON.stringify(p).toLowerCase().includes('ajax'));
console.log('Total Ajax:', ajax.length);
for (const p of ajax) {
  console.log('ID:', p.id);
  console.log('Slug:', p.slug);
  console.log('Nome:', p.nome);
  console.log('Imagens:', p.images?.map(i => ({ src: i.src, source: i.source })));
}

console.log('\n--- BUSCANDO KITS INFANTIS COM MÚLTIPLAS IMAGENS ---');
const kids = products.filter(p => p.publico === 'infantil' || p.nome?.toLowerCase().includes('infantil') || p.slug?.toLowerCase().includes('infantil') || p.slug?.toLowerCase().includes('kit'));
console.log('Total Kids/Kits:', kids.length);
for (const p of kids.slice(0, 10)) {
  console.log('ID:', p.id, 'Slug:', p.slug);
  console.log('Nome:', p.nome);
  console.log('Imagens:', p.images?.map(i => ({ src: i.src, source: i.source })));
}

