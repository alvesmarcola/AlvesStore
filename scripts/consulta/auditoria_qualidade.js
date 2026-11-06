const fs = require('fs');
const path = require('path');

const productsJson = require('../../data/products.json');
const f1Json = require('../../data/f1-products.json');
const cacheJson = require('../../data/supabase-products-cache.json');

const allProducts = [...productsJson, ...f1Json, ...cacheJson];
console.log(`=== AUDITORIA DE QUALIDADE DO CATÁLOGO (${allProducts.length} PRODUTOS ATIVOS) ===`);

const problemas = [];

// 1. Slugs duplicados
const slugCount = {};
for (const p of allProducts) {
  slugCount[p.slug] = (slugCount[p.slug] || 0) + 1;
}
for (const [slug, count] of Object.entries(slugCount)) {
  if (count > 1) {
    problemas.push({
      tipo: 'slug_duplicado',
      slug,
      descricao: `Slug aparece ${count} vezes no catálogo ativo`,
    });
  }
}

// 2. Títulos com repetição ("Casa – Casa", "Home - Home", "Titular Titular", "Away Away")
const regexRepeticao = /\b(casa|home|titular|away|reserva|third|terceiro)\b[^\w\n\r]*\b\1\b/i;
for (const p of allProducts) {
  const nome = p.nome || '';
  if (regexRepeticao.test(nome) || /casa\s*[-–]\s*casa/i.test(nome) || /titular\s*[-–]\s*titular/i.test(nome)) {
    problemas.push({
      tipo: 'titulo_com_repeticao',
      slug: p.slug,
      id: p.id,
      detalhe: nome,
      descricao: 'Título contém repetição de termo de uniforme/versão',
    });
  }
}

// 3. Caracteres "?" nos textos alternativos (alts das imagens)
for (const p of allProducts) {
  const imgs = p.images || [];
  for (const img of imgs) {
    const alt = typeof img === 'object' ? (img.alt || '') : '';
    if (alt.includes('?')) {
      problemas.push({
        tipo: 'interrogacao_no_alt',
        slug: p.slug,
        id: p.id,
        detalhe: alt,
        descricao: 'Texto alternativo da imagem contém caractere de interrogação (?)',
      });
      break;
    }
  }
}

// 4. Produtos sem imagem ou sem preço
for (const p of allProducts) {
  const imgs = p.images || [];
  if (imgs.length === 0) {
    problemas.push({
      tipo: 'sem_imagem',
      slug: p.slug,
      id: p.id,
      detalhe: p.nome,
      descricao: 'Produto sem imagens cadastradas',
    });
  }
  const preco = Number(p.preco);
  if (!Number.isFinite(preco) || preco <= 0) {
    problemas.push({
      tipo: 'sem_preco',
      slug: p.slug,
      id: p.id,
      detalhe: `Preço: ${p.preco}`,
      descricao: 'Produto com preço <= 0 ou inválido',
    });
  }
}

// 5. Nomes de liga inconsistentes
const ligasValidas = new Set([
  'brasileirao-serie-a', 'bundesliga', 'eredivisie', 'f1', 'la-liga', 'liga-portugal',
  'ligue-1', 'mls', 'nba', 'premier-league', 'saudi-pro-league', 'scottish-premiership',
  'selecoes', 'serie-a', 'teste', 'revisar'
]);
for (const p of allProducts) {
  if (!ligasValidas.has(p.liga)) {
    problemas.push({
      tipo: 'liga_inconsistente',
      slug: p.slug,
      id: p.id,
      detalhe: `Liga: "${p.liga}"`,
      descricao: 'Liga não padronizada nas rotas',
    });
  }
}

// 6. Kits infantis com rótulo de "manga longa"
for (const p of allProducts) {
  const isInfantil = p.publico === 'infantil' || (p.nome && /infantil|kids/i.test(p.nome));
  const hasMangaLonga = p.nome && /manga[-\s]*longa/i.test(p.nome);
  if (isInfantil && hasMangaLonga) {
    problemas.push({
      tipo: 'infantil_com_manga_longa',
      slug: p.slug,
      id: p.id,
      detalhe: p.nome,
      descricao: 'Kit infantil com rótulo de manga longa',
    });
  }
}

// 7. Produtos duplicados prováveis (mesmo time, mesma temporada e mesmo uniforme/versão)
const grouped = {};
for (const p of allProducts) {
  const key = `${p.clubeSlug || p.clube}_${p.temporada}_${p.uniforme}_${p.tipo}_${p.publico}`;
  if (!grouped[key]) grouped[key] = [];
  grouped[key].push(p);
}
for (const [key, list] of Object.entries(grouped)) {
  if (list.length > 1 && !key.includes('revisar')) {
    problemas.push({
      tipo: 'duplicado_provavel',
      slug: list.map(x => x.slug).join(' | '),
      id: list.map(x => x.id).join(' | '),
      detalhe: key,
      descricao: `${list.length} produtos com mesmo time, temporada, uniforme, tipo e público`,
    });
  }
}

console.log(`\nTotal de problemas identificados: ${problemas.length}`);
const porTipoProblema = {};
for (const p of problemas) {
  porTipoProblema[p.tipo] = (porTipoProblema[p.tipo] || 0) + 1;
}
console.log('Resumo por tipo de problema:', porTipoProblema);

fs.writeFileSync(path.join(process.cwd(), 'scripts', 'consulta', 'problemas_qualidade.json'), JSON.stringify(problemas, null, 2));

// Gerar CSV de problemas de qualidade: relatorios/problemas-de-qualidade.csv
let csv = 'tipo_problema,id,slug,detalhe,descricao\n';
for (const p of problemas) {
  const safeDetalhe = String(p.detalhe || '').replace(/"/g, '""');
  const safeDesc = String(p.descricao || '').replace(/"/g, '""');
  csv += `"${p.tipo}","${p.id || ''}","${p.slug || ''}","${safeDetalhe}","${safeDesc}"\n`;
}
fs.writeFileSync(path.join(process.cwd(), 'relatorios', 'problemas-de-qualidade.csv'), csv, 'utf8');
console.log('CSV salvo em relatorios/problemas-de-qualidade.csv');

