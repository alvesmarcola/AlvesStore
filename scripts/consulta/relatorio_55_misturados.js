const fs = require('fs');
const path = require('path');

const misturados = JSON.parse(fs.readFileSync(path.join(__dirname, '../../relatorios/produtos_fotos_misturadas.json'), 'utf8'));

console.log('--- RELATÓRIO COMPLETO DOS 55 PRODUTOS COM FOTOS MISTURADAS ---');
for (const [i, p] of misturados.entries()) {
  console.log(`${i + 1}. [Dist: ${p.colorDistance}] ${p.nome} (${p.slug})`);
  console.log(`   Uniforme anunciado: ${p.uniforme} | Público: ${p.publico} | Tipo: ${p.tipo}`);
  console.log(`   Foto 1: ${p.img0.source}`);
  console.log(`   Foto 2: ${p.img1.source}`);
}

