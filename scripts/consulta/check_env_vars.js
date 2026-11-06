const fs = require('fs');
const path = require('path');

// Ler todos os arquivos .ts, .tsx, .js
function getAllFiles(dir, exts = ['.ts', '.tsx', '.js', '.mjs']) {
  let results = [];
  const list = fs.readdirSync(dir);
  for (const file of list) {
    if (file === 'node_modules' || file === '.next' || file === '.git' || file === 'relatorios' || file === 'scripts') continue;
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      results = results.concat(getAllFiles(fullPath, exts));
    } else if (exts.some(ext => file.endsWith(ext))) {
      results.push(fullPath);
    }
  }
  return results;
}

const files = getAllFiles(process.cwd());
const envRegex = /process\.env\.([A-Z0-9_]+)/g;
const foundVars = new Set();
const varLocations = {};

for (const f of files) {
  const content = fs.readFileSync(f, 'utf8');
  let match;
  while ((match = envRegex.exec(content)) !== null) {
    const varName = match[1];
    if (['NODE_ENV'].includes(varName)) continue;
    foundVars.add(varName);
    if (!varLocations[varName]) varLocations[varName] = [];
    const relPath = path.relative(process.cwd(), f).replace(/\\/g, '/');
    if (!varLocations[varName].includes(relPath)) {
      varLocations[varName].push(relPath);
    }
  }
}

// Ler .env.example
const envExamplePath = path.join(process.cwd(), '.env.example');
const envExampleVars = new Set();
if (fs.existsSync(envExamplePath)) {
  const lines = fs.readFileSync(envExamplePath, 'utf8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
      envExampleVars.add(trimmed.split('=')[0].trim());
    }
  }
}

console.log('=== VARIÁVEIS DE AMBIENTE LIDAS NO CÓDIGO ===');
console.log(`Total identificadas: ${foundVars.size}`);

const report = [];
for (const v of Array.from(foundVars).sort()) {
  const inExample = envExampleVars.has(v);
  const locs = varLocations[v] || [];
  let impact = 'Opcional / Fallback seguro';
  if (['NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'MERCADO_PAGO_ACCESS_TOKEN', 'MERCADOPAGO_ACCESS_TOKEN'].includes(v)) {
    impact = 'CRÍTICA: Se ausente, quebra catálogo ou checkout';
  } else if (['MERCADO_PAGO_WEBHOOK_SECRET', 'MERCADOPAGO_WEBHOOK_SECRET'].includes(v)) {
    impact = 'CRÍTICA: Se ausente, webhook retorna 401 e não aprova pedidos automaticamente';
  } else if (['ADMIN_TOKEN', 'ADMIN_SESSION_SECRET'].includes(v)) {
    impact = 'ALTA: Se ausente, painel admin bloqueia login';
  } else if (['CRON_SECRET'].includes(v)) {
    impact = 'MÉDIA: Cron de reconciliação na Vercel falha sem ela';
  }

  report.push({
    variavel: v,
    no_env_example: inExample,
    impacto: impact,
    onde_le: locs.join(', '),
  });
}

console.table(report.map(r => ({ variavel: r.variavel, no_env_example: r.no_env_example, impacto: r.impacto })));
fs.writeFileSync(path.join(process.cwd(), 'scripts', 'consulta', 'env_vars_report.json'), JSON.stringify(report, null, 2));

