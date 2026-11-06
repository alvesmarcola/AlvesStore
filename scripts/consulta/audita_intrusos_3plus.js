const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const products = JSON.parse(fs.readFileSync(path.join(__dirname, '../../data/products.json'), 'utf8'));

async function inspect3Plus() {
  const prods = products.filter(p => p.images && p.images.length >= 3);
  console.log('Total produtos com 3+ imagens:', prods.length);

  for (const p of prods) {
    const colors = [];
    for (let i = 0; i < p.images.length; i++) {
      const img = p.images[i];
      const relPath = img.src.startsWith('/') ? img.src.slice(1) : img.src;
      const fullPath = path.join(__dirname, '../../public', relPath);
      if (fs.existsSync(fullPath)) {
        const { data } = await sharp(fullPath).resize(1, 1).raw().toBuffer({ resolveWithObject: true });
        colors.push({ index: i, rgb: [data[0], data[1], data[2]], src: img.src });
      }
    }

    // Calcular distâncias em relação à foto 0
    const dists = colors.map((c, idx) => {
      if (idx === 0) return 0;
      const d = Math.sqrt(
        Math.pow(c.rgb[0] - colors[0].rgb[0], 2) +
        Math.pow(c.rgb[1] - colors[0].rgb[1], 2) +
        Math.pow(c.rgb[2] - colors[0].rgb[2], 2)
      );
      return Math.round(d);
    });

    const hasIntruder = dists.some(d => d >= 50);
    if (hasIntruder) {
      console.log(`\n[INTRUSO DETECTADO] ${p.nome} (${p.slug})`);
      console.log(`   Distâncias da Foto 1:`, dists);
      for (let j = 0; j < p.images.length; j++) {
        console.log(`   Foto ${j + 1} (dist ${dists[j]}): ${p.images[j].source}`);
      }
    }
  }
}

inspect3Plus();

