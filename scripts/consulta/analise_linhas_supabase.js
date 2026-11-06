const fs = require('fs');
const path = require('path');

const dump = require('./supabase_dump.json');

console.log(`=== ANÁLISE COMPLETA DAS ${dump.length} LINHAS DO SUPABASE ===`);

// 1. Por liga
const porLiga = {};
for (const r of dump) {
  const l = r.liga || 'nulo/vazio';
  porLiga[l] = (porLiga[l] || 0) + 1;
}
console.log('\n1. Contagem por Liga:', porLiga);

// 2. Por tipo
const porTipo = {};
for (const r of dump) {
  const t = r.tipo || 'nulo/vazio';
  porTipo[t] = (porTipo[t] || 0) + 1;
}
console.log('\n2. Contagem por Tipo:', porTipo);

// 3. Por prefixo de yupoo_id
const porPrefixoYupoo = {};
for (const r of dump) {
  const yid = String(r.yupoo_id || '');
  let p = 'vazio';
  if (yid.startsWith('manual:')) p = 'manual:';
  else if (yid.startsWith('nba:')) p = 'nba:';
  else if (/^\d+$/.test(yid)) p = 'numérico';
  else p = 'outro: ' + yid.slice(0, 10);
  porPrefixoYupoo[p] = (porPrefixoYupoo[p] || 0) + 1;
}
console.log('\n3. Contagem por Prefixo de yupoo_id:', porPrefixoYupoo);

// 4. Imagens: Storage do Supabase x Externa (photo.yupoo.com) x Sem Imagem
let comStorageSupabase = 0;
let comYupooExterna = 0;
let semImagem = 0;
let imagemOutra = 0;

for (const r of dump) {
  const imgs = Array.isArray(r.images) ? r.images : [];
  if (imgs.length === 0) {
    semImagem++;
    continue;
  }
  const firstSrc = typeof imgs[0] === 'string' ? imgs[0] : (imgs[0]?.src || '');
  if (firstSrc.includes('.supabase.co/storage')) {
    comStorageSupabase++;
  } else if (firstSrc.includes('photo.yupoo.com') || firstSrc.includes('images.yupoo.com') || firstSrc.includes('yupoo.com')) {
    comYupooExterna++;
  } else {
    imagemOutra++;
  }
}

console.log('\n4. Origem das Imagens:');
console.log(`- Supabase Storage: ${comStorageSupabase}`);
console.log(`- Yupoo Externa (photo.yupoo.com): ${comYupooExterna}`);
console.log(`- Sem Imagem: ${semImagem}`);
console.log(`- Outro Host: ${imagemOutra}`);

// 5. Preço preenchido (> 0)
let comPreco = 0;
let semPreco = 0;
for (const r of dump) {
  const p = Number(r.preco);
  if (Number.isFinite(p) && p > 0) comPreco++;
  else semPreco++;
}
console.log(`\n5. Preço: Com Preço (>0): ${comPreco} | Sem Preço (<=0 ou nulo): ${semPreco}`);

// 6. Tamanhos preenchidos
let comTamanhos = 0;
let semTamanhos = 0;
for (const r of dump) {
  const t = Array.isArray(r.tamanhos) ? r.tamanhos : [];
  if (t.length > 0) comTamanhos++;
  else semTamanhos++;
}
console.log(`6. Tamanhos: Com Tamanhos: ${comTamanhos} | Sem Tamanhos: ${semTamanhos}`);

// 7. Título preenchido
let comNome = 0;
let semNome = 0;
for (const r of dump) {
  const n = String(r.nome || '').trim();
  if (n) comNome++;
  else semNome++;
}
console.log(`7. Nome/Título: Preenchido: ${comNome} | Vazio: ${semNome}`);

// 8. Análise das linhas com liga "revisar" (5.075 linhas)
console.log('\n=== ANÁLISE DAS 5.075 LINHAS COM LIGA "REVISAR" ===');
const linhasRevisar = dump.filter(r => r.liga === 'revisar');

let revisarComDadosCompletos = 0; // nome, >=1 imagem, preco > 0
for (const r of linhasRevisar) {
  const temNome = Boolean(String(r.nome || '').trim());
  const temImgs = Array.isArray(r.images) && r.images.length > 0;
  const temPreco = Number(r.preco) > 0;
  if (temNome && temImgs && temPreco) revisarComDadosCompletos++;
}
console.log(`Linhas "revisar" com Nome + Imagem + Preço > 0: ${revisarComDadosCompletos}`);

let revisarPrecoZero = 0;
for (const r of linhasRevisar) {
  if (!Number(r.preco) || Number(r.preco) <= 0) revisarPrecoZero++;
}
console.log(`Linhas "revisar" com Preço Zero / R$ 0,00: ${revisarPrecoZero}`);

