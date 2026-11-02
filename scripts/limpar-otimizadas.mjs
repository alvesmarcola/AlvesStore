// Remove de public/otimizadas tudo o que o site não usa.
//
// Uso (na raiz do projeto):
//   node scripts/limpar-otimizadas.mjs           -> só mostra o que seria apagado (nada é removido)
//   node scripts/limpar-otimizadas.mjs --apply   -> apaga de verdade
//
// O que conta como "usado": qualquer caminho /otimizadas/....webp citado em data/*.json, data/*.ts
// ou no código (app, components, lib, store). Os arquivos -400.webp e -1600.webp nunca são citados
// (o catálogo só usa -800.webp), então saem junto com as pastas de produtos que não existem mais.
// Tudo é regenerável com `npm run catalogar`, e o histórico do Git guarda o que for apagado.
import { existsSync, readdirSync, readFileSync, rmdirSync, statSync, unlinkSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pastaImagens = path.join(raiz, "public", "otimizadas");
const apply = process.argv.includes("--apply");

function listar(dir, filtro) {
  if (!existsSync(dir)) return [];
  const saida = [];
  for (const entrada of readdirSync(dir, { withFileTypes: true })) {
    const caminho = path.join(dir, entrada.name);
    if (entrada.isDirectory()) {
      if (entrada.name === "node_modules" || entrada.name === ".next") continue;
      saida.push(...listar(caminho, filtro));
    } else if (filtro(entrada.name)) {
      saida.push(caminho);
    }
  }
  return saida;
}

// 1) Caminhos citados no catálogo (inclui products.backup.json, base do aplicar-splits) e no código.
const fontes = [
  ...listar(path.join(raiz, "data"), (nome) => /\.(json|ts)$/.test(nome)),
  ...["app", "components", "lib", "store"].flatMap((pasta) => listar(path.join(raiz, pasta), (nome) => /\.(tsx?|css)$/.test(nome))),
];
const usados = new Set();
for (const arquivo of fontes) {
  const texto = readFileSync(arquivo, "utf8");
  for (const achado of texto.matchAll(/\/otimizadas\/[^"'`\\\s)]+?\.webp/g)) {
    usados.add(decodeURI(achado[0]));
  }
}
if (usados.size < 10) {
  console.error(`Só ${usados.size} imagens citadas no catálogo; parece haver algo errado. Nada foi apagado.`);
  process.exit(1);
}

// 2) Arquivos que existem no disco.
const noDisco = listar(pastaImagens, () => true);
const relativo = (arquivo) => "/" + path.relative(path.join(raiz, "public"), arquivo).split(path.sep).join("/");
const faltando = [...usados].filter((url) => !existsSync(path.join(raiz, "public", url)));
const sobrando = noDisco.filter((arquivo) => !usados.has(relativo(arquivo)));
const naoWebp = sobrando.filter((arquivo) => !arquivo.endsWith(".webp"));
const apagaveis = sobrando.filter((arquivo) => arquivo.endsWith(".webp"));

const mb = (bytes) => `${(bytes / 1e6).toFixed(0)} MB`;
const tamanho = (arquivos) => arquivos.reduce((soma, arquivo) => soma + statSync(arquivo).size, 0);
const porLargura = {};
for (const arquivo of apagaveis) {
  const largura = arquivo.match(/-(\d+)\.webp$/)?.[1] ?? "outro";
  porLargura[largura] ??= { n: 0, bytes: 0 };
  porLargura[largura].n++;
  porLargura[largura].bytes += statSync(arquivo).size;
}

console.log(`Imagens citadas no catálogo/código: ${usados.size}`);
console.log(`No disco: ${noDisco.length} arquivos (${mb(tamanho(noDisco))})`);
console.log(`Não usadas: ${apagaveis.length} arquivos (${mb(tamanho(apagaveis))})`);
for (const [largura, { n, bytes }] of Object.entries(porLargura).sort()) console.log(`  -${largura}: ${n} arquivos (${mb(bytes)})`);
if (naoWebp.length) console.log(`Ignorados (não são .webp, não serão tocados): ${naoWebp.length}`);
if (faltando.length) {
  console.warn(`\nATENÇÃO: ${faltando.length} imagem(ns) citada(s) no catálogo não existe(m) no disco, por exemplo:`);
  for (const url of faltando.slice(0, 5)) console.warn(`  ${url}`);
}

if (!apply) {
  console.log("\nPrévia: nada foi apagado. Rode com --apply para remover.");
  process.exit(0);
}

for (const arquivo of apagaveis) unlinkSync(arquivo);
// Remove pastas que ficaram vazias (de baixo para cima).
let pastasRemovidas = 0;
function limparPastasVazias(dir) {
  for (const entrada of readdirSync(dir, { withFileTypes: true })) {
    if (entrada.isDirectory()) limparPastasVazias(path.join(dir, entrada.name));
  }
  if (dir !== pastaImagens && readdirSync(dir).length === 0) {
    rmdirSync(dir);
    pastasRemovidas++;
  }
}
limparPastasVazias(pastaImagens);
console.log(`\nApagados: ${apagaveis.length} arquivos e ${pastasRemovidas} pastas vazias.`);
