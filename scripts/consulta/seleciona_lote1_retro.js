const fs = require('fs');
const path = require('path');

const candidatosCsv = fs.readFileSync(path.join(__dirname, '../../relatorios/candidatos-a-subir.csv'), 'utf8');
const lines = candidatosCsv.split('\n').filter(l => l.trim().length > 0);

const clubesEuropeus = new Set([
  'real madrid', 'barcelona', 'milan', 'inter', 'arsenal', 
  'manchester city', 'manchester united', 'chelsea', 'liverpool', 
  'bayern', 'borussia dortmund', 'psg', 'juventus', 'roma', 'atletico madrid'
]);

const lote1 = [];

for (let i = 1; i < lines.length; i++) {
  const line = lines[i];
  const parts = [];
  let inQuotes = false;
  let current = '';
  for (let c = 0; c < line.length; c++) {
    const char = line[c];
    if (char === '"') inQuotes = !inQuotes;
    else if (char === ',' && !inQuotes) { parts.push(current); current = ''; }
    else current += char;
  }
  parts.push(current);

  if (parts.length >= 5) {
    const id = parts[0].replace(/"/g, '').trim();
    const yupoo_id = parts[1].replace(/"/g, '').trim();
    const clube = parts[2].replace(/"/g, '').trim().toLowerCase();
    const titulo = parts[3].replace(/"/g, '').trim();
    const qtd_fotos = parseInt(parts[4].replace(/"/g, '').trim(), 10) || 0;

    const tLower = titulo.toLowerCase();
    const isRetro = tLower.includes('retro');
    const isEuropeu = clubesEuropeus.has(clube);
    const semAgasalho = !tLower.includes('jacket') && !tLower.includes('suit') && !tLower.includes('pants');

    if (isRetro && isEuropeu && semAgasalho && qtd_fotos >= 10) {
      lote1.push({ id, yupoo_id, clube, titulo, qtd_fotos });
      if (lote1.length === 100) break;
    }
  }
}

console.log('Total selecionado para o Lote 1 Retrô Europeu:', lote1.length);
console.log('Amostra dos 10 primeiros do Lote 1:');
console.log(lote1.slice(0, 10));

const porClube = {};
for (const p of lote1) porClube[p.clube] = (porClube[p.clube] || 0) + 1;
console.log('\nDistribuição por clube no Lote 1:', porClube);

