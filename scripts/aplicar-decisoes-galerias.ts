import fs from 'node:fs';
import path from 'node:path';

export interface DecisaoItem {
  images: string[];
  main: string;
  obs?: string;
}

export type DecisoesMap = Record<string, DecisaoItem>;

export interface OpcoesAplicacao {
  decisoesPath?: string;
  produtosPath?: string;
  desvinculadasPath?: string;
  publicDir?: string;
  confirmar?: boolean;
}

export interface ResultadoItem {
  slug: string;
  nome: string;
  imagensAntes: string[];
  imagensDepois: string[];
  mainAntes: string;
  mainDepois: string;
  obs?: string;
}

export interface ResultadoAplicacao {
  sucesso: boolean;
  modo: 'DRY-RUN' | 'CONFIRMADO';
  totalProcessados: number;
  itens: ResultadoItem[];
  erros: string[];
}

export function validarEAplicarDecisoes(opcoes: OpcoesAplicacao = {}): ResultadoAplicacao {
  const rootDir = process.cwd();
  const decisoesPath = opcoes.decisoesPath || path.join(rootDir, 'relatorios', 'decisoes.json');
  const produtosPath = opcoes.produtosPath || path.join(rootDir, 'data', 'products.json');
  const desvinculadasPath = opcoes.desvinculadasPath || path.join(rootDir, 'relatorios', 'imagens_desvinculadas_para_revisao.json');
  const publicDir = opcoes.publicDir || path.join(rootDir, 'public');
  const confirmar = Boolean(opcoes.confirmar);

  if (!fs.existsSync(decisoesPath)) {
    throw new Error(`Arquivo de decisões não encontrado: ${decisoesPath}`);
  }
  if (!fs.existsSync(produtosPath)) {
    throw new Error(`Arquivo de produtos não encontrado: ${produtosPath}`);
  }

  const rawDecisoes = fs.readFileSync(decisoesPath, 'utf8');
  const decisoes: DecisoesMap = JSON.parse(rawDecisoes);

  const rawProdutos = fs.readFileSync(produtosPath, 'utf8');
  const produtos: any[] = JSON.parse(rawProdutos);
  const mapProdutos = new Map<string, any>(produtos.map(p => [p.slug, p]));

  let desvinculadasData: { totalProdutosHigienizados?: number; totalImagensDesvinculadas?: number; imagensDesvinculadas: any[] } = {
    imagensDesvinculadas: [],
  };
  if (fs.existsSync(desvinculadasPath)) {
    try {
      desvinculadasData = JSON.parse(fs.readFileSync(desvinculadasPath, 'utf8'));
      if (!Array.isArray(desvinculadasData.imagensDesvinculadas)) {
        desvinculadasData.imagensDesvinculadas = [];
      }
    } catch {
      desvinculadasData = { imagensDesvinculadas: [] };
    }
  }

  const erros: string[] = [];
  const slugsDecisoes = Object.keys(decisoes);
  const itensResultado: ResultadoItem[] = [];

  // 1. FASE DE VALIDAÇÃO RIGOROSA
  for (const slug of slugsDecisoes) {
    const item = decisoes[slug];
    const produto = mapProdutos.get(slug);

    if (!produto) {
      erros.push(`Produto não encontrado no catálogo para o slug: "${slug}"`);
      continue;
    }

    if (!item.images || !Array.isArray(item.images) || item.images.length === 0) {
      erros.push(`Decisão inválida para "${slug}": a lista de imagens não pode ser vazia.`);
      continue;
    }

    if (!item.main) {
      erros.push(`Decisão inválida para "${slug}": a imagem principal ("main") deve ser informada.`);
      continue;
    }

    if (!item.images.includes(item.main)) {
      erros.push(`Decisão inválida para "${slug}": a imagem principal "${item.main}" deve constar na lista de imagens permitidas (${item.images.join(', ')}).`);
      continue;
    }

    // Validar existência física de cada arquivo em public/otimizadas
    for (const arq of item.images) {
      const nomeBase = path.basename(arq);
      const caminhoPossivel1 = path.join(publicDir, 'otimizadas', slug, nomeBase);
      const caminhoPossivel2 = path.join(publicDir, arq.startsWith('/') ? arq.slice(1) : arq);

      if (!fs.existsSync(caminhoPossivel1) && !fs.existsSync(caminhoPossivel2)) {
        erros.push(`Arquivo de imagem não encontrado fisicamente para "${slug}": ${nomeBase}`);
      }
    }
  }

  if (erros.length > 0) {
    return {
      sucesso: false,
      modo: confirmar ? 'CONFIRMADO' : 'DRY-RUN',
      totalProcessados: 0,
      itens: [],
      erros,
    };
  }

  // 2. CONSTRUÇÃO DO NOVO ESTADO
  const produtosModificados = produtos.map(p => {
    const item = decisoes[p.slug];
    if (!item) return p; // Produto não alterado

    const imagensAntes = p.images.map((im: any) => path.basename(im.src));
    const mainAntes = imagensAntes[0] || '';

    // Reordenar para garantir que "main" fique na primeira posição (images[0])
    const arquivosOrdenados = [item.main, ...item.images.filter(a => a !== item.main)];

    // Montar novos objetos de imagem preservando metadados quando existentes
    const novasImagens = arquivosOrdenados.map((nomeArq, idx) => {
      const nomeBase = path.basename(nomeArq);
      const encontradaAtual = p.images.find((im: any) => path.basename(im.src) === nomeBase);
      const encontradaDesv = desvinculadasData.imagensDesvinculadas.find(
        (im: any) => im.produtoSlug === p.slug && path.basename(im.src) === nomeBase
      );

      const base = encontradaAtual || (encontradaDesv ? {
        src: encontradaDesv.src,
        source: encontradaDesv.source,
        alt: encontradaDesv.alt,
        credit: encontradaDesv.credit,
        focalPoint: encontradaDesv.focalPoint,
        blurDataURL: encontradaDesv.blurDataURL,
      } : {
        src: `/otimizadas/${p.slug}/${nomeBase}`,
        source: `catalogo/${p.slug}/${nomeBase}`,
        focalPoint: { x: 50, y: 50 },
      });

      return {
        ...base,
        src: base.src.startsWith('/') ? base.src : `/${base.src}`,
        alt: typeof base.alt === 'string'
          ? base.alt.replace(/foto \d+\s*$/, `foto ${idx + 1}`)
          : `${p.nome} – foto ${idx + 1}`,
      };
    });

    itensResultado.push({
      slug: p.slug,
      nome: p.nome,
      imagensAntes,
      imagensDepois: arquivosOrdenados,
      mainAntes,
      mainDepois: item.main,
      obs: item.obs || '',
    });

    // Retorna produto alterando ESTRITAMENTE o campo images
    return {
      ...p,
      images: novasImagens,
    };
  });

  // 3. SE NÃO FOR CONFIRMAR (DRY-RUN PADRÃO) -> NÃO TOCA EM NENHUM ARQUIVO
  if (!confirmar) {
    return {
      sucesso: true,
      modo: 'DRY-RUN',
      totalProcessados: itensResultado.length,
      itens: itensResultado,
      erros: [],
    };
  }

  // 4. MODO CONFIRMADO: BACKUP E ATUALIZAÇÃO IDEMPOTENTE
  const dataHoje = new Date();
  const yyyy = dataHoje.getFullYear();
  const mm = String(dataHoje.getMonth() + 1).padStart(2, '0');
  const dd = String(dataHoje.getDate()).padStart(2, '0');
  const dataDir = path.dirname(produtosPath);
  const backupPath = path.join(dataDir, `products.json.bak-${yyyy}${mm}${dd}`);

  if (!fs.existsSync(backupPath)) {
    fs.copyFileSync(produtosPath, backupPath);
  }

  // Atualizar data/products.json
  fs.writeFileSync(produtosPath, JSON.stringify(produtosModificados, null, 2) + '\n', 'utf8');

  // Atualizar relatórios de desvinculadas (remover as restauradas, acrescentar as removidas)
  for (const res of itensResultado) {
    const slug = res.slug;
    const itemDecisao = decisoes[slug];

    // Remover imagens que foram restauradas
    desvinculadasData.imagensDesvinculadas = desvinculadasData.imagensDesvinculadas.filter(
      im => !(im.produtoSlug === slug && itemDecisao.images.includes(path.basename(im.src)))
    );

    // Identificar imagens que foram retiradas agora
    const retiradasAgora = res.imagensAntes.filter(arq => !itemDecisao.images.includes(arq));
    for (const arq of retiradasAgora) {
      if (!desvinculadasData.imagensDesvinculadas.some(im => im.produtoSlug === slug && path.basename(im.src) === arq)) {
        desvinculadasData.imagensDesvinculadas.push({
          produtoSlug: slug,
          produtoNome: res.nome,
          src: `/otimizadas/${slug}/${arq}`,
          motivo: `Removida pelo revisor via decisões manuais${res.obs ? `: ${res.obs}` : ''}`,
          uniformeSugerido: 'revisar',
        });
      }
    }
  }

  desvinculadasData.totalImagensDesvinculadas = desvinculadasData.imagensDesvinculadas.length;
  fs.writeFileSync(desvinculadasPath, JSON.stringify(desvinculadasData, null, 2), 'utf8');

  return {
    sucesso: true,
    modo: 'CONFIRMADO',
    totalProcessados: itensResultado.length,
    itens: itensResultado,
    erros: [],
  };
}

