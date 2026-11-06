const fs = require('fs');
const path = require('path');

function getFolderStats(dir) {
  let count = 0;
  let totalBytes = 0;
  if (!fs.existsSync(dir)) return { count: 0, totalBytes: 0 };
  const items = fs.readdirSync(dir);
  for (const item of items) {
    const full = path.join(dir, item);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      const sub = getFolderStats(full);
      count += sub.count;
      totalBytes += sub.totalBytes;
    } else {
      count++;
      totalBytes += stat.size;
    }
  }
  return { count, totalBytes };
}

function findLargeFiles(dir, minBytes = 5 * 1024 * 1024) {
  let large = [];
  const items = fs.readdirSync(dir);
  for (const item of items) {
    if (['node_modules', '.next', '.git'].includes(item)) continue;
    const full = path.join(dir, item);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      large = large.concat(findLargeFiles(full, minBytes));
    } else if (stat.size >= minBytes) {
      large.push({
        file: path.relative(process.cwd(), full).replace(/\\/g, '/'),
        sizeMb: (stat.size / (1024 * 1024)).toFixed(2),
        bytes: stat.size,
      });
    }
  }
  return large;
}

const publicStats = getFolderStats(path.join(process.cwd(), 'public'));
const otimizadasStats = getFolderStats(path.join(process.cwd(), 'public', 'otimizadas'));
const dataStats = getFolderStats(path.join(process.cwd(), 'data'));
const largeFiles = findLargeFiles(process.cwd(), 5 * 1024 * 1024);

console.log('=== PESO DE ARQUIVOS E DIRETÓRIOS ===');
console.log(`public/ total: ${publicStats.count} arquivos, ${(publicStats.totalBytes / (1024 * 1024)).toFixed(2)} MB`);
console.log(`public/otimizadas: ${otimizadasStats.count} arquivos, ${(otimizadasStats.totalBytes / (1024 * 1024)).toFixed(2)} MB`);
console.log(`data/: ${dataStats.count} arquivos, ${(dataStats.totalBytes / (1024 * 1024)).toFixed(2)} MB`);
console.log('\nArquivos com mais de 5 MB no repositório:');
console.table(largeFiles);

// 21. Dependência de imagens
// Quantos produtos e imagens dependem de /api/yupoo-image vs public/ vs Supabase Storage
const productsJson = require('../../data/products.json');
const f1Json = require('../../data/f1-products.json');
const cacheJson = require('../../data/supabase-products-cache.json');
const supabaseDump = require('./supabase_dump.json');

// No código novo montado:
const allCatalog = [...productsJson, ...f1Json, ...cacheJson];
let prodPublic = 0;
let prodSupabaseStorage = 0;
let prodYupooProxy = 0;

let imgPublic = 0;
let imgSupabaseStorage = 0;
let imgYupooProxy = 0;

for (const p of allCatalog) {
  const imgs = p.images || [];
  let usaPublic = false;
  let usaStorage = false;
  let usaYupoo = false;

  for (const img of imgs) {
    const src = typeof img === 'string' ? img : (img?.src || '');
    if (src.startsWith('/') || src.includes('otimizadas/')) {
      imgPublic++;
      usaPublic = true;
    } else if (src.includes('.supabase.co/storage')) {
      imgSupabaseStorage++;
      usaStorage = true;
    } else if (src.includes('yupoo.com') || src.includes('/api/yupoo-image')) {
      imgYupooProxy++;
      usaYupoo = true;
    }
  }

  if (usaPublic) prodPublic++;
  if (usaStorage) prodSupabaseStorage++;
  if (usaYupoo) prodYupooProxy++;
}

console.log('\n=== DEPENDÊNCIA DE IMAGENS NO CATÁLOGO ATIVO (855 itens cadastrados locais + cache) ===');
console.log(`- Imagens em public/ (locais): ${imgPublic} imagens (${prodPublic} produtos)`);
console.log(`- Imagens no Supabase Storage: ${imgSupabaseStorage} imagens (${prodSupabaseStorage} produtos)`);
console.log(`- Imagens dependendo de Yupoo / /api/yupoo-image: ${imgYupooProxy} imagens (${prodYupooProxy} produtos)`);

// E se considerarmos o banco remoto todo (5.198 linhas)?
let dumpYupooImgs = 0;
let dumpStorageImgs = 0;
for (const r of supabaseDump) {
  const imgs = r.images || [];
  for (const img of imgs) {
    const src = typeof img === 'string' ? img : (img?.src || '');
    if (src.includes('.supabase.co/storage')) dumpStorageImgs++;
    else if (src.includes('yupoo.com')) dumpYupooImgs++;
  }
}
console.log(`\nNo banco remoto (5.198 linhas totais):`);
console.log(`- Imagens no Supabase Storage: ${dumpStorageImgs}`);
console.log(`- Imagens no Yupoo externo (photo.yupoo.com): ${dumpYupooImgs}`);

fs.writeFileSync(path.join(process.cwd(), 'scripts', 'consulta', 'stats_arquivos.json'), JSON.stringify({
  publicStats,
  otimizadasStats,
  dataStats,
  largeFiles,
  imagensAtivo: { imgPublic, prodPublic, imgSupabaseStorage, prodSupabaseStorage, imgYupooProxy, prodYupooProxy },
  imagensDump: { dumpStorageImgs, dumpYupooImgs }
}, null, 2));

