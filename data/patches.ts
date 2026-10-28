import { storeConfig } from "@/config";

export type PatchPosition = "manga-esquerda" | "manga-direita" | "peito";

export interface PatchOption {
  id: string;
  name: string;
  /** Sigla curta mostrada no selo da lista de patches. */
  shortName?: string;
  image?: string;
  priceCents: number;
  productIds: string[];
  leagueSlugs?: string[];
  /** Clubes ou seleções (clubeSlug) que podem receber o patch, além das ligas. */
  clubSlugs?: string[];
  seasons: string[];
  positions: PatchPosition[];
  verified: boolean;
  commerciallyAvailable: boolean;
}

const patchPriceCents = storeConfig.patchPrice * 100;

// Seleções que já foram campeãs mundiais (Copa do Mundo FIFA) e existem no catálogo.
const worldChampionTeams = ["alemanha", "argentina", "brasil", "espanha", "franca", "inglaterra", "italia", "uruguai"];

export const patchOptions: PatchOption[] = [
  {
    id: "brasileirao",
    name: "Brasileirão",
    shortName: "BRA",
    priceCents: patchPriceCents,
    productIds: [],
    leagueSlugs: ["brasileirao-serie-a"],
    seasons: [],
    positions: ["manga-esquerda"],
    verified: true,
    commerciallyAvailable: true,
  },
  {
    id: "copa-do-brasil",
    name: "Copa do Brasil",
    shortName: "CDB",
    priceCents: patchPriceCents,
    productIds: [],
    leagueSlugs: ["brasileirao-serie-a"],
    seasons: [],
    positions: ["manga-esquerda"],
    verified: true,
    commerciallyAvailable: true,
  },
  {
    id: "libertadores",
    name: "Libertadores",
    shortName: "LIB",
    priceCents: patchPriceCents,
    productIds: [],
    leagueSlugs: ["brasileirao-serie-a", "copa-libertadores"],
    clubSlugs: ["boca-juniors", "river-plate", "atletico-nacional"],
    seasons: [],
    positions: ["manga-esquerda"],
    verified: true,
    commerciallyAvailable: true,
  },
  {
    id: "champions-league",
    name: "Champions League",
    shortName: "UCL",
    priceCents: patchPriceCents,
    productIds: [],
    leagueSlugs: ["premier-league", "la-liga", "serie-a", "bundesliga", "ligue-1", "liga-portugal", "eredivisie", "scottish-premiership", "uefa-champions-league"],
    seasons: [],
    positions: ["manga-esquerda"],
    verified: true,
    commerciallyAvailable: true,
  },
  {
    id: "campeao-do-mundo",
    name: "Campeão do Mundo",
    shortName: "CDM",
    priceCents: patchPriceCents,
    productIds: [],
    clubSlugs: worldChampionTeams,
    seasons: [],
    positions: ["manga-esquerda"],
    verified: true,
    commerciallyAvailable: true,
  },
];
