export type PatchPosition = "manga-esquerda" | "manga-direita" | "peito";

export interface PatchOption {
  id: string;
  name: string;
  image?: string;
  priceCents: number;
  productIds: string[];
  leagueSlugs?: string[];
  seasons: string[];
  positions: PatchPosition[];
  verified: boolean;
  commerciallyAvailable: boolean;
}

export const patchOptions: PatchOption[] = [
  {
    id: "champions-league",
    name: "Champions League",
    priceCents: 1800,
    productIds: [],
    leagueSlugs: ["premier-league", "la-liga", "serie-a", "bundesliga", "ligue-1", "liga-portugal", "eredivisie", "scottish-premiership", "uefa-champions-league"],
    seasons: [],
    positions: ["manga-esquerda"],
    verified: true,
    commerciallyAvailable: true,
  },
  {
    id: "libertadores",
    name: "Libertadores",
    priceCents: 1800,
    productIds: [],
    leagueSlugs: ["brasileirao-serie-a", "copa-libertadores"],
    seasons: [],
    positions: ["manga-esquerda"],
    verified: true,
    commerciallyAvailable: true,
  },
  {
    id: "brasileirao",
    name: "Brasileirão",
    priceCents: 1800,
    productIds: [],
    leagueSlugs: ["brasileirao-serie-a"],
    seasons: [],
    positions: ["manga-esquerda"],
    verified: true,
    commerciallyAvailable: true,
  },
];
