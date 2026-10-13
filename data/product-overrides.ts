import type { ShirtVersion, SleeveType, Uniform } from "@/lib/types";
import overrides from "@/data/product-overrides.json";

/** Correções verificadas pelo administrador prevalecem sobre qualquer sugestão derivada do catálogo. */
export const productOverrides: Record<string, {
  version?: ShirtVersion;
  sleeve?: SleeveType;
  uniform?: Exclude<Uniform, "revisar">;
  fullPatch?: boolean;
  price?: number;
  verifiedBy?: string;
  source?: string;
}> = overrides;
