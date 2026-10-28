import { patchOptions } from "@/data/patches";
import { isFormulaOneProduct } from "@/lib/formula-one";
import type { Product } from "@/lib/types";

export function getAvailablePatches(product: Product) {
  // Patches de competição atuais não combinam com camisas retrô nem com Fórmula 1.
  // Um produto listado em `productIds` continua valendo, porque é uma escolha explícita.
  const acceptsCompetitionPatches = product.tipo !== "retro" && !isFormulaOneProduct(product);
  return patchOptions.filter((patch) => patch.verified
    && patch.commerciallyAvailable
    && patch.priceCents >= 0
    && (patch.productIds.includes(product.id)
      || (acceptsCompetitionPatches
        && (patch.leagueSlugs?.includes(product.liga) === true || patch.clubSlugs?.includes(product.clubeSlug) === true)))
    && (!patch.seasons.length || patch.seasons.includes(product.temporada))
    && patch.positions.length > 0
    && (!patch.image || patch.image.startsWith("/")));
}
