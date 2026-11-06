const fs = require('fs');
const path = require('path');
const { safeFetch } = require('./seguro_fetch');

async function main() {
  console.log('=== BAIXANDO SITEMAP DE PRODUÇÃO (GET https://www.importsalves.com.br/sitemap.xml) ===');
  const res = await safeFetch('https://www.importsalves.com.br/sitemap.xml');
  console.log(`Status HTTP: ${res.status}`);
  if (!res.ok) {
    throw new Error(`Falha ao baixar sitemap: HTTP ${res.status}`);
  }
  const xml = await res.text();
  fs.writeFileSync(path.join(process.cwd(), 'scripts', 'consulta', 'sitemap_prod.xml'), xml);
  console.log(`Sitemap baixado (${xml.length} bytes).`);

  // Extrair URLs com regex
  const urls = [];
  const regex = /<loc>(https?:\/\/[^<]+)<\/loc>/g;
  let match;
  while ((match = regex.exec(xml)) !== null) {
    urls.push(match[1]);
  }
  console.log(`Total de URLs no sitemap: ${urls.length}`);

  // Categorizar URLs
  const produtos = [];
  const ligas = [];
  const clubes = [];
  const institucionais = [];
  const outros = [];

  for (const url of urls) {
    const pathname = new URL(url).pathname;
    if (pathname.startsWith('/produto/')) {
      const slug = pathname.replace('/produto/', '').replace(/\/$/, '');
      produtos.push({ url, slug });
    } else if (pathname.startsWith('/ligas/')) {
      const parts = pathname.replace('/ligas/', '').replace(/\/$/, '').split('/');
      if (parts.length === 1) {
        ligas.push({ url, liga: parts[0] });
      } else if (parts.length >= 2) {
        clubes.push({ url, liga: parts[0], clube: parts[1] });
      }
    } else {
      institucionais.push({ url, path: pathname });
    }
  }

  console.log(`\nCategorização do Sitemap de Produção:`);
  console.log(`- URLs de Produtos (/produto/*): ${produtos.length}`);
  console.log(`- URLs de Ligas (/ligas/*): ${ligas.length}`);
  console.log(`- URLs de Clubes (/ligas/*/*): ${clubes.length}`);
  console.log(`- URLs Institucionais / Home / Outras: ${institucionais.length}`);

  fs.writeFileSync(
    path.join(process.cwd(), 'scripts', 'consulta', 'sitemap_prod_parsed.json'),
    JSON.stringify({ total: urls.length, produtos, ligas, clubes, institucionais }, null, 2)
  );
  console.log('URLs analisadas e salvas em scripts/consulta/sitemap_prod_parsed.json.');
}

main().catch(console.error);

