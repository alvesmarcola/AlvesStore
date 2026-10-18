import type { Product } from "@/lib/types";

const FORMULA_ONE_TERM = /\b(?:f1|formula[-\s]*1|formula[-\s]*one|automobilismo|scuderia|ferrari|red[-\s]*bull(?:[-\s]*racing)?|mclaren|mercedes(?:[-\s]*amg)?|senna|aston[-\s]*martin|alpine|williams|haas)\b/;

export function isFormulaOneProduct(product: Product) {
  const evidence = [
    product.liga,
    product.tipo,
    product.nome,
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

  return product.tipo === "formula1" || FORMULA_ONE_TERM.test(evidence);
}
