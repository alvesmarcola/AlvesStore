const dump = require('./supabase_dump.json');

const matching = dump.filter(p => p.slug === 'teste' || String(p.nome || '').toLowerCase().includes('teste'));
console.log(`Produtos no Supabase que batem em (slug = 'teste' OR nome ILIKE '%teste%'): ${matching.length}`);
for (const m of matching) {
  console.log(`- ID: ${m.id}, YupooID: ${m.yupoo_id}, Slug: ${m.slug}, Nome: ${m.nome}, Preço: ${m.preco}`);
}

