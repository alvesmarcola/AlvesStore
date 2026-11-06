const fs = require('fs');
const path = require('path');

const products = JSON.parse(fs.readFileSync(path.join(__dirname, '../../data/products.json'), 'utf8'));

const prods3Plus = products.filter(p => p.images && p.images.length >= 3);
console.log('Total produtos com 3 ou mais imagens:', prods3Plus.length);
for (const p of prods3Plus) {
  console.log(`\n${p.nome} (${p.slug}) - ${p.images.length} fotos:`);
  for (const [i, img] of p.images.entries()) {
    console.log(`   Foto ${i + 1}: ${img.src} -> ${img.source}`);
  }
}

