const fs = require('fs');
const path = require('path');

const comp = require('./comparativo_detalhado.json');
const candidatos = require('./candidatos_analise.json');
const sitemapProd = require('./sitemap_prod_parsed.json');
const supabaseDump = require('./supabase_dump.json');

// 1. diferencas-producao-vs-codigo-novo.csv
let csvDiff = 'tipo_diferenca,slug,id,nome,origem,motivo\n';

for (const slug of comp.inProdNotNew) {
  const match = supabaseDump.find(r => r.slug === slug);
  const id = match ? match.id : '';
  const nome = match ? (match.nome || '') : '';
  const isF1 = slug.includes('f1') || slug.includes('formula');
  const motivo = isF1
    ? 'F1 antigo no Supabase com fotos photo.yupoo.com; nao passa no filtro server-side (liga=revisar)'
    : 'Produto em producao ausente no codigo novo';
  csvDiff += `"existe_apenas_em_producao","${slug}","${id}","${nome.replace(/"/g, '""')}","Supabase (revisar)","${motivo}"\n`;
}

for (const item of comp.inNewNotProd) {
  csvDiff += `"existe_apenas_no_codigo_novo","${item.slug}","","${(item.nome || '').replace(/"/g, '""')}","${item.fonte}","Novo produto cadastrado localmente ou no cache que ainda nao foi para o sitemap de producao"\n`;
}

fs.writeFileSync(path.join(process.cwd(), 'relatorios', 'diferencas-producao-vs-codigo-novo.csv'), csvDiff, 'utf8');
console.log('CSV salvo: relatorios/diferencas-producao-vs-codigo-novo.csv');

// 2. candidatos-a-subir.csv
let csvCand = 'id,yupoo_id,clube_provavel,titulo,qtd_fotos,motivo_bloqueio\n';
for (const c of candidatos) {
  const safeTitulo = String(c.titulo || '').replace(/"/g, '""');
  const safeMotivo = String(c.motivo_bloqueio || '').replace(/"/g, '""');
  csvCand += `"${c.id}","${c.yupoo_id || ''}","${c.clube_provavel}","${safeTitulo}",${c.qtd_fotos},"${safeMotivo}"\n`;
}

fs.writeFileSync(path.join(process.cwd(), 'relatorios', 'candidatos-a-subir.csv'), csvCand, 'utf8');
console.log('CSV salvo: relatorios/candidatos-a-subir.csv');

