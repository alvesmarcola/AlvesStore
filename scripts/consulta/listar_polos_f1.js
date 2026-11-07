const fs = require('fs');
const path = require('path');

const f1Path = path.join(__dirname, '../../data/f1-products.json');
const f1 = JSON.parse(fs.readFileSync(f1Path, 'utf8'));

const polos = f1.filter(p =>
  (p.nome && p.nome.toLowerCase().includes('polo')) ||
  (p.slug && p.slug.toLowerCase().includes('polo')) ||
  (p.id && p.id.toLowerCase().includes('polo'))
);

console.log(`Total de Polos de F1 encontrados: ${polos.length}\n`);

polos.forEach((p, idx) => {
  console.log(`[Polo ${idx + 1}]`);
  console.log(`Nome: ${p.nome}`);
  console.log(`Slug: ${p.slug}`);
  console.log(`ID: ${p.id}`);
  console.log(`Quantidade de fotos: ${p.images ? p.images.length : 0}`);
  if (p.images && p.images.length > 0) {
    p.images.forEach((img, i) => {
      console.log(`  Foto ${i + 1}: ${img.src}`);
      if (img.alt) console.log(`    Alt: ${img.alt}`);
      if (img.credit) console.log(`    Credit: ${img.credit}`);
    });
  } else {
    console.log('  (Nenhuma imagem)');
  }
  console.log('--------------------------------------------------');
});