// Execução CLI (apenas quando chamado diretamente, nunca durante importação de testes)
const isDirectCli = Boolean(
  process.argv[1] &&
  !process.argv.includes('--test') &&
  !process.env.NODE_TEST_CONTEXT &&
  path.basename(process.argv[1]).startsWith('aplicar-decisoes-galerias')
);

if (isDirectCli) {
  const args = process.argv.slice(2);
  const confirmar = args.includes('--confirmar');
  const fileArgIdx = args.findIndex(a => a === '--file' || a === '-f');
  const customFile = fileArgIdx !== -1 && args[fileArgIdx + 1] ? args[fileArgIdx + 1] : undefined;

  console.log(`=== APLICAÇÃO DE DECISÕES DE GALERIAS (${confirmar ? 'MODO GRAVAÇÃO' : 'MODO DRY-RUN'}) ===\n`);

  try {
    const res = validarEAplicarDecisoes({
      confirmar,
      decisoesPath: customFile,
    });

    if (!res.sucesso) {
      console.error('❌ ERRO NA VALIDAÇÃO DAS DECISÕES:');
      res.erros.forEach(e => console.error(`  - ${e}`));
      process.exit(1);
    }

    console.log(`Total de produtos avaliados: ${res.totalProcessados}\n`);
    for (const it of res.itens) {
      console.log(`[PRODUTO] ${it.nome} (${it.slug})`);
      console.log(`  Antes:  Imagens=[${it.imagensAntes.join(', ')}] | Principal=${it.mainAntes}`);
      console.log(`  Depois: Imagens=[${it.imagensDepois.join(', ')}] | Principal=${it.mainDepois}`);
      if (it.obs) console.log(`  Obs:    ${it.obs}`);
      console.log('');
    }

    if (!confirmar) {
      console.log('ℹ️  NENHUM arquivo foi alterado (execução em DRY-RUN por padrão).');
      console.log('   Para efetivar a gravação em disco após revisar, passe o parâmetro --confirmar.');
    } else {
      console.log('✅ Gravação concluída com sucesso e backup gerado.');
    }
  } catch (err: any) {
    console.error('❌ Falha na execução:', err.message);
    process.exit(1);
  }
}
