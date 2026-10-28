import type { Product, ProductType } from "@/lib/types";

function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");
}

export function isFeminineProduct(product: Product) {
  const evidence = [
    product.publico,
    product.gender,
    product.category,
    product.subcategory,
    ...(product.tags ?? []),
    product.nome,
    product.title,
    product.name,
    product.slug,
    product.imageSeed,
    ...(product.images ?? []).flatMap((image) => [image.src, image.source, image.alt]),
  ].filter(Boolean).join(" ");
  return product.publico === "feminino" || product.publico === "unissex" || /feminin|baby[\s-]*look|women|woman|ladies/.test(normalize(evidence));
}

function inferFeminineType(product: Product): ProductType {
  const evidence = normalize([
    product.tipo,
    product.category,
    product.subcategory,
    ...(product.tags ?? []),
    product.nome,
    product.slug,
    product.imageSeed,
    ...(product.images ?? []).map((image) => image.source),
  ].join(" "));
  if (/\b(goleir[oa]|goalkeeper|keeper|gk)\b/.test(evidence)) return "goleiro";
  if (/\b(treino|training|pre jogo|pre match)\b/.test(evidence)) return "treino";
  if (/\b(retro|vintage)\b/.test(evidence)) return "retro";
  if (/\b(jogador|player)\b/.test(evidence)) return "jogador";
  if (/\b(f1|formula\s*1|formula\s*one)\b/.test(evidence)) return "f1";
  if (/\b(cropped|regata|inverno|corta vento|windbreaker)\b/.test(evidence)) {
    if (/\bcropped\b/.test(evidence)) return "cropped";
    if (/\bregata\b/.test(evidence)) return "regata";
    return "inverno";
  }
  return "torcedor";
}

export function prepareFeminineProduct(product: Product): Product {
  return {
    ...product,
    publico: "feminino",
    tipo: product.tipo === "revisar" ? inferFeminineType(product) : product.tipo,
  };
}
