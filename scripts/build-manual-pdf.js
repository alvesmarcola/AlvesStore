const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function inlineFormat(text) {
  // Inline code: `code`
  text = text.replace(/`([^`]+)`/g, (match, p1) => `<code>${escapeHtml(p1)}</code>`);
  // Bold: **text**
  text = text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  // Italic: *text* or _text_
  text = text.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  // Links: [text](url)
  text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
  return text;
}

function markdownToHtml(md) {
  // 1. Extract fenced code blocks
  const codeBlocks = [];
  md = md.replace(/```([a-zA-Z0-9_-]*)\r?\n([\s\S]*?)```/g, (match, lang, code) => {
    const idx = codeBlocks.length;
    codeBlocks.push({ lang, code });
    return `%%CODE_BLOCK_${idx}%%`;
  });

  const lines = md.split(/\r?\n/);
  const out = [];

  let inTable = false;
  let tableRows = [];
  let inUl = false;
  let inOl = false;
  let inAlert = false;
  let alertType = '';
  let alertLines = [];

  function closeLists() {
    if (inUl) {
      out.push('</ul>');
      inUl = false;
    }
    if (inOl) {
      out.push('</ol>');
      inOl = false;
    }
  }

  function closeAlert() {
    if (inAlert) {
      const alertClass = `alert alert-${alertType.toLowerCase()}`;
      out.push(`<div class="${alertClass}">`);
      for (const line of alertLines) {
        out.push(`<p>${inlineFormat(line)}</p>`);
      }
      out.push('</div>');
      inAlert = false;
      alertType = '';
      alertLines = [];
    }
  }

  function flushTable() {
    if (!inTable) return;
    inTable = false;
    if (tableRows.length === 0) return;

    out.push('<table class="data-table">');
    // Header row
    const headerCols = tableRows[0].map(c => inlineFormat(c.trim()));
    out.push('<thead><tr>');
    headerCols.forEach(col => out.push(`<th>${col}</th>`));
    out.push('</tr></thead>');

    // Body rows (skip row 1 if it is separator)
    out.push('<tbody>');
    for (let r = 1; r < tableRows.length; r++) {
      const row = tableRows[r];
      // Check if separator like :--- or ---
      if (row.every(c => /^:?-+:?$/.test(c.trim()))) {
        continue;
      }
      out.push('<tr>');
      row.forEach(c => out.push(`<td>${inlineFormat(c.trim())}</td>`));
      out.push('</tr>');
    }
    out.push('</tbody></table>');
    tableRows = [];
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Code block placeholder
    if (trimmed.startsWith('%%CODE_BLOCK_') && trimmed.endsWith('%%')) {
      closeLists();
      closeAlert();
      flushTable();
      const idx = parseInt(trimmed.replace('%%CODE_BLOCK_', '').replace('%%', ''), 10);
      const cb = codeBlocks[idx];
      out.push(`<pre class="code-block ${cb.lang}"><code>${escapeHtml(cb.code.trimEnd())}</code></pre>`);
      continue;
    }

    // Alert start: > [!CAUTION] / > [!WARNING] / > [!NOTE] / > [!TIP] / > [!IMPORTANT]
    const alertMatch = trimmed.match(/^>\s*\[!(CAUTION|WARNING|NOTE|TIP|IMPORTANT)\]/i);
    if (alertMatch) {
      closeLists();
      closeAlert();
      flushTable();
      inAlert = true;
      alertType = alertMatch[1].toUpperCase();
      alertLines = [];
      continue;
    }

    if (inAlert) {
      if (trimmed.startsWith('>')) {
        const alertContent = trimmed.replace(/^>\s?/, '');
        alertLines.push(alertContent);
        continue;
      } else if (trimmed === '') {
        // Can be inside alert or close it
        if (i + 1 < lines.length && lines[i + 1].trim().startsWith('>')) {
          continue;
        } else {
          closeAlert();
          continue;
        }
      } else {
        closeAlert();
      }
    }

    // Markdown Table
    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      closeLists();
      closeAlert();
      inTable = true;
      // split by |
      const cols = trimmed.slice(1, -1).split('|');
      tableRows.push(cols);
      continue;
    } else if (inTable) {
      flushTable();
    }

    // Horizontal Rule
    if (/^---{1,}$/.test(trimmed) || /^\*\*\*{1,}$/.test(trimmed)) {
      closeLists();
      closeAlert();
      flushTable();
      out.push('<hr />');
      continue;
    }

    // Headings
    if (trimmed.startsWith('#')) {
      closeLists();
      closeAlert();
      flushTable();

      const hMatch = trimmed.match(/^(#{1,6})\s+(.*)$/);
      if (hMatch) {
        const level = hMatch[1].length;
        const text = hMatch[2];

        // Assign IDs to h2 like ## 1. Visão Geral -> id="secao-1"
        let idAttr = '';
        const secMatch = text.match(/^(\d+)\.\s+/);
        if (level === 2 && secMatch) {
          idAttr = ` id="secao-${secMatch[1]}" class="section-h2"`;
        } else if (level === 2 && text.includes('Itens para Conferência Manual')) {
          idAttr = ' id="secao-verificar" class="section-h2"';
        } else if (level === 2 && text.includes('Emergência')) {
          idAttr = ' id="secao-emergencia" class="section-h2 section-emergency"';
        }

        out.push(`<h${level}${idAttr}>${inlineFormat(text)}</h${level}>`);
        continue;
      }
    }

    // Unordered List (- or *)
    const ulMatch = trimmed.match(/^[-*]\s+(.*)$/);
    if (ulMatch) {
      flushTable();
      closeAlert();
      if (inOl) closeLists();
      if (!inUl) {
        out.push('<ul>');
        inUl = true;
      }
      out.push(`<li>${inlineFormat(ulMatch[1])}</li>`);
      continue;
    }

    // Ordered List (1. 2. etc.)
    const olMatch = trimmed.match(/^(\d+)\.\s+(.*)$/);
    if (olMatch) {
      flushTable();
      closeAlert();
      if (inUl) closeLists();
      if (!inOl) {
        out.push('<ol>');
        inOl = true;
      }
      out.push(`<li>${inlineFormat(olMatch[2])}</li>`);
      continue;
    }

    // Regular Blockquote (> text)
    if (trimmed.startsWith('>')) {
      closeLists();
      closeAlert();
      flushTable();
      const quoteText = trimmed.replace(/^>\s?/, '');
      out.push(`<blockquote><p>${inlineFormat(quoteText)}</p></blockquote>`);
      continue;
    }

    // Blank line
    if (trimmed === '') {
      closeLists();
      closeAlert();
      flushTable();
      continue;
    }

    // Regular Paragraph
    closeLists();
    closeAlert();
    flushTable();
    out.push(`<p>${inlineFormat(trimmed)}</p>`);
  }

  closeLists();
  closeAlert();
  flushTable();

  return out.join('\n');
}

function buildHtmlDocument(contentHtml) {
  const currentDate = '08 de Novembro de 2026';

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<title>Manual Imports Alves</title>
<style>
  @page {
    size: A4;
    margin: 20mm 15mm 20mm 15mm;
  }
  * {
    box-sizing: border-box;
  }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    font-size: 9pt;
    line-height: 1.5;
    color: #24292f;
    margin: 0;
    padding: 0;
  }
  .page-break {
    page-break-after: always;
    break-after: page;
  }
  .page-break-before {
    page-break-before: always;
    break-before: page;
  }

  /* Cover Page */
  .cover-container {
    height: 88vh;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    padding: 30mm 15mm 20mm 15mm;
    page-break-after: always;
    break-after: page;
    border: 1px solid #e1e4e8;
    background: linear-gradient(180deg, #fafbfc 0%, #ffffff 100%);
    border-radius: 8px;
  }
  .cover-header {
    border-bottom: 3px solid #0969da;
    padding-bottom: 25px;
  }
  .cover-badge {
    display: inline-block;
    padding: 4px 12px;
    font-size: 8pt;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: #0969da;
    background-color: #ddf4ff;
    border-radius: 20px;
    margin-bottom: 15px;
  }
  .cover-title {
    font-size: 28pt;
    font-weight: 800;
    color: #1f2328;
    margin: 0 0 10px 0;
    line-height: 1.15;
  }
  .cover-subtitle {
    font-size: 13pt;
    color: #57606a;
    font-weight: 400;
    margin: 0;
    line-height: 1.4;
  }
  .cover-meta {
    margin-top: 40px;
    background: #ffffff;
    padding: 20px 24px;
    border: 1px solid #d0d7de;
    border-radius: 6px;
  }
  .cover-meta-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    row-gap: 12px;
    column-gap: 20px;
    font-size: 9pt;
  }
  .cover-meta-item strong {
    color: #1f2328;
  }
  .cover-footer {
    border-top: 1px solid #d0d7de;
    padding-top: 20px;
    font-size: 8.5pt;
    color: #6e7781;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .confidential-tag {
    color: #cf222e;
    font-weight: 600;
  }

  /* Table of Contents */
  .toc-container {
    page-break-after: always;
    break-after: page;
    padding-top: 10px;
  }
  .toc-title {
    font-size: 18pt;
    font-weight: 700;
    border-bottom: 2px solid #0969da;
    padding-bottom: 8px;
    margin-bottom: 20px;
    color: #1f2328;
  }
  .toc-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    column-gap: 30px;
    row-gap: 8px;
  }
  .toc-item {
    font-size: 9pt;
    line-height: 1.4;
    padding: 4px 0;
    border-bottom: 1px dotted #e1e4e8;
  }
  .toc-item a {
    text-decoration: none;
    color: #0969da;
    font-weight: 500;
    display: flex;
    justify-content: space-between;
  }
  .toc-item a:hover {
    text-decoration: underline;
  }

  /* Headings */
  h1 {
    font-size: 18pt;
    font-weight: 700;
    color: #1f2328;
    margin-top: 24px;
    margin-bottom: 12px;
    border-bottom: 2px solid #0969da;
    padding-bottom: 6px;
    break-after: avoid;
  }
  h2 {
    font-size: 14pt;
    font-weight: 700;
    color: #1f2328;
    margin-top: 28px;
    margin-bottom: 10px;
    border-bottom: 1px solid #d0d7de;
    padding-bottom: 6px;
    break-after: avoid;
  }
  .section-h2 {
    page-break-before: always;
    break-before: page;
    padding-top: 10px;
  }
  h3 {
    font-size: 11pt;
    font-weight: 600;
    color: #24292f;
    margin-top: 18px;
    margin-bottom: 8px;
    break-after: avoid;
  }
  h4 {
    font-size: 9.5pt;
    font-weight: 600;
    color: #24292f;
    margin-top: 14px;
    margin-bottom: 6px;
    break-after: avoid;
  }

  /* Text & Lists */
  p {
    margin: 0 0 8px 0;
  }
  ul, ol {
    margin: 4px 0 10px 20px;
    padding: 0;
  }
  li {
    margin-bottom: 4px;
  }
  hr {
    border: 0;
    border-top: 1px solid #d0d7de;
    margin: 20px 0;
  }
  blockquote {
    margin: 10px 0;
    padding: 8px 14px;
    color: #57606a;
    background-color: #f6f8fa;
    border-left: 4px solid #d0d7de;
    border-radius: 0 4px 4px 0;
  }
  blockquote p {
    margin: 0;
  }

  /* Code & Syntax */
  code {
    font-family: "JetBrains Mono", Consolas, "Liberation Mono", Menlo, Courier, monospace;
    font-size: 8pt;
    background-color: rgba(175, 184, 193, 0.2);
    padding: 0.15em 0.35em;
    border-radius: 4px;
  }
  pre.code-block {
    background-color: #f6f8fa;
    border: 1px solid #d0d7de;
    border-radius: 6px;
    padding: 10px 12px;
    margin: 10px 0;
    overflow-x: hidden;
    page-break-inside: avoid;
    break-inside: avoid;
  }
  pre.code-block code {
    background: transparent;
    padding: 0;
    font-size: 7.5pt;
    line-height: 1.45;
    white-space: pre-wrap;
    word-break: break-word;
    overflow-wrap: break-word;
    display: block;
    color: #24292f;
  }

  /* Tables */
  table.data-table {
    width: 100%;
    border-collapse: collapse;
    margin: 12px 0;
    font-size: 8pt;
    page-break-inside: auto;
  }
  table.data-table th, table.data-table td {
    border: 1px solid #d0d7de;
    padding: 6px 8px;
    text-align: left;
    vertical-align: top;
  }
  table.data-table th {
    background-color: #f6f8fa;
    font-weight: 600;
    color: #1f2328;
  }
  table.data-table tr:nth-child(even) {
    background-color: #fafbfc;
  }
  table.data-table tr {
    page-break-inside: avoid;
    break-inside: avoid;
  }

  /* Alerts */
  .alert {
    padding: 10px 14px;
    margin: 12px 0;
    border-left: 4px solid #0969da;
    border-radius: 4px;
    page-break-inside: avoid;
    break-inside: avoid;
  }
  .alert p {
    margin: 0 0 4px 0;
  }
  .alert p:last-child {
    margin: 0;
  }
  .alert-caution {
    background-color: #ffebe9;
    border-left-color: #cf222e;
    color: #82071e;
  }
  .alert-warning {
    background-color: #fff8c5;
    border-left-color: #9a6700;
    color: #633c01;
  }
  .alert-note, .alert-important {
    background-color: #ddf4ff;
    border-left-color: #0969da;
    color: #0550ae;
  }
  .alert-tip {
    background-color: #dafbe1;
    border-left-color: #1a7f37;
    color: #116329;
  }

  /* Emergency Page Specific */
  .section-emergency {
    page-break-before: always !important;
    break-before: page !important;
    background: #fff8f8;
    padding: 12px 14px;
    border: 2px solid #cf222e;
    border-radius: 6px;
  }
  .section-emergency h2 {
    color: #cf222e;
    border-bottom: 2px solid #cf222e;
  }
</style>
</head>
<body>

  <!-- CAPA -->
  <div class="cover-container">
    <div class="cover-header">
      <div class="cover-badge">Documentação Técnica Oficial</div>
      <h1 class="cover-title">Manual Imports Alves</h1>
      <p class="cover-subtitle">Manual Completo de Operação, Manutenção e Reconstrução do Site</p>
    </div>

    <div class="cover-meta">
      <div class="cover-meta-grid">
        <div class="cover-meta-item"><strong>Projeto:</strong> Imports Alves (Loja Virtual)</div>
        <div class="cover-meta-item"><strong>Repositório:</strong> AlvesStore</div>
        <div class="cover-meta-item"><strong>Versão do Manual:</strong> 1.0.0 (Revisão Final)</div>
        <div class="cover-meta-item"><strong>Data de Emissão:</strong> ${currentDate}</div>
        <div class="cover-meta-item"><strong>Stack:</strong> Next.js 15, TypeScript, Supabase</div>
        <div class="cover-meta-item"><strong>Gateway:</strong> Mercado Pago (Checkout Pro)</div>
      </div>
    </div>

    <div class="cover-footer">
      <div>Imports Alves &bull; Documento Operacional</div>
      <div class="confidential-tag">DOCUMENTO CONFIDENCIAL — NÃO CONTÉM CHAVES OU DADOS PESSOAIS</div>
    </div>
  </div>

  <!-- SUMÁRIO EXECUTIVO -->
  <div class="toc-container">
    <div class="toc-title">Sumário das Seções</div>
    <div class="toc-grid">
      <div class="toc-item"><a href="#secao-1"><span>1. Visão Geral</span></a></div>
      <div class="toc-item"><a href="#secao-2"><span>2. Inventário de Contas e Serviços</span></a></div>
      <div class="toc-item"><a href="#secao-3"><span>3. Tecnologias e Estrutura do Código</span></a></div>
      <div class="toc-item"><a href="#secao-4"><span>4. Como Rodar Localmente do Zero</span></a></div>
      <div class="toc-item"><a href="#secao-5"><span>5. Variáveis de Ambiente</span></a></div>
      <div class="toc-item"><a href="#secao-6"><span>6. Banco de Dados (Supabase)</span></a></div>
      <div class="toc-item"><a href="#secao-7"><span>7. Fluxos Principais Passo a Passo</span></a></div>
      <div class="toc-item"><a href="#secao-8"><span>8. Painel Administrativo</span></a></div>
      <div class="toc-item"><a href="#secao-9"><span>9. Catálogo e Robôs Yupoo (yupooBot)</span></a></div>
      <div class="toc-item"><a href="#secao-10"><span>10. Gateway Mercado Pago</span></a></div>
      <div class="toc-item"><a href="#secao-11"><span>11. E-mails e WhatsApp Transacionais</span></a></div>
      <div class="toc-item"><a href="#secao-12"><span>12. Deploy, Branches e Domínio na Vercel</span></a></div>
      <div class="toc-item"><a href="#secao-13"><span>13. Rotina de Manutenção Recomendada</span></a></div>
      <div class="toc-item"><a href="#secao-14"><span>14. Backup e Recuperação de Desastres</span></a></div>
      <div class="toc-item"><a href="#secao-15"><span>15. Segurança Crítica e Rotação</span></a></div>
      <div class="toc-item"><a href="#secao-16"><span>16. Roteiro de Reconstrução do Zero</span></a></div>
      <div class="toc-item"><a href="#secao-17"><span>17. Estado Atual e Pendências</span></a></div>
      <div class="toc-item"><a href="#secao-18"><span>18. Problemas Conhecidos e Soluções</span></a></div>
      <div class="toc-item"><a href="#secao-19"><span>19. Glossário de Termos Técnicos</span></a></div>
      <div class="toc-item"><a href="#secao-20"><span>20. Anexo: Comandos Úteis</span></a></div>
      <div class="toc-item"><a href="#secao-verificar"><span>Itens para Conferência Manual</span></a></div>
      <div class="toc-item" style="border-bottom: 2px solid #cf222e;"><a href="#secao-emergencia" style="color: #cf222e; font-weight: 700;"><span>🚨 Emergência em 1 Página</span></a></div>
    </div>
  </div>

  <!-- CONTEÚDO PRINCIPAL -->
  <div class="content-body">
    ${contentHtml}
  </div>

</body>
</html>`;
}

