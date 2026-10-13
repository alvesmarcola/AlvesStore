import { patchOptions } from "@/data/patches";
import type { Product } from "@/lib/types";

export function getAvailablePatches(product: Product) {
  return patchOptions.filter((patch) => patch.verified
    && patch.commerciallyAvailable
    && patch.priceCents >= 0
    && patch.productIds.includes(product.id)
    && (!patch.seasons.length || patch.seasons.includes(product.temporada))
    && patch.positions.length > 0
    && patch.sourceUrl.startsWith("https://")
    && patch.image.startsWith("/"));
}
