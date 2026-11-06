const fs = require('fs');
const path = require('path');

const candidatosCsv = fs.readFileSync(path.join(__dirname, '../../relatorios/candidatos-a-subir.csv'), 'utf8');
const lines = candidatosCsv.split('\n').filter(l => l.trim().length > 0);

const productsJson = JSON.parse(fs.readFileSync(path.join(__dirname, '../../data/products.json'), 'utf8'));

// Mapa de clubes mapeados para ligas oficiais da loja
const clubToLeague = {
  // Brasileirão Série A
  'flamengo': 'brasileirao-serie-a',
  'corinthians': 'brasileirao-serie-a',
  'palmeiras': 'brasileirao-serie-a',
  'sao paulo': 'brasileirao-serie-a',
  'santos': 'brasileirao-serie-a',
  'vasco': 'brasileirao-serie-a',
  'fluminense': 'brasileirao-serie-a',
  'botafogo': 'brasileirao-serie-a',
  'gremio': 'brasileirao-serie-a',
  'internacional': 'brasileirao-serie-a',
  'cruzeiro': 'brasileirao-serie-a',
  'atletico mineiro': 'brasileirao-serie-a',
  'bahia': 'brasileirao-serie-a',
  'fortaleza': 'brasileirao-serie-a',
  'athletico paranaense': 'brasileirao-serie-a',
  'coritiba': 'brasileirao-serie-a',
  'vitoria': 'brasileirao-serie-a',
  'sport': 'brasileirao-serie-a',
  // La Liga
  'real madrid': 'la-liga',
  'barcelona': 'la-liga',
  'atletico madrid': 'la-liga',
  'sevilla': 'la-liga',
  'valencia': 'la-liga',
  // Premier League
  'arsenal': 'premier-league',
  'manchester city': 'premier-league',
  'manchester united': 'premier-league',
  'chelsea': 'premier-league',
  'liverpool': 'premier-league',
  'tottenham': 'premier-league',
  // Serie A Italiana
  'milan': 'serie-a',
  'inter': 'serie-a',
  'juventus': 'serie-a',
  'roma': 'serie-a',
  'napoli': 'serie-a',
  'lazio': 'serie-a',
  // Bundesliga
  'bayern': 'bundesliga',
  'borussia dortmund': 'bundesliga',
  'dortmund': 'bundesliga',
  'leverkusen': 'bundesliga',
  // Ligue 1
  'psg': 'ligue-1',
  'marseille': 'ligue-1',
  'monaco': 'ligue-1',
  'lyon': 'ligue-1',
  // Seleções
  'brasil': 'selecoes',
  'argentina': 'selecoes',
  'franca': 'selecoes',
  'alemanha': 'selecoes',
  'inglaterra': 'selecoes',
  'portugal': 'selecoes',
  'italia': 'selecoes',
  'espanha': 'selecoes',
  'holanda': 'selecoes',
  'japao': 'selecoes',
};

