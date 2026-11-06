const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const products = JSON.parse(fs.readFileSync(path.join(__dirname, '../../data/products.json'), 'utf8'));

async function analyzeAll() {
  const results = [];

  for (const p of products) {
    if (!p.images || p.images.length <= 1) continue;

    const imgData = [];
    for (let i = 0; i < p.images.length; i++) {
      const img = p.images[i];
      const relPath = img.src.startsWith('/') ? img.src.slice(1) : img.src;
      const fullPath = path.join(__dirname, '../../public', relPath);

      if (fs.existsSync(fullPath)) {
        try {
          // Redimensionar para 1x1 para obter a cor média predominante
          const { data } = await sharp(fullPath).resize(1, 1).raw().toBuffer({ resolveWithObject: true });
          imgData.push({
            index: i,
            src: img.src,
            source: img.source,
            r: data[0],
            g: data[1],
            b: data[2]
          });
        } catch (e) {
          imgData.push({ index: i, src: img.src, error: e.message });
        }
      } else {
        imgData.push({ index: i, src: img.src, missing: true });
      }
    }

    // Calcular diferença de cor entre a foto 0 e a foto 1
    if (imgData.length >= 2 && !imgData[0].error && !imgData[1].error && !imgData[0].missing && !imgData[1].missing) {
      const dR = imgData[0].r - imgData[1].r;
      const dG = imgData[0].g - imgData[1].g;
      const dB = imgData[0].b - imgData[1].b;
      const colorDistance = Math.sqrt(dR*dR + dG*dG + dB*dB);

      results.push({
        slug: p.slug,
        nome: p.nome,
        clube: p.clube,
        publico: p.publico,
        tipo: p.tipo,
        uniforme: p.uniforme,
        totalImgs: p.images.length,
        colorDistance: Math.round(colorDistance),
        img0: { src: imgData[0].src, rgb: [imgData[0].r, imgData[0].g, imgData[0].b], source: imgData[0].source },
        img1: { src: imgData[1].src, rgb: [imgData[1].r, imgData[1].g, imgData[1].b], source: imgData[1].source }
      });
    }
  }

  // Ordenar pela maior distância de cor (mais divergentes primeiro)
  results.sort((a, b) => b.colorDistance - a.colorDistance);

  console.log('Total analisado:', results.length);
  console.log('\nTop 30 produtos com maior divergência de cor entre foto 1 e foto 2:');
  for (const r of results.slice(0, 30)) {
    console.log(`[Distância: ${r.colorDistance}] ${r.nome} (${r.slug})`);
    console.log(`   Foto 1: RGB(${r.img0.rgb.join(',')}) - ${r.img0.source}`);
    console.log(`   Foto 2: RGB(${r.img1.rgb.join(',')}) - ${r.img1.source}`);
  }

  // Salvar relatório completo
  fs.writeFileSync(
    path.join(__dirname, '../../relatorios/analise_divergencia_fotos.json'),
    JSON.stringify(results, null, 2)
  );
}

analyzeAll();

