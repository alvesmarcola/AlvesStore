const { safeFetch } = require('./seguro_fetch');

async function countCardsInPage(url) {
  try {
    const res = await safeFetch(url);
    if (!res.ok) return { url, status: res.status, cards: 0 };
    const html = await res.text();
    // Procurar por links de produtos: href="/produto/[slug]"
    const matches = html.match(/href="\/produto\/[^"]+"/g) || [];
    const uniqueSlugs = new Set(matches.map(m => m.replace('href="/produto/', '').replace('"', '')));
    return { url, status: res.status, cards: uniqueSlugs.size, slugs: Array.from(uniqueSlugs) };
  } catch (err) {
    return { url, error: err.message, cards: 0 };
  }
}

async function main() {
  console.log('=== CONTAGEM DE CARDS NAS PÁGINAS DE PRODUÇÃO (GET) ===');
  const targets = [
    'https://www.importsalves.com.br/ligas/brasileirao-serie-a',
    'https://www.importsalves.com.br/ligas/premier-league',
    'https://www.importsalves.com.br/ligas/la-liga',
    'https://www.importsalves.com.br/f1',
    'https://www.importsalves.com.br/masculino',
  ];

  for (const t of targets) {
    const res = await countCardsInPage(t);
    console.log(`${t}: status ${res.status || 'erro'} -> ${res.cards} cards de produto encontrados.`);
  }
}

main().catch(console.error);