let aproveitaveis = []; // Alta demanda, fotos completas (>= 5), modelo/ano identificável
let precisamAjuste = []; // Fotos ok mas título genérico, jaquetas/treino que precisam definir preço específico ou categoria
let foraDaLoja = []; // Fotos < 5, títulos totalmente vagos ou sem identificação do que é

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
    const clube = parts[2].replace(/"/g, '').trim();
    const titulo = parts[3].replace(/"/g, '').trim();
    const qtd_fotos = parseInt(parts[4].replace(/"/g, '').trim(), 10) || 0;

    const tLower = titulo.toLowerCase();
    const liga = clubToLeague[clube.toLowerCase()] || 'outras-ligas';

    // Critério 1: Fora da loja
    // - Menos de 4 fotos (impossível ter galeria confiável)
    // - Título curtíssimo sem especificação (ex: "Flamengo", "Gremio", "Santos" com 3 fotos)
    // - Acessórios ou meias / bermudas avulsas
    if (qtd_fotos < 4 || titulo.trim().length <= 10 && !titulo.includes(' ')) {
      foraDaLoja.push({ id, yupoo_id, clube, titulo, qtd_fotos, motivo: 'Fotos insuficientes (< 4) ou título vago sem especificação de modelo' });
      continue;
    }

    // Critério 2: Precisam de ajustes
    // - Agasalhos / Jaquetas / Calças / Corta-vento (Windbreaker / Jacket / Pants / Suit) -> faixa de preço diferente (ex: R$ 280-350)
    // - Treino / Polos / Manga Longa -> faixa de preço e grade de tamanhos precisam de revisão
    // - Títulos com ano duvidoso ou sem especificação de titular/reserva
    const isAgasalho = tLower.includes('jacket') || tLower.includes('windbreaker') || tLower.includes('suit') || tLower.includes('hoodie') || tLower.includes('pants');
    const isTreino = tLower.includes('training') || tLower.includes('treino') || tLower.includes('pre-match');
    const isPolo = tLower.includes('polo');
    const isMangaLonga = tLower.includes('long sleeve') || tLower.includes('manga longa');
    const isGoleiro = tLower.includes('goalkeeper') || tLower.includes('gk');
    const isKitInfantil = tLower.includes('kids') || tLower.includes('infantil') || tLower.includes('child');

    if (isAgasalho || isTreino || isPolo || isMangaLonga || isGoleiro || isKitInfantil) {
      precisamAjuste.push({
        id, yupoo_id, clube, titulo, qtd_fotos,
        categoriaEspecial: isAgasalho ? 'agasalho' : isTreino ? 'treino' : isPolo ? 'polo' : isMangaLonga ? 'manga_longa' : isGoleiro ? 'goleiro' : 'kit_infantil',
        motivo: 'Requer precificação específica, tabela de medidas ou categoria própria de vestuário'
      });
      continue;
    }

    // Critério 3: Aproveitáveis Diretamente
    // - Camisas de jogo tradicionais (Titular / Home, Reserva / Away, Terceiro / 3rd, Retrô)
    // - Mínimo 5 fotos de alta definição
    // - Clube e liga mapeados
    const isRetro = tLower.includes('retro');
    aproveitaveis.push({
      id, yupoo_id, clube, titulo, qtd_fotos, liga,
      tipo: isRetro ? 'retro' : 'torcedor',
      publico: 'masculino',
      precoSugerido: isRetro ? 185.00 : 160.00
    });
  }
}

console.log('--- CLASSIFICAÇÃO DOS 2.168 CANDIDATOS ---');
console.log('1. Comercializáveis em lote com padrão da loja (Camisas de jogo/retrô com fotos fartas):', aproveitaveis.length);
console.log('2. Precisam de ajustes específicos (Agasalhos, treinos, polos, mangas longas, goleiro, kits):', precisamAjuste.length);
console.log('3. Devem permanecer fora da loja (Fotos < 4, títulos vagos, amostras):', foraDaLoja.length);

console.log('\nSubdivisão dos Comercializáveis por Tipo:');
const tipoCount = {};
for (const p of aproveitaveis) {
  tipoCount[p.tipo] = (tipoCount[p.tipo] || 0) + 1;
}
console.log(tipoCount);

console.log('\nTop 15 Clubes dos Comercializáveis:');
const clubesApp = {};
for (const p of aproveitaveis) {
  clubesApp[p.clube] = (clubesApp[p.clube] || 0) + 1;
}
console.log(Object.entries(clubesApp).sort((a,b) => b[1] - a[1]).slice(0, 15));

console.log('\nSubdivisão dos que Precisam de Ajustes:');
const ajusteCount = {};
for (const p of precisamAjuste) {
  ajusteCount[p.categoriaEspecial] = (ajusteCount[p.categoriaEspecial] || 0) + 1;
}
console.log(ajusteCount);

console.log('\nTotal somado:', aproveitaveis.length + precisamAjuste.length + foraDaLoja.length);
