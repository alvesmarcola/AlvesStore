import { patchOptions } from "@/data/patches";
import type { Product } from "@/lib/types";

export function getAvailablePatches(product: Product) {
  return patchOptions.filter((patch) => patch.verified
    && patch.commerciallyAvailable
    && patch.priceCents >= 0
    && (patch.productIds.includes(product.id) || patch.leagueSlugs?.includes(product.liga) === true)
    && (!patch.seasons.length || patch.seasons.includes(product.temporada))
    && patch.positions.length > 0
    && (!patch.image || patch.image.startsWith("/")));
}
