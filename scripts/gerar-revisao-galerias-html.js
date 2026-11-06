const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

async function main() {
  console.log('--- Iniciando Geração da Página de Revisão Interativa ---');

  const prods = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/products.json'), 'utf8'));
  const mapProds = new Map(prods.map(p => [p.slug, p]));

  const desvinculadasObj = JSON.parse(fs.readFileSync(path.join(__dirname, '../relatorios/imagens_desvinculadas_para_revisao.json'), 'utf8'));
  const desvinculadas = desvinculadasObj.imagensDesvinculadas || [];

  // Mapear desvinculadas por slug
  const desvinculadasPorSlug = new Map();
  for (const d of desvinculadas) {
    if (!desvinculadasPorSlug.has(d.produtoSlug)) {
      desvinculadasPorSlug.set(d.produtoSlug, []);
    }
    desvinculadasPorSlug.get(d.produtoSlug).push(d);
  }

  // Seção (a): 34 Kits Infantis
  const slugsKits = prods.filter(p => p.slug.startsWith('kits-infantis-')).map(p => p.slug);

  // Seção (b): 62 Produtos 7-B
  const c7b = JSON.parse(fs.readFileSync(path.join(__dirname, '../relatorios/analise_7b_candidatos_mistura.json'), 'utf8'));
  const slugs7b = c7b.itens.map(x => x.slug);

  // Seção (c): 94 Produtos Higienizados
  const classif = JSON.parse(fs.readFileSync(path.join(__dirname, '../relatorios/relatorio_completo_classificacao.json'), 'utf8'));
  const slugsHigienizados = classif.misturadas.map(x => x.slug);

  // Definir lista de produtos em ordem estrita de seção
  // Para evitar duplicação no DOM, cada slug tem sua seção primária, mas mantemos tags para todas
  const secaoMap = new Map();
  slugsKits.forEach(s => secaoMap.set(s, 'kits'));
  slugs7b.forEach(s => {
    if (!secaoMap.has(s)) secaoMap.set(s, 'varredura_7b');
  });
  slugsHigienizados.forEach(s => {
    if (!secaoMap.has(s)) secaoMap.set(s, 'higienizados');
  });

  // Lista ordenada: Primeiro kits (a), depois 7-B (b), depois higienizados restantes (c)
  const slugsOrdenados = [];
  slugsKits.forEach(s => slugsOrdenados.push(s));
  slugs7b.forEach(s => {
    if (!slugsOrdenados.includes(s)) slugsOrdenados.push(s);
  });
  slugsHigienizados.forEach(s => {
    if (!slugsOrdenados.includes(s)) slugsOrdenados.push(s);
  });

  console.log(`Total de produtos únicos para revisão: ${slugsOrdenados.length}`);

  // Processar cada produto e gerar thumbnails base64
  const produtosProcessados = [];
  let totalImagensProcessadas = 0;

  for (let idx = 0; idx < slugsOrdenados.length; idx++) {
    const slug = slugsOrdenados[idx];
    const p = mapProds.get(slug);
    if (!p) continue;

    const secaoPrimaria = secaoMap.get(slug);
    const tags = [];
    if (slugsKits.includes(slug)) tags.push('kits');
    if (slugs7b.includes(slug)) tags.push('varredura_7b');
    if (slugsHigienizados.includes(slug)) tags.push('higienizados');

    // Imagens atuais (estado FICA = true)
    const imagensCandidatas = [];

    // Adiciona imagens atuais
    for (let i = 0; i < p.images.length; i++) {
      const img = p.images[i];
      const nomeArquivo = path.basename(img.src);
      const fullPath = path.join(process.cwd(), 'public', img.src);

      let b64 = '';
      try {
        const buf = await sharp(fullPath)
          .resize(350)
          .webp({ quality: 65 })
          .toBuffer();
        b64 = `data:image/webp;base64,${buf.toString('base64')}`;
        totalImagensProcessadas++;
      } catch (err) {
        b64 = '';
      }

      imagensCandidatas.push({
        id: `img_${idx}_${i}`,
        arquivo: nomeArquivo,
        src: img.src,
        source: img.source || '',
        alt: img.alt || '',
        b64,
        statusInicial: 'fica',
        isMainInicial: i === 0,
      });
    }

    // Adiciona imagens desvinculadas (estado TIRA = true)
    const desvLista = desvinculadasPorSlug.get(slug) || [];
    for (let j = 0; j < desvLista.length; j++) {
      const d = desvLista[j];
      const nomeArquivo = path.basename(d.src);
      const fullPath = path.join(process.cwd(), 'public', d.src);

      // Evita duplicar se já estiver nas candidatas
      if (imagensCandidatas.some(c => c.src === d.src)) continue;

      let b64 = '';
      try {
        const buf = await sharp(fullPath)
          .resize(350)
          .webp({ quality: 65 })
          .toBuffer();
        b64 = `data:image/webp;base64,${buf.toString('base64')}`;
        totalImagensProcessadas++;
      } catch (err) {
        b64 = '';
      }

      imagensCandidatas.push({
        id: `img_${idx}_desv_${j}`,
        arquivo: nomeArquivo,
        src: d.src,
        source: d.source || '',
        alt: d.alt || '',
        b64,
        statusInicial: 'tira',
        isMainInicial: false,
        desvinculadaInfo: d.motivo || 'Desvinculada no diagnóstico anterior',
      });
    }

    produtosProcessados.push({
      slug,
      nome: p.nome,
      clube: p.clube,
      liga: p.liga,
      secaoPrimaria,
      tags,
      imagens: imagensCandidatas,
    });

    if ((idx + 1) % 25 === 0 || idx === slugsOrdenados.length - 1) {
      console.log(`Processados ${idx + 1}/${slugsOrdenados.length} produtos (${totalImagensProcessadas} miniaturas geradas)...`);
    }
  }

  // GERAR HTML
  console.log('Construindo arquivo HTML...');

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Revisão de Galerias de Produtos — Imports Alves</title>
  <style>
    :root {
      --bg: #090d16;
      --card-bg: #141b2d;
      --card-border: #232f48;
      --text: #f1f5f9;
      --text-muted: #94a3b8;
      --primary: #2563eb;
      --primary-hover: #1d4ed8;
      --green: #10b981;
      --green-dark: #064e3b;
      --red: #ef4444;
      --red-dark: #7f1d1d;
      --gold: #f59e0b;
      --gold-dark: #78350f;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background-color: var(--bg);
      color: var(--text);
      line-height: 1.4;
      padding-bottom: 90px;
    }
    header {
      position: sticky;
      top: 0;
      z-index: 50;
      background: rgba(9, 13, 22, 0.95);
      backdrop-filter: blur(8px);
      border-bottom: 1px solid var(--card-border);
      padding: 12px 16px;
    }
    .header-top {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 10px;
      margin-bottom: 10px;
    }
    h1 { font-size: 1.25rem; font-weight: 700; color: #fff; }
    .status-badge {
      background: #1e293b;
      border: 1px solid var(--card-border);
      padding: 4px 10px;
      border-radius: 20px;
      font-size: 0.8rem;
      color: #38bdf8;
    }
    .filters-row {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      align-items: center;
    }
    .filter-btn {
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      color: var(--text);
      padding: 6px 12px;
      border-radius: 6px;
      font-size: 0.8rem;
      cursor: pointer;
      transition: all 0.15s;
    }
    .filter-btn.active, .filter-btn:hover {
      background: var(--primary);
      border-color: var(--primary);
      color: #fff;
    }
    .search-input {
      background: #0f172a;
      border: 1px solid var(--card-border);
      color: #fff;
      padding: 6px 10px;
      border-radius: 6px;
      font-size: 0.85rem;
      min-width: 180px;
      flex-grow: 1;
    }
    .search-input:focus {
      outline: none;
      border-color: var(--primary);
    }
    .container {
      max-width: 1100px;
      margin: 16px auto;
      padding: 0 12px;
      display: flex;
      flex-direction: column;
      gap: 18px;
    }
    .card {
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 10px;
      padding: 14px;
      transition: border-color 0.2s;
    }
    .card.altered {
      border-color: var(--gold);
      box-shadow: 0 0 10px rgba(245, 158, 11, 0.15);
    }
    .card-head {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 12px;
      gap: 8px;
      flex-wrap: wrap;
    }
    .card-title {
      font-size: 1.05rem;
      font-weight: 600;
      color: #fff;
    }
    .card-slug {
      font-size: 0.75rem;
      color: var(--text-muted);
      font-family: monospace;
      margin-top: 2px;
    }
    .prod-link {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-size: 0.75rem;
      color: #60a5fa;
      text-decoration: none;
      background: rgba(96, 165, 250, 0.1);
      padding: 3px 8px;
      border-radius: 4px;
      margin-top: 4px;
    }
    .prod-link:hover { text-decoration: underline; background: rgba(96, 165, 250, 0.2); }
    .card-tags {
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
    }
    .tag {
      font-size: 0.7rem;
      font-weight: 600;
      padding: 3px 8px;
      border-radius: 4px;
      text-transform: uppercase;
      letter-spacing: 0.3px;
    }
    .tag-kits { background: #1e3a8a; color: #93c5fd; }
    .tag-7b { background: #581c87; color: #d8b4fe; }
    .tag-hig { background: #14532d; color: #86efac; }
    .tag-altered { background: var(--gold-dark); color: #fde68a; border: 1px solid var(--gold); }
    
    .images-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
      gap: 12px;
      margin-top: 10px;
    }
    @media (min-width: 600px) {
      .images-grid {
        grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
      }
    }
    .img-box {
      background: #0b101b;
      border: 1px solid var(--card-border);
      border-radius: 8px;
      padding: 8px;
      display: flex;
      flex-direction: column;
      position: relative;
      transition: all 0.2s;
    }
    .img-box.is-tira {
      opacity: 0.45;
      border-color: var(--red);
      background: rgba(239, 68, 68, 0.05);
    }
    .img-box.is-fica {
      border-color: var(--green);
    }
    .img-box.is-main {
      border-color: var(--gold);
      box-shadow: 0 0 8px rgba(245, 158, 11, 0.4);
    }
    .thumb-wrap {
      position: relative;
      width: 100%;
      height: 180px;
      background: #000;
      border-radius: 6px;
      overflow: hidden;
      cursor: zoom-in;
    }
    .thumb-img {
      width: 100%;
      height: 100%;
      object-fit: contain;
    }
    .main-badge {
      position: absolute;
      top: 6px;
      left: 6px;
      background: var(--gold);
      color: #000;
      font-size: 0.65rem;
      font-weight: 800;
      padding: 2px 6px;
      border-radius: 4px;
      text-transform: uppercase;
      box-shadow: 0 2px 4px rgba(0,0,0,0.5);
    }
    .img-info {
      margin-top: 6px;
      font-size: 0.7rem;
      color: var(--text-muted);
      text-align: center;
      line-height: 1.2;
    }
    .img-file {
      font-weight: 600;
      color: #cbd5e1;
      font-family: monospace;
      word-break: break-all;
    }
    .img-source {
      font-size: 0.65rem;
      color: #64748b;
      max-height: 2.2em;
      overflow: hidden;
      margin-top: 2px;
    }
    .img-actions {
      margin-top: 8px;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .btn-toggle-group {
      display: flex;
      border-radius: 6px;
      overflow: hidden;
      border: 1px solid var(--card-border);
    }
    .btn-toggle {
      flex: 1;
      padding: 6px 0;
      font-size: 0.75rem;
      font-weight: 700;
      border: none;
      cursor: pointer;
      background: #1e293b;
      color: #94a3b8;
      transition: all 0.15s;
    }
    .btn-toggle.active-fica {
      background: var(--green);
      color: #fff;
    }
    .btn-toggle.active-tira {
      background: var(--red);
      color: #fff;
    }
    .btn-main {
      padding: 4px 0;
      font-size: 0.7rem;
      font-weight: 600;
      border: 1px solid var(--card-border);
      border-radius: 4px;
      cursor: pointer;
      background: #1e293b;
      color: #94a3b8;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 4px;
    }
    .btn-main.is-main-active {
      background: var(--gold);
      border-color: var(--gold);
      color: #000;
      font-weight: 800;
    }
    .obs-row {
      margin-top: 12px;
      border-top: 1px dashed var(--card-border);
      padding-top: 8px;
    }
    .obs-input {
      width: 100%;
      background: #090d16;
      border: 1px solid var(--card-border);
      border-radius: 6px;
      padding: 6px 10px;
      font-size: 0.8rem;
      color: #fff;
    }
    .obs-input:focus {
      outline: none;
      border-color: var(--primary);
    }
    .warning-empty {
      color: #f87171;
      font-size: 0.75rem;
      font-weight: 600;
      margin-top: 6px;
      display: none;
    }

    /* BARRA FIXA INFERIOR */
    .bottom-bar {
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      background: rgba(15, 23, 42, 0.95);
      backdrop-filter: blur(10px);
      border-top: 1px solid var(--card-border);
      padding: 10px 16px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 10px;
      z-index: 50;
      flex-wrap: wrap;
    }
    .bottom-info {
      font-size: 0.85rem;
      font-weight: 600;
    }
    .bottom-buttons {
      display: flex;
      gap: 8px;
    }
    .action-btn {
      padding: 8px 14px;
      border-radius: 6px;
      font-size: 0.85rem;
      font-weight: 600;
      border: none;
      cursor: pointer;
      transition: all 0.2s;
    }
    .btn-copy { background: var(--primary); color: #fff; }
    .btn-copy:hover { background: var(--primary-hover); }
    .btn-download { background: var(--green); color: #fff; }
    .btn-download:hover { background: #059669; }
    .btn-reset { background: #334155; color: #cbd5e1; }

    /* LIGHTBOX MODAL */
    .modal {
      display: none;
      position: fixed;
      top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(0,0,0,0.92);
      z-index: 100;
      justify-content: center;
      align-items: center;
      padding: 20px;
      flex-direction: column;
    }
    .modal.open { display: flex; }
    .modal-img {
      max-width: 95vw;
      max-height: 85vh;
      object-fit: contain;
      border-radius: 8px;
      box-shadow: 0 0 20px rgba(0,0,0,0.8);
    }
    .modal-caption {
      margin-top: 12px;
      color: #cbd5e1;
      font-size: 0.9rem;
      text-align: center;
      font-family: monospace;
    }
    .modal-close {
      position: absolute;
      top: 16px;
      right: 20px;
      font-size: 2rem;
      color: #fff;
      cursor: pointer;
      background: none;
      border: none;
    }
    .toast {
      position: fixed;
      top: 70px;
      right: 20px;
      background: #10b981;
      color: #fff;
      padding: 10px 18px;
      border-radius: 6px;
      font-weight: 600;
      font-size: 0.85rem;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      z-index: 101;
      display: none;
    }
  </style>
</head>
<body>

  <header>
    <div class="header-top">
      <div>
        <h1>Revisão Visual de Galerias</h1>
        <div style="font-size: 0.8rem; color: var(--text-muted);">Decisões manuais para aplicação via script</div>
      </div>
      <div id="counterBadge" class="status-badge">0 produtos alterados</div>
    </div>

    <div class="filters-row">
      <button class="filter-btn active" onclick="filtrarSecao('todos')">Todos (164)</button>
      <button class="filter-btn" onclick="filtrarSecao('kits')">(a) Kits Infantis (34)</button>
      <button class="filter-btn" onclick="filtrarSecao('varredura_7b')">(b) Varredura 7-B (62)</button>
      <button class="filter-btn" onclick="filtrarSecao('higienizados')">(c) Higienizados (94)</button>
      <button class="filter-btn" onclick="filtrarSecao('alterados_so')">Apenas Alterados (<span id="btnAltCount">0</span>)</button>
      <input type="text" id="searchInput" class="search-input" placeholder="Buscar por clube, país ou slug..." oninput="filtrarTexto()" />
    </div>
  </header>

  <div id="toast" class="toast">Decisões copiadas para a área de transferência!</div>

  <main class="container" id="cardsContainer">
    ${produtosProcessados.map((prod, pIdx) => `
      <article class="card" id="card_${prod.slug}" data-slug="${prod.slug}" data-tags="${prod.tags.join(' ')}">
        <div class="card-head">
          <div>
            <div class="card-title">${pIdx + 1}. ${prod.nome}</div>
            <div class="card-slug">${prod.slug}</div>
            <a class="prod-link" href="https://www.importsalves.com.br/produto/${prod.slug}" target="_blank" rel="noopener">
              Ver página ao vivo em produção ↗
            </a>
          </div>
          <div class="card-tags">
            ${prod.tags.includes('kits') ? `<span class="tag tag-kits">Kit Infantil</span>` : ''}
            ${prod.tags.includes('varredura_7b') ? `<span class="tag tag-7b">Varredura 7-B</span>` : ''}
            ${prod.tags.includes('higienizados') ? `<span class="tag tag-hig">Higienizado</span>` : ''}
            <span class="tag tag-altered" id="alteredTag_${prod.slug}" style="display: none;">Alterado</span>
          </div>
        </div>

        <div class="images-grid" id="grid_${prod.slug}">
          ${prod.imagens.map((img, iIdx) => `
            <div class="img-box ${img.statusInicial === 'fica' ? 'is-fica' : 'is-tira'} ${img.isMainInicial ? 'is-main' : ''}"
                 id="box_${prod.slug}_${iIdx}"
                 data-slug="${prod.slug}"
                 data-idx="${iIdx}"
                 data-arquivo="${img.arquivo}">
              
              <div class="thumb-wrap" onclick="abrirModal('${img.b64}', '${img.arquivo} - ${prod.nome}')">
                <img class="thumb-img" src="${img.b64}" alt="${img.alt}" loading="lazy" />
                <span class="main-badge" id="mainBadge_${prod.slug}_${iIdx}" style="display: ${img.isMainInicial ? 'block' : 'none'};">Principal</span>
              </div>

              <div class="img-info">
                <div class="img-file">#${iIdx + 1}: ${img.arquivo}</div>
                <div class="img-source" title="${img.source}">${img.source.split('/').pop()}</div>
                ${img.desvinculadaInfo ? `<div style="color: #f87171; font-size: 0.65rem; margin-top: 2px;">(Desvinculada no diagnóstico)</div>` : ''}
              </div>

              <div class="img-actions">
                <div class="btn-toggle-group">
                  <button type="button" class="btn-toggle ${img.statusInicial === 'fica' ? 'active-fica' : ''}"
                          id="btnFica_${prod.slug}_${iIdx}"
                          onclick="setFica('${prod.slug}', ${iIdx}, true)">Fica</button>
                  <button type="button" class="btn-toggle ${img.statusInicial === 'tira' ? 'active-tira' : ''}"
                          id="btnTira_${prod.slug}_${iIdx}"
                          onclick="setFica('${prod.slug}', ${iIdx}, false)">Tira</button>
                </div>
                <button type="button" class="btn-main ${img.isMainInicial ? 'is-main-active' : ''}"
                        id="btnMain_${prod.slug}_${iIdx}"
                        onclick="setMain('${prod.slug}', ${iIdx})">
                  ★ Definir Principal
                </button>
              </div>
            </div>
          `).join('')}
        </div>

        <div class="warning-empty" id="warnEmpty_${prod.slug}">
          ⚠️ Atenção: Nenhuma foto selecionada para este produto! Escolha ao menos uma para ficar.
        </div>

        <div class="obs-row">
          <input type="text" class="obs-input" id="obs_${prod.slug}" placeholder="Observação opcional para este produto..." onchange="onObsChange('${prod.slug}')" />
        </div>
      </article>
    `).join('')}
  </main>

  <!-- BARRA INFERIOR FIXA -->
  <footer class="bottom-bar">
    <div class="bottom-info">
      <span id="bottomCount">0</span> produtos mexidos
    </div>
    <div class="bottom-buttons">
      <button class="action-btn btn-reset" onclick="resetarTudo()">Resetar</button>
      <button class="action-btn btn-copy" onclick="copiarDecisoes()">Copiar Decisões (JSON)</button>
      <button class="action-btn btn-download" onclick="baixarDecisoes()">Baixar decisoes.json</button>
    </div>
  </footer>

  <!-- MODAL LIGHTBOX -->
  <div class="modal" id="modal" onclick="fecharModal()">
    <button class="modal-close" onclick="fecharModal()">&times;</button>
    <img class="modal-img" id="modalImg" src="" alt="Ampliação" onclick="event.stopPropagation()" />
    <div class="modal-caption" id="modalCaption"></div>
  </div>

  <script>
    // ESTADO INICIAL COMPLETO
    const dadosCatalogo = ${JSON.stringify(produtosProcessados.map(p => ({
      slug: p.slug,
      imagens: p.imagens.map(im => ({
        arquivo: im.arquivo,
        statusInicial: im.statusInicial,
        isMainInicial: im.isMainInicial
      }))
    })))};

    const estadoInicial = {};
    dadosCatalogo.forEach(p => {
      estadoInicial[p.slug] = {
        images: p.imagens.filter(im => im.statusInicial === 'fica').map(im => im.arquivo),
        main: (p.imagens.find(im => im.isMainInicial) || p.imagens[0])?.arquivo || '',
        obs: ''
      };
    });

    // ESTADO ATUAL EM MEMÓRIA
    let estadoAtual = JSON.parse(JSON.stringify(estadoInicial));

    // Carregar rascunho do localStorage se existir
    const STORAGE_KEY = 'alves_revisao_galerias_draft_v1';
    function carregarRascunho() {
      try {
        const salvo = localStorage.getItem(STORAGE_KEY);
        if (salvo) {
          const draft = JSON.parse(salvo);
          for (const slug in draft) {
            if (estadoAtual[slug]) {
              estadoAtual[slug] = draft[slug];
            }
          }
          aplicarEstadoNaInterface();
          mostrarToast('Rascunho anterior restaurado do navegador!');
        }
      } catch (e) {
        console.warn('Erro ao carregar rascunho:', e);
      }
    }

    function salvarRascunho() {
      try {
        // Salva somente os alterados
        const alterados = obterPayloadDecisoes();
        localStorage.setItem(STORAGE_KEY, JSON.stringify(alterados));
      } catch (e) {}
    }

    function setFica(slug, idx, fica) {
      const pData = dadosCatalogo.find(p => p.slug === slug);
      const arquivo = pData.imagens[idx].arquivo;
      const cur = estadoAtual[slug];

      if (fica) {
        if (!cur.images.includes(arquivo)) cur.images.push(arquivo);
        if (!cur.main) cur.main = arquivo;
      } else {
        cur.images = cur.images.filter(a => a !== arquivo);
        if (cur.main === arquivo) {
          cur.main = cur.images[0] || '';
        }
      }

      atualizarCard(slug);
      salvarRascunho();
      atualizarContadores();
    }

    function setMain(slug, idx) {
      const pData = dadosCatalogo.find(p => p.slug === slug);
      const arquivo = pData.imagens[idx].arquivo;
      const cur = estadoAtual[slug];

      if (!cur.images.includes(arquivo)) {
        cur.images.push(arquivo);
      }
      cur.main = arquivo;

      atualizarCard(slug);
      salvarRascunho();
      atualizarContadores();
    }

    function onObsChange(slug) {
      const input = document.getElementById('obs_' + slug);
      estadoAtual[slug].obs = input ? input.value.trim() : '';
      atualizarCard(slug);
      salvarRascunho();
      atualizarContadores();
    }

    function atualizarCard(slug) {
      const pData = dadosCatalogo.find(p => p.slug === slug);
      const cur = estadoAtual[slug];
      const ini = estadoInicial[slug];

      pData.imagens.forEach((im, i) => {
        const fica = cur.images.includes(im.arquivo);
        const isMain = cur.main === im.arquivo;

        const box = document.getElementById('box_' + slug + '_' + i);
        const btnFica = document.getElementById('btnFica_' + slug + '_' + i);
        const btnTira = document.getElementById('btnTira_' + slug + '_' + i);
        const btnMain = document.getElementById('btnMain_' + slug + '_' + i);
        const mainBadge = document.getElementById('mainBadge_' + slug + '_' + i);

        if (box) {
          box.classList.toggle('is-fica', fica);
          box.classList.toggle('is-tira', !fica);
          box.classList.toggle('is-main', isMain);
        }
        if (btnFica) btnFica.classList.toggle('active-fica', fica);
        if (btnTira) btnTira.classList.toggle('active-tira', !fica);
        if (btnMain) btnMain.classList.toggle('is-main-active', isMain);
        if (mainBadge) mainBadge.style.display = isMain ? 'block' : 'none';
      });

      // Checa se está alterado
      const mudouImagens = JSON.stringify(cur.images.slice().sort()) !== JSON.stringify(ini.images.slice().sort());
      const mudouMain = cur.main !== ini.main;
      const mudouObs = cur.obs !== ini.obs;
      const alterado = mudouImagens || mudouMain || mudouObs;

      const card = document.getElementById('card_' + slug);
      const tag = document.getElementById('alteredTag_' + slug);
      if (card) card.classList.toggle('altered', alterado);
      if (tag) tag.style.display = alterado ? 'inline-block' : 'none';

      // Aviso se ficou sem imagens
      const warn = document.getElementById('warnEmpty_' + slug);
      if (warn) warn.style.display = cur.images.length === 0 ? 'block' : 'none';
    }

    function aplicarEstadoNaInterface() {
      dadosCatalogo.forEach(p => {
        atualizarCard(p.slug);
        const input = document.getElementById('obs_' + p.slug);
        if (input && estadoAtual[p.slug]) {
          input.value = estadoAtual[p.slug].obs || '';
        }
      });
      atualizarContadores();
    }

    function isAlterado(slug) {
      const cur = estadoAtual[slug];
      const ini = estadoInicial[slug];
      const mudouImagens = JSON.stringify(cur.images.slice().sort()) !== JSON.stringify(ini.images.slice().sort());
      const mudouMain = cur.main !== ini.main;
      const mudouObs = (cur.obs || '') !== (ini.obs || '');
      return mudouImagens || mudouMain || mudouObs;
    }

    function obterPayloadDecisoes() {
      const payload = {};
      for (const slug in estadoAtual) {
        if (isAlterado(slug)) {
          payload[slug] = {
            images: estadoAtual[slug].images,
            main: estadoAtual[slug].main,
            obs: estadoAtual[slug].obs || ''
          };
        }
      }
      return payload;
    }

    function atualizarContadores() {
      let count = 0;
      for (const slug in estadoAtual) {
        if (isAlterado(slug)) count++;
      }
      document.getElementById('counterBadge').innerText = count + ' produtos alterados';
      document.getElementById('bottomCount').innerText = count;
      document.getElementById('btnAltCount').innerText = count;
    }

    function copiarDecisoes() {
      const payload = obterPayloadDecisoes();
      const json = JSON.stringify(payload, null, 2);
      navigator.clipboard.writeText(json).then(() => {
        mostrarToast('JSON copiado com ' + Object.keys(payload).length + ' produto(s) alterado(s)!');
      }).catch(() => {
        alert(json);
      });
    }

    function baixarDecisoes() {
      const payload = obterPayloadDecisoes();
      const json = JSON.stringify(payload, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'decisoes.json';
      a.click();
      URL.revokeObjectURL(url);
      mostrarToast('Download iniciado: decisoes.json');
    }

    function resetarTudo() {
      if (!confirm('Deseja descartar todas as alterações e resetar para o estado inicial?')) return;
      localStorage.removeItem(STORAGE_KEY);
      estadoAtual = JSON.parse(JSON.stringify(estadoInicial));
      aplicarEstadoNaInterface();
      mostrarToast('Estado resetado para o padrão inicial!');
    }

    // FILTROS
    let secaoAtual = 'todos';
    function filtrarSecao(secao) {
      secaoAtual = secao;
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      event.target.classList.add('active');
      aplicarFiltros();
    }

    function filtrarTexto() {
      aplicarFiltros();
    }

    function aplicarFiltros() {
      const query = document.getElementById('searchInput').value.toLowerCase().trim();
      const cards = document.querySelectorAll('.card');

      cards.forEach(card => {
        const slug = card.dataset.slug;
        const tags = (card.dataset.tags || '').split(' ');
        const cardText = card.innerText.toLowerCase();

        let matchSecao = true;
        if (secaoAtual === 'kits') matchSecao = tags.includes('kits');
        else if (secaoAtual === 'varredura_7b') matchSecao = tags.includes('varredura_7b');
        else if (secaoAtual === 'higienizados') matchSecao = tags.includes('higienizados');
        else if (secaoAtual === 'alterados_so') matchSecao = isAlterado(slug);

        let matchQuery = true;
        if (query) {
          matchQuery = cardText.includes(query) || slug.includes(query);
        }

        card.style.display = (matchSecao && matchQuery) ? 'block' : 'none';
      });
    }

    // MODAL
    function abrirModal(src, caption) {
      const modal = document.getElementById('modal');
      const img = document.getElementById('modalImg');
      const cap = document.getElementById('modalCaption');
      img.src = src;
      cap.innerText = caption;
      modal.classList.add('open');
    }
    function fecharModal() {
      document.getElementById('modal').classList.remove('open');
    }

    function mostrarToast(msg) {
      const t = document.getElementById('toast');
      t.innerText = msg;
      t.style.display = 'block';
      setTimeout(() => { t.style.display = 'none'; }, 3000);
    }

    window.addEventListener('DOMContentLoaded', carregarRascunho);
  </script>
</body>
</html>`;

  const outputPath = path.join(__dirname, '../relatorios/revisao-galerias.html');
  fs.writeFileSync(outputPath, html, 'utf8');
  const stat = fs.statSync(outputPath);
  console.log(`\nHTML gerado com sucesso: ${outputPath}`);
  console.log(`Tamanho final do arquivo: ${(stat.size / (1024 * 1024)).toFixed(2)} MB (${stat.size} bytes)`);
}

main().catch(console.error);

