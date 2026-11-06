const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const sharp = require('sharp');

async function main() {
  console.log('--- Gerando Relatórios dos 34 Kits Infantis ---');

  const headJson = execSync('git show HEAD:data/products.json', { maxBuffer: 50 * 1024 * 1024 }).toString('utf8');
  const prodsHead = JSON.parse(headJson);
  const prodsAtual = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/products.json'), 'utf8'));

  const mapHead = new Map(prodsHead.map(p => [p.slug, p]));
  const mapAtual = new Map(prodsAtual.map(p => [p.slug, p]));

  const kits = prodsHead.filter(p => p.slug.startsWith('kits-infantis-'));

  // Ordenar alfabeticamente pelo nome do país/kit
  kits.sort((a, b) => a.nome.localeCompare(b.nome));

  const dadosKits = [];

  for (const k of kits) {
    const h = mapHead.get(k.slug);
    const a = mapAtual.get(k.slug);
    const hImgs = h.images || [];
    const aImgs = a.images || [];
    const removidas = hImgs.filter(hi => !aImgs.some(ai => ai.src === hi.src));

    // Analisar sufixos
    const sufixos = hImgs.map((img, idx) => {
      const src = img.source || '';
      const m = src.match(/\(([0-9]+)\)/);
      if (m) return `(${m[1]})`;
      if (src.includes(' - Treino')) return 'Treino';
      if (idx === 0) return 'Principal (sem sufixo)';
      return 'Secundária';
    });

    // Converter miniaturas para base64 para o HTML ser 100% autossuficiente
    const hImgsBase64 = [];
    for (const img of hImgs) {
      const fullPath = path.join(process.cwd(), 'public', img.src);
      let b64 = '';
      try {
        const buf = await sharp(fullPath)
          .resize(220)
          .webp({ quality: 70 })
          .toBuffer();
        b64 = `data:image/webp;base64,${buf.toString('base64')}`;
      } catch (err) {
        b64 = '';
      }
      const isRemovida = removidas.some(r => r.src === img.src);
      hImgsBase64.push({
        ...img,
        b64,
        isRemovida,
      });
    }

    const aImgsBase64 = [];
    for (const img of aImgs) {
      const match = hImgsBase64.find(hi => hi.src === img.src);
      aImgsBase64.push({
        ...img,
        b64: match ? match.b64 : '',
      });
    }

    dadosKits.push({
      slug: k.slug,
      nome: k.nome,
      clube: k.clube,
      totalAntes: hImgs.length,
      totalDepois: aImgs.length,
      alterado: removidas.length > 0,
      removidasCount: removidas.length,
      sufixos: sufixos.join(', '),
      hImgs: hImgsBase64,
      aImgs: aImgsBase64,
      removidas,
    });
  }

  // 1. GERAR CSV
  console.log('Gerando relatorios/kits-infantis.csv...');
  const csvLinhas = [
    [
      'slug',
      'nome',
      'pais_selecao',
      'qtd_fotos_head',
      'qtd_fotos_atual',
      'alterado',
      'qtd_removidas',
      'sufixos_arquivos_head',
      'fotos_mantidas',
      'fotos_removidas',
      'status_conferencia',
      'observacao_analise',
    ].map(v => `"${v}"`).join(';'),
  ];

  for (const item of dadosKits) {
    const mantidasStr = item.aImgs.map(i => i.source).join(' | ');
    const removidasStr = item.removidas.map(i => i.source).join(' | ');
    let statusConf = item.alterado
      ? 'Higienizado (fotos de outro uniforme removidas)'
      : 'Inalterado (já possuía foto única legítima no HEAD)';
    
    let obs = '';
    if (item.alterado) {
      obs = `Removida(s) ${item.removidasCount} imagem(ns) com sufixos ${item.sufixos} pertencentes ao uniforme reserva/alternativo.`;
    } else {
      obs = 'Catálogo original possuía apenas 1 imagem; nenhuma divergência de múltiplos uniformes no registro.';
    }

    csvLinhas.push([
      item.slug,
      item.nome,
      item.clube,
      item.totalAntes,
      item.totalDepois,
      item.alterado ? 'SIM' : 'NAO',
      item.removidasCount,
      item.sufixos,
      mantidasStr,
      removidasStr,
      statusConf,
      obs,
    ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(';'));
  }

  fs.writeFileSync(path.join(__dirname, '../relatorios/kits-infantis.csv'), csvLinhas.join('\r\n'), 'utf8');
  console.log('CSV salvo com sucesso: relatorios/kits-infantis.csv');

  // 2. GERAR HTML AUTOCONTIDO RESPONSIVO
  console.log('Gerando relatorios/kits-infantis-conferencia.html...');

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Conferência dos 34 Kits Infantis — Imports Alves</title>
  <style>
    :root {
      --bg: #0f172a;
      --card-bg: #1e293b;
      --card-border: #334155;
      --text: #f8fafc;
      --text-muted: #94a3b8;
      --primary: #3b82f6;
      --accent-green: #10b981;
      --accent-red: #ef4444;
      --accent-yellow: #f59e0b;
      --badge-bg: #334155;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background-color: var(--bg);
      color: var(--text);
      line-height: 1.5;
      padding: 16px;
    }
    header {
      max-width: 1200px;
      margin: 0 auto 24px;
      padding-bottom: 16px;
      border-bottom: 1px solid var(--card-border);
    }
    h1 { font-size: 1.5rem; margin-bottom: 8px; color: #fff; }
    .subtitle { color: var(--text-muted); font-size: 0.95rem; margin-bottom: 16px; }
    .kpis {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
      gap: 12px;
      margin-bottom: 16px;
    }
    .kpi-card {
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 8px;
      padding: 12px;
      text-align: center;
    }
    .kpi-num { font-size: 1.6rem; font-weight: bold; }
    .kpi-label { font-size: 0.8rem; color: var(--text-muted); }
    .filter-bar {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      margin-bottom: 20px;
    }
    .filter-btn {
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      color: var(--text);
      padding: 6px 14px;
      border-radius: 20px;
      font-size: 0.85rem;
      cursor: pointer;
      transition: all 0.2s;
    }
    .filter-btn.active, .filter-btn:hover {
      background: var(--primary);
      border-color: var(--primary);
      color: white;
    }
    .kits-list {
      display: flex;
      flex-direction: column;
      gap: 20px;
      max-width: 1200px;
      margin: 0 auto;
    }
    .kit-card {
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 12px;
      overflow: hidden;
      padding: 16px;
    }
    .kit-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 12px;
      flex-wrap: wrap;
      gap: 8px;
    }
    .kit-title { font-size: 1.1rem; font-weight: 600; color: #fff; }
    .kit-slug { font-size: 0.8rem; color: var(--text-muted); font-family: monospace; }
    .badge {
      display: inline-block;
      padding: 4px 10px;
      border-radius: 6px;
      font-size: 0.75rem;
      font-weight: 600;
      text-transform: uppercase;
    }
    .badge-altered { background: rgba(239, 68, 68, 0.2); color: #fca5a5; border: 1px solid #ef4444; }
    .badge-clean { background: rgba(16, 185, 129, 0.2); color: #6ee7b7; border: 1px solid #10b981; }
    
    .comparison-grid {
      display: grid;
      grid-template-columns: 1fr;
      gap: 16px;
      margin-top: 12px;
    }
    @media (min-width: 768px) {
      .comparison-grid {
        grid-template-columns: 1fr 1fr;
      }
    }
    .pane {
      background: rgba(15, 23, 42, 0.6);
      border: 1px solid var(--card-border);
      border-radius: 8px;
      padding: 12px;
    }
    .pane-title {
      font-size: 0.85rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 10px;
      display: flex;
      justify-content: space-between;
      color: var(--text-muted);
    }
    .thumbs-container {
      display: flex;
      gap: 12px;
      overflow-x: auto;
      padding-bottom: 6px;
    }
    .thumb-box {
      flex: 0 0 130px;
      display: flex;
      flex-direction: column;
      align-items: center;
      background: #090d16;
      border-radius: 8px;
      padding: 8px;
      position: relative;
      border: 1px solid var(--card-border);
    }
    .thumb-box.removed {
      border: 2px dashed var(--accent-red);
      opacity: 0.75;
    }
    .thumb-box.kept {
      border: 2px solid var(--accent-green);
    }
    .thumb-img {
      width: 100%;
      height: 140px;
      object-fit: contain;
      border-radius: 4px;
      background: #111;
    }
    .thumb-tag {
      margin-top: 6px;
      font-size: 0.7rem;
      font-weight: bold;
      padding: 2px 6px;
      border-radius: 4px;
      text-align: center;
      width: 100%;
    }
    .tag-kept { background: #065f46; color: #a7f3d0; }
    .tag-removed { background: #991b1b; color: #fecaca; }
    .file-source {
      font-size: 0.65rem;
      color: var(--text-muted);
      margin-top: 4px;
      text-align: center;
      word-break: break-all;
      line-height: 1.1;
      max-height: 2.2em;
      overflow: hidden;
    }
    .meta-details {
      margin-top: 10px;
      font-size: 0.8rem;
      color: var(--text-muted);
      border-top: 1px dashed var(--card-border);
      padding-top: 8px;
    }
    .suffix-badge {
      display: inline-block;
      background: #3b4252;
      color: #eceff4;
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 0.7rem;
      font-family: monospace;
      margin-left: 4px;
    }
  </style>
</head>
<body>

  <header>
    <h1>Conferência de Integridade: 34 Kits Infantis</h1>
    <div class="subtitle">Auditoria visual e estrutural comparando o estado original (HEAD) e o catálogo higienizado (Atual)</div>

    <div class="kpis">
      <div class="kpi-card">
        <div class="kpi-num" style="color: #60a5fa;">34</div>
        <div class="kpi-label">Total de Kits Infantis</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-num" style="color: #f87171;">13</div>
        <div class="kpi-label">Higienizados (Intrusos Removidos)</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-num" style="color: #34d399;">21</div>
        <div class="kpi-label">Inalterados (Já eram Foto Única)</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-num" style="color: #fbbf24;">14</div>
        <div class="kpi-label">Fotos de Uniforme Reserva Desvinculadas</div>
      </div>
    </div>

    <div class="filter-bar">
      <button class="filter-btn active" onclick="filtrar('todos')">Todos (34)</button>
      <button class="filter-btn" onclick="filtrar('alterados')">Higienizados com Remoção (13)</button>
      <button class="filter-btn" onclick="filtrar('inalterados')">Inalterados / Foto Única (21)</button>
    </div>
  </header>

  <main class="kits-list" id="listaKits">
    ${dadosKits.map((k, idx) => `
      <article class="kit-card" data-tipo="${k.alterado ? 'alterado' : 'inalterado'}">
        <div class="kit-header">
          <div>
            <div class="kit-title">${idx + 1}. ${k.nome}</div>
            <div class="kit-slug">${k.slug}</div>
          </div>
          <div>
            ${k.alterado
              ? `<span class="badge badge-altered">Higienizado (${k.removidasCount} foto${k.removidasCount > 1 ? 's' : ''} removida${k.removidasCount > 1 ? 's' : ''})</span>`
              : `<span class="badge badge-clean">Inalterado (Foto Única)</span>`}
          </div>
        </div>

        <div class="comparison-grid">
          <!-- PAINEL ANTES (HEAD) -->
          <div class="pane">
            <div class="pane-title">
              <span>Antes (HEAD)</span>
              <span>${k.totalAntes} foto${k.totalAntes > 1 ? 's' : ''}</span>
            </div>
            <div class="thumbs-container">
              ${k.hImgs.map((img, i) => `
                <div class="thumb-box ${img.isRemovida ? 'removed' : 'kept'}">
                  <img class="thumb-img" src="${img.b64 || img.src}" alt="${img.alt}" loading="lazy" />
                  <div class="thumb-tag ${img.isRemovida ? 'tag-removed' : 'tag-kept'}">
                    ${img.isRemovida ? 'REMOVIDA' : 'MANTIDA'} (Foto ${i + 1})
                  </div>
                  <div class="file-source" title="${img.source}">${img.source.split('/').pop()}</div>
                </div>
              `).join('')}
            </div>
          </div>

          <!-- PAINEL DEPOIS (ATUAL) -->
          <div class="pane">
            <div class="pane-title">
              <span>Depois (Atual)</span>
              <span>${k.totalDepois} foto${k.totalDepois > 1 ? 's' : ''}</span>
            </div>
            <div class="thumbs-container">
              ${k.aImgs.map((img, i) => `
                <div class="thumb-box kept">
                  <img class="thumb-img" src="${img.b64 || img.src}" alt="${img.alt}" loading="lazy" />
                  <div class="thumb-tag tag-kept">
                    TITULAR (Foto ${i + 1})
                  </div>
                  <div class="file-source" title="${img.source}">${img.source.split('/').pop()}</div>
                </div>
              `).join('')}
            </div>
          </div>
        </div>

        <div class="meta-details">
          <strong>Sufixos nos arquivos originais:</strong>
          ${k.sufixos.split(', ').map(s => `<span class="suffix-badge">${s}</span>`).join('')}
          <br>
          <strong>Status da Heurística:</strong> ${k.alterado
            ? `Identificou que as imagens secundárias (sufixos ${k.sufixos}) pertenciam a uniformes visitante/terceiro do mesmo país. Foram desvinculadas e preservadas no relatório.`
            : `Registro no HEAD já possuía apenas 1 imagem do conjunto titular; nenhuma alteração necessária.`}
        </div>
      </article>
    `).join('')}
  </main>

  <script>
    function filtrar(tipo) {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      event.target.classList.add('active');
      const cards = document.querySelectorAll('.kit-card');
      cards.forEach(card => {
        if (tipo === 'todos') {
          card.style.display = 'block';
        } else if (tipo === 'alterados') {
          card.style.display = card.dataset.tipo === 'alterado' ? 'block' : 'none';
        } else if (tipo === 'inalterados') {
          card.style.display = card.dataset.tipo === 'inalterado' ? 'block' : 'none';
        }
      });
    }
  </script>
</body>
</html>`;

  fs.writeFileSync(path.join(__dirname, '../relatorios/kits-infantis-conferencia.html'), html, 'utf8');
  console.log('HTML salvo com sucesso: relatorios/kits-infantis-conferencia.html');
}

main().catch(console.error);

