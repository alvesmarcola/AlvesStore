const d = require('../../relatorios/analise_7b_candidatos_mistura.json');

console.log('Total analisados:', d.total);
console.log('Altas:', d.altas, 'Medias:', d.medias, 'Baixas:', d.baixas);

console.log('\n--- CANDIDATOS COM PROBABILIDADE ALTA OU MÉDIA ---');
d.itens.filter(x => !x.probabilidade.startsWith('BAIXA')).forEach((r, idx) => {
  console.log(`${idx+1}. ${r.nome} (${r.slug}) [${r.probabilidade}]`);
  console.log(`   Clube/País: ${r.clube} | Liga: ${r.liga} | Score: ${r.score} (dE: ${r.maxDeltaE}, diffBal: ${r.maxDiffBal})`);
  r.imgStats.forEach((im, i) => {
    console.log(`     - Img ${i}: ${im.source.split('/').pop()} | Dominante: ${im.hex} (${im.colorDesc}) | RGB: [${im.domRgb.join(',')}]`);
  });
});

