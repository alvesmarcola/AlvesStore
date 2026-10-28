import type { Product } from "@/lib/types";

const FORMULA_ONE_TERM = /\b(?:f1|formula[-\s]*1|formula[-\s]*one|automobilismo|scuderia|ferrari|red[-\s]*bull(?:[-\s]*racing)?|mclaren|mercedes(?:[-\s]*amg)?|senna|aston[-\s]*martin|alpine|williams|haas)\b/;

export function isFormulaOneEvidence(value: string) {
  const normalized = value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR")
    .replace(/\bred[-\s]*bull[-\s]+bragantino\b/g, "bragantino");
  return FORMULA_ONE_TERM.test(normalized);
}

/** Camisas de Fórmula 1 não aceitam personalização de nome e número. */
export function allowsCustomization(product: Pick<Product, "tipo">) {
  return product.tipo !== "formula1";
}

export function isFormulaOneProduct(product: Product) {
  const evidence = [
    product.liga,
    product.tipo,
    product.nome,
    product.title,
    product.name,
    product.model,
    product.version,
    product.slug,
    product.clube,
    product.clubeSlug,
    product.category,
    product.league,
    product.liga,
    product.subcategory,
    ...(product.tags ?? []),
    product.imageSeed,
    ...(product.images ?? []).flatMap((image) => [image.source, image.src]),
  ].join(" ").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");

  return product.tipo === "formula1" || isFormulaOneEvidence(evidence);
}
