const fs = require('fs');
const path = require('path');

const products = JSON.parse(fs.readFileSync(path.join(__dirname, '../../data/products.json'), 'utf8'));

// Vamos listar todos os produtos que possuem múltiplas fotos onde o source tem (1), (2), etc.
const multipleImages = [];

for (const p of products) {
  if (p.images && p.images.length > 1) {
    const sources = p.images.map(img => img.source || img.src);
    const hasNumberedVariation = sources.some(s => /\(\d+\)/.test(s));
    multipleImages.push({
      id: p.id,
      slug: p.slug,
      nome: p.nome,
      clube: p.clube,
      tipo: p.tipo,
      publico: p.publico,
      count: p.images.length,
      hasNumberedVariation,
      images: p.images.map(img => ({ src: img.src, source: img.source }))
    });
  }
}

console.log('Total de produtos com mais de 1 imagem no catálogo local:', multipleImages.length);
console.log('Produtos com sources contendo (1), (2), etc.:', multipleImages.filter(x => x.hasNumberedVariation).length);

// Salvar relatório para análise
fs.writeFileSync(path.join(__dirname, '../../relatorios/auditoria_multiplas_fotos.json'), JSON.stringify(multipleImages, null, 2));

