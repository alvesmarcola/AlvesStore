export type PatchPosition = "manga-esquerda" | "manga-direita" | "peito";

export interface PatchOption {
  id: string;
  name: string;
  image: string;
  priceCents: number;
  productIds: string[];
  seasons: string[];
  positions: PatchPosition[];
  sourceUrl: string;
  verified: boolean;
  commerciallyAvailable: boolean;
}

/**
 * Inclua opções somente após confirmar fonte, compatibilidade por modelo/temporada,
 * imagem licenciada para uso e disponibilidade comercial. Nenhum patch está confirmado ainda.
 */
export const patchOptions: PatchOption[] = [];
