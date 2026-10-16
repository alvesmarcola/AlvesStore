import type { Product } from "@/lib/types";

const FORMULA_ONE_TERM = /\b(?:f1|formula[-\s]*1|formula[-\s]*one)\b/;

export function isFormulaOneProduct(product: Product) {
  const evidence = [
    product.liga,
    product.tipo,
    product.nome,
    product.slug,
    product.clube,
    product.clubeSlug,
    product.imageSeed,
    ...(product.images ?? []).flatMap((image) => [image.source, image.src]),
  ].join(" ").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");

  return FORMULA_ONE_TERM.test(evidence);
}
