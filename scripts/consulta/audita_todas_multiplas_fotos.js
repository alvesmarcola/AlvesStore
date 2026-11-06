const fs = require('fs');
const path = require('path');

const products = JSON.parse(fs.readFileSync(path.join(__dirname, '../../data/products.json'), 'utf8'));

console.log('--- AUDITORIA DE TODOS OS PRODUTOS COM MÚLTIPLAS FOTOS ---');

const mixedCandidates = [];

for (const p of products) {
  if (!p.images || p.images.length <= 1) continue;

  const sources = p.images.map(img => img.source || '');
  const srcs = p.images.map(img => img.src || '');

  // Verificar se as fontes indicam claramente uniformes ou arquivos separados
  // Ex: arquivo(1).jpg, arquivo.jpg, ou nomes contendo variações
  const filenames = sources.map(s => path.basename(s));
  
  // Vamos analisar cada par ou conjunto de imagens
  mixedCandidates.push({
    slug: p.slug,
    nome: p.nome,
    clube: p.clube,
    liga: p.liga,
    publico: p.publico,
    tipo: p.tipo,
    uniforme: p.uniforme,
    totalImages: p.images.length,
    filenames,
    srcs
  });
}

console.log('Total de produtos com múltiplas imagens:', mixedCandidates.length);

// Categorizar por tipo/publico
const porPublico = {};
for (const c of mixedCandidates) {
  porPublico[c.publico] = (porPublico[c.publico] || 0) + 1;
}
console.log('Distribuição por público:', porPublico);

const porTipo = {};
for (const c of mixedCandidates) {
  porTipo[c.tipo] = (porTipo[c.tipo] || 0) + 1;
}
console.log('Distribuição por tipo:', porTipo);

fs.writeFileSync(
  path.join(__dirname, '../../relatorios/produtos_com_multiplas_imagens_detalhado.json'),
  JSON.stringify(mixedCandidates, null, 2)
);

