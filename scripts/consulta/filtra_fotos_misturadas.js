const fs = require('fs');
const path = require('path');

const divergencias = JSON.parse(fs.readFileSync(path.join(__dirname, '../../relatorios/analise_divergencia_fotos.json'), 'utf8'));

console.log('Total de produtos com múltiplas fotos analisados:', divergencias.length);

// Classificar por threshold de distância de cor
// Uma distância de cor > 50 geralmente indica cores completamente distintas (ex: Azul vs Branco, Vermelho vs Preto, etc.)
// Distância < 30 indica cores muito próximas (frente e verso da mesma camisa de mesma cor).
const muitoDivergentes = divergencias.filter(d => d.colorDistance >= 50);
const similares = divergencias.filter(d => d.colorDistance < 50);

console.log(`Produtos com fotos visivelmente divergentes (cores distintas >= 50): ${muitoDivergentes.length}`);
console.log(`Produtos com fotos similares (< 50, provavelmente frente/verso da mesma camisa): ${similares.length}`);

// Salvar lista dos muito divergentes
fs.writeFileSync(
  path.join(__dirname, '../../relatorios/produtos_fotos_misturadas.json'),
  JSON.stringify(muitoDivergentes, null, 2)
);

console.log('\nExemplos de produtos com fotos similares (frente e costas da mesma camisa):');
for (const s of similares.slice(0, 10)) {
  console.log(`[Distância: ${s.colorDistance}] ${s.nome} (${s.slug})`);
}

