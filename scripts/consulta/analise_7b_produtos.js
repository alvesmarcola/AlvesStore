const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

function rgb2lab(rgb){
  let r = rgb[0] / 255, g = rgb[1] / 255, b = rgb[2] / 255;
  r = (r > 0.04045) ? Math.pow((r + 0.055) / 1.055, 2.4) : r / 12.92;
  g = (g > 0.04045) ? Math.pow((g + 0.055) / 1.055, 2.4) : g / 12.92;
  b = (b > 0.04045) ? Math.pow((b + 0.055) / 1.055, 2.4) : b / 12.92;
  let x = (r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047;
  let y = (r * 0.2126 + g * 0.7152 + b * 0.0722) / 1.00000;
  let z = (r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883;
  x = (x > 0.008856) ? Math.pow(x, 1/3) : (7.787 * x) + 16/116;
  y = (y > 0.008856) ? Math.pow(y, 1/3) : (7.787 * y) + 16/116;
  z = (z > 0.008856) ? Math.pow(z, 1/3) : (7.787 * z) + 16/116;
  return [(116 * y) - 16, 500 * (x - y), 200 * (y - z)];
}

function deltaE(rgb1, rgb2) {
  const lab1 = rgb2lab(rgb1);
  const lab2 = rgb2lab(rgb2);
  return Math.sqrt((lab1[0]-lab2[0])**2 + (lab1[1]-lab2[1])**2 + (lab1[2]-lab2[2])**2);
}

function rgbToHex(rgb) {
  return '#' + rgb.map(x => x.toString(16).padStart(2, '0')).join('');
}

function describeColor(rgb) {
  const [r, g, b] = rgb;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const diff = max - min;
  
  if (r > 190 && g > 190 && b > 190) return 'Branco / Cinza claro';
  if (r < 40 && g < 40 && b < 40) return 'Preto / Cinza escuro';
  if (diff < 20) {
    if (r > 130) return 'Cinza médio';
    return 'Cinza escuro / Grafite';
  }
  
  if (r > g + 25 && r > b + 25) {
    if (g > 100 && b < 70) return 'Laranja / Dourado';
    return 'Vermelho / Vinho';
  }
  if (b > r + 20 && b > g + 15) return 'Azul / Azul Marinho';
  if (b > r + 15 && g > r + 15) return 'Azul Celeste / Turquesa';
  if (g > r + 20 && g > b + 20) return 'Verde';
  if (r > 150 && g > 150 && b < 90) return 'Amarelo';
  if (r > 120 && b > 120 && g < 90) return 'Roxo / Magenta';
  return 'Neutro / Misto';
}

async function getStats(filePath) {
  const s = await sharp(filePath).stats();
  const ch = s.channels.map(c => Math.round(c.mean));
  const { data } = await sharp(filePath)
    .resize(50, 50, { fit: 'cover' })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  let r = 0, g = 0, b = 0, count = 0;
  for (let i = 0; i < data.length; i += 3) {
    const red = data[i], green = data[i+1], blue = data[i+2];
    if (red > 240 && green > 240 && blue > 240) continue;
    if (red < 15 && green < 15 && blue < 15) continue;
    r += red; g += green; b += blue;
    count++;
  }
  const domRgb = count === 0 ? [128, 128, 128] : [Math.round(r/count), Math.round(g/count), Math.round(b/count)];
  return {
    ch,
    r_minus_b: ch[0] - ch[2],
    domRgb,
    hex: rgbToHex(domRgb),
    colorDesc: describeColor(domRgb)
  };
}

async function main() {
  const prods = JSON.parse(fs.readFileSync(path.join(__dirname, '../../data/products.json'), 'utf8'));
  const candidatos = [];

  for (const p of prods) {
    if (!p.images || p.images.length <= 1) continue;
    const temSufixo = p.images.some(img => {
      const src = img.source || img.src || '';
      return /\([1-9]\)/.test(src) || /-[1-9]\./.test(src) || /_[1-9]\./.test(src) || /_[1-9]\)/.test(src);
    });
    if (temSufixo) candidatos.push(p);
  }

  const resultados = [];

  for (const p of candidatos) {
    const imgStats = [];
    for (const img of p.images) {
      const full = path.join(process.cwd(), 'public', img.src);
      try {
        const s = await getStats(full);
        imgStats.push({ src: img.src, source: img.source, ...s });
      } catch (e) {
        imgStats.push({ src: img.src, source: img.source, domRgb: [0,0,0], hex: '#000000', colorDesc: 'Desconhecido', ch: [0,0,0], r_minus_b: 0 });
      }
    }

    let maxDeltaE = 0;
    let maxDiffBal = 0;
    const comparacoes = [];

    for (let i = 1; i < imgStats.length; i++) {
      const dE = Number(deltaE(imgStats[0].domRgb, imgStats[i].domRgb).toFixed(1));
      const diffBal = Math.abs(imgStats[0].r_minus_b - imgStats[i].r_minus_b);
      comparacoes.push({ i, dE, diffBal });
      if (dE > maxDeltaE) maxDeltaE = dE;
      if (diffBal > maxDiffBal) maxDiffBal = diffBal;
    }

    let score = Number((maxDeltaE * 1.5 + maxDiffBal).toFixed(1));
    let probabilidade = 'BAIXA (Provável Frente/Verso Legítimo)';
    if (maxDeltaE >= 18 || maxDiffBal >= 20) {
      probabilidade = 'ALTA (Possível Uniforme Diferente)';
    } else if (maxDeltaE >= 12 || maxDiffBal >= 13) {
      probabilidade = 'MÉDIA (Possível Variação/Intruso)';
    }

    resultados.push({
      slug: p.slug,
      nome: p.nome,
      clube: p.clube,
      liga: p.liga,
      totalImgs: p.images.length,
      maxDeltaE,
      maxDiffBal,
      score,
      probabilidade,
      imgStats,
      comparacoes
    });
  }

  resultados.sort((a, b) => b.score - a.score);

  const altas = resultados.filter(r => r.probabilidade.startsWith('ALTA'));
  const medias = resultados.filter(r => r.probabilidade.startsWith('MÉDIA'));
  const baixas = resultados.filter(r => r.probabilidade.startsWith('BAIXA'));

  console.log('Total analisados em 7-B:', resultados.length);
  console.log('ALTA probabilidade de mistura:', altas.length);
  console.log('MÉDIA probabilidade de mistura:', medias.length);
  console.log('BAIXA probabilidade (Legítimas):', baixas.length);

  fs.writeFileSync(path.join(__dirname, '../../relatorios/analise_7b_candidatos_mistura.json'), JSON.stringify({
    total: resultados.length,
    altas: altas.length,
    medias: medias.length,
    baixas: baixas.length,
    itens: resultados
  }, null, 2));

  console.log('\nTop 15 com maior probabilidade de mistura:');
  resultados.slice(0, 15).forEach((r, idx) => {
    console.log(`[${idx+1}] ${r.nome} (${r.slug}) | dE: ${r.maxDeltaE} | diffBal: ${r.maxDiffBal} | score: ${r.score} | [${r.probabilidade}]`);
    r.imgStats.forEach((im, i) => console.log(`     img${i}: ${im.source} | RGB: [${im.domRgb.join(',')}] | ${im.hex} (${im.colorDesc})`));
  });
}

main().catch(console.error);