function main() {
  const mdPath = path.resolve('docs/MANUAL-LOJA.md');
  const htmlPath = path.resolve('docs/MANUAL-LOJA.html');
  const pdfPath = path.resolve('docs/MANUAL-LOJA.pdf');

  console.log('Reading Markdown:', mdPath);
  const md = fs.readFileSync(mdPath, 'utf8');

  console.log('Converting Markdown to HTML...');
  const contentHtml = markdownToHtml(md);
  const fullHtml = buildHtmlDocument(contentHtml);

  fs.writeFileSync(htmlPath, fullHtml, 'utf8');
  console.log('HTML written to:', htmlPath, 'Size:', fs.statSync(htmlPath).size);

  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const args = [
    '--headless=new',
    '--disable-gpu',
    `--print-to-pdf="${pdfPath}"`,
    '--header-template="<div style=\'font-size:7.5pt;width:100%;text-align:center;color:#666;font-family:sans-serif;padding-top:4mm;\'>Documento confidencial — não contém chaves</div>"',
    '--footer-template="<div style=\'font-size:7.5pt;width:100%;padding:0 15mm 4mm 15mm;display:flex;justify-content:space-between;color:#666;font-family:sans-serif;\'><span>Documento confidencial — não contém chaves</span><span>Página <span class=\'pageNumber\'></span> de <span class=\'totalPages\'></span></span></div>"',
    `"${htmlPath}"`
  ];

  console.log('Generating PDF with Chrome headless...');
  const cmd = `"${chromePath}" ${args.join(' ')}`;
  execSync(cmd, { stdio: 'inherit' });

  if (fs.existsSync(pdfPath)) {
    const stats = fs.statSync(pdfPath);
    console.log('=== PDF GENERATED SUCCESSFULLY ===');
    console.log('Full Path:', pdfPath);
    console.log('File Size:', stats.size, 'bytes (' + (stats.size / 1024).toFixed(1) + ' KB)');
  } else {
    console.error('ERROR: PDF was not created!');
    process.exit(1);
  }

  // Delete intermediate HTML file if desired, or keep it clean
  fs.unlinkSync(htmlPath);
  console.log('Temporary HTML file removed.');
}

main();
