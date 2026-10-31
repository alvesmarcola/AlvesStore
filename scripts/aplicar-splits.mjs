// Uso (na raiz do projeto):  node scripts/aplicar-splits.mjs
// Lê data/products.json + data/splits.json e grava o products.json já com os produtos divididos.
// Faz backup em data/products.backup.json antes de mexer.
import { readFileSync, writeFileSync, copyFileSync, existsSync } from "node:fs";

const PRODUTOS = "data/products.json";
const SPLITS = "data/splits.json";
const BACKUP = "data/products.backup.json";

// Valores do tipo Uniform em lib/types.ts: titular | reserva | terceiro | quarto | revisar
const NOME_UNIFORME = { titular: "Casa", reserva: "Fora", terceiro: "Terceira", quarto: "Quarta", revisar: "" };
const sufixoSlug = (g, n) => (g.uniforme && g.uniforme !== "revisar" ? g.uniforme : `modelo-${n + 1}`);

const produtos = JSON.parse(readFileSync(PRODUTOS, "utf8"));
const splits = JSON.parse(readFileSync(SPLITS, "utf8"));

if (!existsSync(BACKUP)) copyFileSync(PRODUTOS, BACKUP);

const slugsUsados = new Set(produtos.map((p) => p.slug));
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

for (const p of produtos) {
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
    });
    criados++;
  });
}

writeFileSync(PRODUTOS, JSON.stringify(resultado, null, 2) + "\n");
console.log(`Produtos divididos: ${divididos}`);
console.log(`Produtos novos criados: ${criados}`);
console.log(`Só rotulados (sem divisão): ${soRotulados}`);
console.log(`Total agora: ${resultado.length} (antes: ${produtos.length})`);
console.log(`Backup em ${BACKUP}`);
