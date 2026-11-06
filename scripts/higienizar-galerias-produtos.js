const fs = require('fs');
const path = require('path');

const PRODUCTS_PATH = path.join(__dirname, '..', 'data', 'products.json');
const BACKUP_PATH = path.join(__dirname, '..', 'data', 'products.before-gallery-fix.json');
const CLASSIFICACAO_PATH = path.join(__dirname, '..', 'relatorios', 'relatorio_completo_classificacao.json');
const DESVINCULADAS_OUTPUT = path.join(__dirname, '..', 'relatorios', 'imagens_desvinculadas_para_revisao.json');

function main() {
  console.log('--- Iniciando Higienização de Galerias ---');

  if (!fs.existsSync(CLASSIFICACAO_PATH)) {
    throw new Error('Arquivo de classificação não encontrado: ' + CLASSIFICACAO_PATH);
  }

  const classificacao = JSON.parse(fs.readFileSync(CLASSIFICACAO_PATH, 'utf8'));
  const produtos = JSON.parse(fs.readFileSync(PRODUCTS_PATH, 'utf8'));

  // 1. Fazer backup seguro
  if (!fs.existsSync(BACKUP_PATH)) {
    fs.copyFileSync(PRODUCTS_PATH, BACKUP_PATH);
    console.log('Backup seguro criado em:', BACKUP_PATH);
  } else {
    console.log('Backup já existente em:', BACKUP_PATH);
  }

  const misturadasMap = new Map();
  for (const item of classificacao.misturadas) {
    misturadasMap.set(item.slug, item);
  }

  const imagensDesvinculadas = [];
  let produtosAlterados = 0;
  let imagensRemovidasCount = 0;

  const produtosAtualizados = produtos.map((p) => {
    const config = misturadasMap.get(p.slug);
    if (!config) {
      // Produto não é misturado; mantém 100% como está
      return p;
    }

    produtosAlterados++;

    // Extrair imagens desvinculadas para documentação
    config.desvinculadas.forEach((idx) => {
      const img = p.images[idx];
      if (img) {
        imagensRemovidasCount++;
        let uniformeSugerido = 'reserva';
        if (p.slug.startsWith('kits-infantis-')) {
          uniformeSugerido = idx === 1 ? 'reserva' : 'terceiro';
        } else if (p.slug.startsWith('retro-')) {
          uniformeSugerido = 'ano_alternativo';
        } else if (img.source && img.source.toLowerCase().includes('croped')) {
          uniformeSugerido = 'cropped';
        }

        imagensDesvinculadas.push({
          produtoSlug: p.slug,
          produtoNome: p.nome,
          imageIndexOriginal: idx,
          src: img.src,
          source: img.source,
          alt: img.alt,
          motivo: 'Uniforme divergente/alternativo agrupado indevidamente no mesmo produto',
          uniformeSugerido,
        });
      }
    });

    // Manter apenas as imagens legítimas do produto
    const imagensMantidas = config.mantidas.map((idx, novoIdx) => {
      const img = p.images[idx];
      return {
        ...img,
        alt: typeof img.alt === 'string'
          ? img.alt.replace(/foto \d+\s*$/, `foto ${novoIdx + 1}`)
          : img.alt,
      };
    });

    return {
      ...p,
      images: imagensMantidas,
    };
  });

  // Validação de integridade
  if (produtosAtualizados.length !== produtos.length) {
    throw new Error(`Inconsistência no número total de produtos: antes ${produtos.length}, depois ${produtosAtualizados.length}`);
  }

  for (const p of produtosAtualizados) {
    if (!p.images || p.images.length === 0) {
      throw new Error(`Produto ficou sem imagem: ${p.slug} (${p.nome})`);
    }
  }

  // Gravar arquivo de produtos higienizado
  fs.writeFileSync(PRODUCTS_PATH, JSON.stringify(produtosAtualizados, null, 2) + '\n', 'utf8');

  // Gravar relatório detalhado das imagens desvinculadas
  fs.writeFileSync(DESVINCULADAS_OUTPUT, JSON.stringify({
    totalProdutosHigienizados: produtosAlterados,
    totalImagensDesvinculadas: imagensRemovidasCount,
    imagensDesvinculadas,
  }, null, 2), 'utf8');

  console.log(`--- Higienização Concluída com Sucesso ---`);
  console.log(`Total de produtos no catálogo: ${produtosAtualizados.length}`);
  console.log(`Produtos com galerias higienizadas: ${produtosAlterados}`);
  console.log(`Total de fotos intrusas desvinculadas: ${imagensRemovidasCount}`);
  console.log(`Relatório salvo em: ${DESVINCULADAS_OUTPUT}`);
}

main();

