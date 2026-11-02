// Separa em produtos distintos os álbuns que misturam camisas diferentes (ex.: casa e fora no mesmo produto).
//
// Uso (na raiz do projeto):
//   node scripts/aplicar-splits.mjs              -> aplica data/splits.json e grava data/products.json
//   node scripts/aplicar-splits.mjs --pendentes  -> só lista os produtos com 2+ fotos que ainda NÃO estão no splits.json
//   node scripts/aplicar-splits.mjs --nova-base  -> como o primeiro, mas adota o products.json atual como nova base
//                                                   (use logo depois de `npm run catalogar`, que gera produtos sem divisão)
//
// A divisão SEMPRE parte de data/products.backup.json, que guarda o catálogo sem divisões. Por isso o comando
// pode ser repetido (por exemplo depois de acrescentar mais produtos ao splits.json) sem duplicar nem perder fotos.
// Antes, rodar o script duas vezes dividia produtos já divididos e embaralhava as fotos.
//
// Formato de data/splits.json (índices de foto contam a partir de 0, na ordem de images do produto sem divisão):
//   { "<slug>": [ { "imagens": [0, 1], "uniforme": "titular" }, { "imagens": [2], "uniforme": "reserva" } ] }
import { copyFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";

const PRODUTOS = "data/products.json";
const SPLITS = "data/splits.json";
const BASE = "data/products.backup.json";

const args = new Set(process.argv.slice(2));
const soPendentes = args.has("--pendentes");
const novaBase = args.has("--nova-base");

// Valores do tipo Uniform em lib/types.ts: titular | reserva | terceiro | quarto | revisar
const NOME_UNIFORME = { titular: "Casa", reserva: "Fora", terceiro: "Terceira", quarto: "Quarta", revisar: "" };
const sufixoSlug = (g, n) => (g.uniforme && g.uniforme !== "revisar" ? g.uniforme : `modelo-${n + 1}`);
const lerJson = (arquivo) => JSON.parse(readFileSync(arquivo, "utf8"));

/** Catálogo sem divisões: o backup se existir; senão o products.json atual (que vira o backup). */
function carregarBase() {
  if (!novaBase && existsSync(BASE)) return { produtos: lerJson(BASE), gravarBase: false };
  const atuais = lerJson(PRODUTOS);
  // `divididoDe` marca o que este script gerou. Se o produto de origem ainda traz a marca, as fotos dele já foram
  // reduzidas e o arquivo não serve de base (é preciso regenerar com `npm run catalogar` antes).
  if (atuais.some((p) => p.divididoDe && p.divididoDe === p.slug)) {
    throw new Error(
      `${PRODUTOS} já está dividido e não pode virar base. Rode \`npm run catalogar\` primeiro (ele gera produtos sem divisão) ` +
      `ou use o ${BASE} existente (rode sem --nova-base).`,
    );
  }
  // Produtos criados por divisões anteriores são recriados a partir do splits.json.
  return { produtos: atuais.filter((p) => !p.divididoDe), gravarBase: true };
}

const categoria = (slug) =>
  slug.match(/^(camisa-jogador|camisa-manga-longa-torcedor|camisa-manga-longa-retro|femininas|kits-infantis|retro|selecoes|torcedor)/)?.[1]
  ?? slug.split("-")[0];

const { produtos: base, gravarBase } = carregarBase();
const splits = existsSync(SPLITS) ? lerJson(SPLITS) : {};
const porSlug = new Map(base.map((p) => [p.slug, p]));

// --- Validação do splits.json contra a base ---------------------------------------------------------------
const avisos = [];
for (const [slug, grupos] of Object.entries(splits)) {
  const p = porSlug.get(slug);
  if (!p) {
    avisos.push(`${slug}: não existe no catálogo base (ignorado)`);
    continue;
  }
  const total = p.images?.length ?? 0;
  const usados = grupos.flatMap((g) => g.imagens);
  const invalidos = usados.filter((i) => !Number.isInteger(i) || i < 0 || i >= total);
  if (invalidos.length) avisos.push(`${slug}: índices inválidos [${invalidos.join(", ")}] (o produto tem ${total} fotos)`);
  if (new Set(usados).size !== usados.length) avisos.push(`${slug}: a mesma foto aparece em mais de um grupo`);
  const sobram = [...Array(total).keys()].filter((i) => !usados.includes(i));
  if (sobram.length) avisos.push(`${slug}: foto(s) nº ${sobram.map((i) => i + 1).join(", ")} não estão em nenhum grupo e vão sumir do produto`);
}

// --- Produtos com várias fotos que ainda não foram tratados -----------------------------------------------
const pendentes = base.filter((p) => (p.images?.length ?? 0) >= 2 && !splits[p.slug]);

if (soPendentes) {
  const porCategoria = new Map();
  for (const p of pendentes) {
    const lista = porCategoria.get(categoria(p.slug)) ?? [];
    lista.push(p);
    porCategoria.set(categoria(p.slug), lista);
  }
  console.log(`Produtos com 2+ fotos que ainda não estão em ${SPLITS}: ${pendentes.length} de ${base.filter((p) => (p.images?.length ?? 0) >= 2).length}`);
  for (const [nome, lista] of [...porCategoria].sort((a, b) => b[1].length - a[1].length)) {
    console.log(`\n${nome} (${lista.length})`);
    for (const p of lista) console.log(`  ${p.slug}  [${p.images.length} fotos]`);
  }
  process.exit(0);
}

// --- Aplicação --------------------------------------------------------------------------------------------
if (gravarBase) {
  if (existsSync(BASE)) copyFileSync(BASE, `${BASE}.anterior`);
  writeFileSync(BASE, JSON.stringify(base, null, 2) + "\n");
}

const slugsUsados = new Set(base.map((p) => p.slug));
const resultado = [];
let divididos = 0;
let criados = 0;
let soRotulados = 0;

function renumerarAlt(images) {
  return images.map((im, i) => ({
    ...im,
    alt: typeof im.alt === "string" ? im.alt.replace(/foto \d+\s*$/, `foto ${i + 1}`) : im.alt,
  }));
}

for (const p of base) {
  const grupos = splits[p.slug];
  if (!grupos) {
    resultado.push(p);
    continue;
  }

  // Um grupo só: não divide, apenas grava o uniforme.
  if (grupos.length === 1) {
    const u = grupos[0].uniforme;
    resultado.push(u ? { ...p, uniforme: u } : p);
    if (u) soRotulados++;
    continue;
  }

  divididos++;
  grupos.forEach((g, n) => {
    const imagens = renumerarAlt(g.imagens.map((i) => p.images[i]).filter(Boolean));
    if (!imagens.length) return;
    const rotulo = NOME_UNIFORME[g.uniforme] ?? "";

    if (n === 0) {
      // O primeiro grupo mantém slug e id originais (links e carrinhos antigos continuam valendo).
      resultado.push({
        ...p,
        uniforme: g.uniforme || p.uniforme,
        nome: rotulo ? `${p.nome} – ${rotulo}` : p.nome,
        images: imagens,
        divididoDe: p.slug,
      });
      return;
    }

    let novoSlug = `${p.slug}-${sufixoSlug(g, n)}`;
    while (slugsUsados.has(novoSlug)) novoSlug += "-2";
    slugsUsados.add(novoSlug);
    const novoId = p.id.endsWith(p.slug) ? p.id.slice(0, -p.slug.length) + novoSlug : `${p.id}-${novoSlug}`;

    resultado.push({
      ...p,
      id: novoId,
      slug: novoSlug,
      imageSeed: novoSlug,
      uniforme: g.uniforme || "revisar",
      nome: rotulo ? `${p.nome} – ${rotulo}` : `${p.nome} – Modelo ${n + 1}`,
      images: imagens,
      divididoDe: p.slug,
    });
    criados++;
  });
}

writeFileSync(PRODUTOS, JSON.stringify(resultado, null, 2) + "\n");
console.log(`Produtos divididos: ${divididos}`);
console.log(`Produtos novos criados: ${criados}`);
console.log(`Só rotulados (sem divisão): ${soRotulados}`);
console.log(`Total agora: ${resultado.length} (base sem divisões: ${base.length})`);
console.log(`Base usada: ${BASE}${gravarBase ? " (atualizada agora)" : ""}`);
if (avisos.length) {
  console.warn(`\n${avisos.length} aviso(s) no ${SPLITS}:`);
  for (const aviso of avisos) console.warn(`  - ${aviso}`);
}
console.log(`\nAinda sem tratamento no ${SPLITS}: ${pendentes.length} produtos com 2+ fotos (veja a lista com --pendentes).`);