// Amostra de 15 linhas "revisar"
const amostra15 = linhasRevisar.slice(0, 15).map(r => ({
  id: r.id,
  yupoo_id: r.yupoo_id,
  nome: r.nome,
  preco: r.preco,
  qtd_imagens: Array.isArray(r.images) ? r.images.length : 0,
  primeira_imagem: Array.isArray(r.images) && r.images[0] ? (typeof r.images[0] === 'string' ? r.images[0] : r.images[0].src) : null,
}));
console.log('\nAmostra de 15 itens "revisar":');
console.table(amostra15.map(a => ({ id: a.id, nome: a.nome ? a.nome.slice(0, 40) : '', preco: a.preco, imgs: a.qtd_imagens })));

// Motivos de não publicação no código atual
// No código atual, isPublishedProduct exige:
// 1. oculto !== true
// 2. Não ser jaqueta de F1
// 3. hasStorefrontImages (todas as fotos não podem ser photo.yupoo.com, exceto se for F1)
// 4. product.tipo !== 'revisar' (ou ser NBA ou ser Retrô)
// 5. product.publico !== 'revisar' (ou ser NBA ou ser Retrô ou F1)
const motivosNaoPublicacao = {
  'Fotos no Yupoo externo (bloqueadas por hasStorefrontImages)': 0,
  'Tipo "revisar" (não categorizado)': 0,
  'Público "revisar" (não categorizado)': 0,
  'Preço R$ 0,00': 0,
};

for (const r of linhasRevisar) {
  const imgs = Array.isArray(r.images) ? r.images : [];
  const temFotoYupoo = imgs.some(img => {
    const src = typeof img === 'string' ? img : (img?.src || '');
    return src.includes('yupoo.com');
  });
  if (temFotoYupoo) motivosNaoPublicacao['Fotos no Yupoo externo (bloqueadas por hasStorefrontImages)']++;
  if (r.tipo === 'revisar') motivosNaoPublicacao['Tipo "revisar" (não categorizado)']++;
  if (r.publico === 'revisar') motivosNaoPublicacao['Público "revisar" (não categorizado)']++;
  if (!Number(r.preco) || Number(r.preco) <= 0) motivosNaoPublicacao['Preço R$ 0,00']++;
}
console.log('\nMotivos de Não Publicação das 5.075 linhas revisar:');
console.log(motivosNaoPublicacao);

// 9. Candidatos a "produto que falta subir"
// Linhas que têm fotos Yupoo válidas, títulos com clubes/seleções/marcas conhecidas (ex: Real Madrid, Barcelona, Brasil, Palmeiras, Nike, Jordan, etc.)
// mas que estão presas com liga='revisar', tipo='revisar', preco=0 e fotos externas
const candidatos = [];
const clubKeywords = [
  'flamengo', 'palmeiras', 'corinthians', 'sao paulo', 'santos', 'gremio', 'internacional', 'vasco', 'cruzeiro', 'atletico mineiro', 'fluminense', 'botafogo',
  'real madrid', 'barcelona', 'bayern', 'manchester united', 'manchester city', 'liverpool', 'arsenal', 'chelsea', 'psg', 'juventus', 'milan', 'inter',
  'brasil', 'argentina', 'franca', 'alemanha', 'italia', 'portugal', 'inglaterra', 'espanha', 'holanda', 'japao',
  'lakers', 'celtics', 'bulls', 'warriors', 'nets', 'heat', 'bucks',
];

for (const r of linhasRevisar) {
  const nomeLower = String(r.nome || '').toLowerCase();
  const matchedClub = clubKeywords.find(kw => nomeLower.includes(kw));
  if (matchedClub && Array.isArray(r.images) && r.images.length > 0) {
    candidatos.push({
      id: r.id,
      yupoo_id: r.yupoo_id,
      titulo: r.nome,
      clube_provavel: matchedClub,
      qtd_fotos: r.images.length,
      motivo_bloqueio: 'Liga/tipo/público como "revisar", preço 0 e imagens em photo.yupoo.com (exige upload para Storage)',
    });
  }
}

console.log(`\nTotal de Candidatos a "produto que falta subir" identificados por palavras-chave: ${candidatos.length}`);
console.log('Amostra de 10 candidatos:');
console.table(candidatos.slice(0, 10).map(c => ({ id: c.id, clube: c.clube_provavel, titulo: c.titulo.slice(0, 40), fotos: c.qtd_fotos })));

fs.writeFileSync(path.join(process.cwd(), 'scripts', 'consulta', 'candidatos_analise.json'), JSON.stringify(candidatos, null, 2));

