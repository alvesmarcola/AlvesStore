const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

async function main() {
  console.log('--- Consultando Produção (GET) para os Kits Infantis ---');

  const headJson = execSync('git show HEAD:data/products.json', { maxBuffer: 50 * 1024 * 1024 }).toString('utf8');
  const prodsHead = JSON.parse(headJson);
  const prodsAtual = JSON.parse(fs.readFileSync(path.join(__dirname, '../../data/products.json'), 'utf8'));

  const mapHead = new Map(prodsHead.map(p => [p.slug, p]));
  const mapAtual = new Map(prodsAtual.map(p => [p.slug, p]));

  // Buscar todos os produtos infantis no catálogo
  function isInfantil(p) {
    const pub = (p.publico || '').toLowerCase();
    const nome = (p.nome || '').toLowerCase();
    const slug = (p.slug || '').toLowerCase();
    return pub.includes('infantil') || pub.includes('kids') ||
           nome.includes('infantil') || nome.includes('kids') ||
           slug.includes('infantil') || slug.includes('kids');
  }

  const todosInfantis = prodsHead.filter(isInfantil);
  console.log(`Total de produtos infantis identificados no catálogo: ${todosInfantis.length}`);

  const resultados = [];

  for (let idx = 0; idx < todosInfantis.length; idx++) {
    const p = todosInfantis[idx];
    const slug = p.slug;
    const url = `https://www.importsalves.com.br/produto/${slug}`;
    console.log(`[${idx + 1}/${todosInfantis.length}] Consultando GET: ${slug}...`);

    let httpStatus = 0;
    let prodImages = [];
    let erroReq = null;

    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AlvesStoreAudit/1.0' },
      });
      httpStatus = res.status;
      if (res.ok) {
        const html = await res.text();

        // Extrai todas as imagens otimizadas daquele produto
        // Padrão: /otimizadas/<slug>/<arquivo> dentro de src ou srcset ou decodeURIComponent
        const regexOtimizadas = new RegExp(`(?:%2F|/)otimizadas(?:%2F|/)${slug}(?:%2F|/)([0-9]{2}-[0-9]+\\.webp)`, 'gi');
        const matches = [...html.matchAll(regexOtimizadas)];
        const arqsUnicos = new Set();
        for (const m of matches) {
          arqsUnicos.add(m[1]);
        }
        prodImages = Array.from(arqsUnicos).sort();

        // Se não achou por regex direto, tenta buscar qualquer img do produto
        if (prodImages.length === 0) {
          const imgTags = [...html.matchAll(/<img[^>]+>/gi)].map(m => m[0]);
          for (const tag of imgTags) {
            if (tag.includes(slug)) {
              const srcMatch = tag.match(/src="([^"]+)"/i);
              if (srcMatch) prodImages.push(srcMatch[1]);
            }
          }
        }
      }
    } catch (err) {
      erroReq = err.message;
    }

    const headProd = mapHead.get(slug);
    const atualProd = mapAtual.get(slug);

    const headImgs = headProd ? headProd.images.map(i => i.src.split('/').pop()) : [];
    const atualImgs = atualProd ? atualProd.images.map(i => i.src.split('/').pop()) : [];

    // Produção mostra quantas fotos?
    // Note que cada imagem do produto no site gera variantes 800, 400 etc. O que importa é o prefixo numérico (ex: 01, 02)
    const prefixosProd = new Set(prodImages.map(img => img.split('-')[0]));
    const qtdFotosProd = prefixosProd.size;

    const divergeDoHead = qtdFotosProd !== headImgs.length;
    const divergeDoAtual = qtdFotosProd !== atualImgs.length;

    let motivoDivergencia = 'Idêntico ao HEAD';
    if (httpStatus !== 200) {
      motivoDivergencia = `HTTP ${httpStatus} (${erroReq || 'Não encontrado'})`;
    } else if (divergeDoHead) {
      motivoDivergencia = 'Diverge do HEAD (possível cache ou override de catálogo no deploy atual)';
    }

    resultados.push({
      slug,
      nome: p.nome,
      httpStatus,
      qtdFotosProd,
      fotosProd: Array.from(prefixosProd).sort().join(', '),
      qtdFotosHead: headImgs.length,
      fotosHead: headImgs.join(', '),
      qtdFotosAtual: atualImgs.length,
      fotosAtual: atualImgs.join(', '),
      divergeDoHead,
      divergeDoAtual,
      motivoDivergencia,
    });

    // Pequeno intervalo para não sobrecarregar
    await new Promise(r => setTimeout(r, 120));
  }

  // Gravar CSV
  const csvLinhas = [
    [
      'slug',
      'nome',
      'http_status',
      'qtd_fotos_producao',
      'fotos_producao_prefixos',
      'qtd_fotos_head',
      'fotos_head',
      'qtd_fotos_atual',
      'fotos_atual',
      'diverge_do_head',
      'diverge_do_atual',
      'motivo_divergencia',
    ].map(v => `"${v}"`).join(';'),
  ];

  for (const r of resultados) {
    csvLinhas.push([
      r.slug,
      r.nome,
      r.httpStatus,
      r.qtdFotosProd,
      r.fotosProd,
      r.qtdFotosHead,
      r.fotosHead,
      r.qtdFotosAtual,
      r.fotosAtual,
      r.divergeDoHead ? 'SIM' : 'NAO',
      r.divergeDoAtual ? 'SIM' : 'NAO',
      r.motivoDivergencia,
    ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(';'));
  }

  const csvPath = path.join(__dirname, '../../relatorios/kits-producao-vs-codigo.csv');
  fs.writeFileSync(csvPath, csvLinhas.join('\r\n'), 'utf8');
  console.log(`\nCSV gerado com sucesso: ${csvPath}`);

  // Gravar JSON auxiliar
  const jsonPath = path.join(__dirname, '../../relatorios/kits-producao-vs-codigo.json');
  fs.writeFileSync(jsonPath, JSON.stringify(resultados, null, 2), 'utf8');

  // Resumo
  const total = resultados.length;
  const prodComMultiplas = resultados.filter(r => r.qtdFotosProd >= 2);
  const divergemHead = resultados.filter(r => r.divergeDoHead);
  const divergemAtual = resultados.filter(r => r.divergeDoAtual);

  console.log('\n--- RESUMO DA PRODUÇÃO REAL ---');
  console.log(`Total de produtos infantis: ${total}`);
  console.log(`Produtos com 2 ou mais fotos em produção: ${prodComMultiplas.length}`);
  console.log(`Produtos que divergem do HEAD: ${divergemHead.length}`);
  console.log(`Produtos que divergem do Atual local: ${divergemAtual.length}`);

  if (divergemHead.length > 0) {
    console.log('\nDivergências do HEAD:');
    divergemHead.forEach(d => console.log(`  - ${d.slug}: Prod=${d.qtdFotosProd} vs HEAD=${d.qtdFotosHead} (${d.motivoDivergencia})`));
  } else {
    console.log('\nNENHUMA divergência do HEAD: Todos os 34 produtos infantis em produção refletem exatamente o estado do HEAD (com as fotos misturadas ainda ativas em produção).');
  }
}

main().catch(console.error);

