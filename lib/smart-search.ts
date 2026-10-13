import type { Product, ShirtVersion, SleeveType, Uniform } from "@/lib/types";
import { classifyProduct } from "@/lib/product-classification";
import { getLeague } from "@/lib/catalog";

export interface SearchIntent {
  uniform?: Exclude<Uniform, "revisar">;
  version?: Exclude<ShirtVersion, "unknown">;
  sleeve?: Exclude<SleeveType, "unknown">;
  season?: string;
  terms: string[];
}

function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR").replace(/[^a-z0-9/]+/g, " ").trim();
}

const uniformAliases: Record<string, Exclude<Uniform, "revisar">> = {
  home: "titular", titular: "titular", casa: "titular",
  away: "reserva", reserva: "reserva", visitante: "reserva", resrva: "reserva",
  third: "terceiro", 3rd: "terceiro", terceira: "terceiro", terceiro: "terceiro", "terceira camisa": "terceiro",
  fourth: "quarto", 4th: "quarto", quarta: "quarto", quarto: "quarto",
};

const versionAliases: Record<string, Exclude<ShirtVersion, "unknown">> = {
  torcedor: "fan", fan: "fan", "fan version": "fan", jogador: "player", player: "player", "player version": "player",
  retro: "retro", vintage: "retro", goleiro: "goalkeeper", goalkeeper: "goalkeeper", keeper: "goalkeeper", gk: "goalkeeper",
};

export function parseSearchIntent(query: string): SearchIntent {
  const normalized = normalize(query);
  const tokens = normalized.split(/\s+/).filter(Boolean);
  const intent: SearchIntent = { terms: [...tokens] };
  for (const [alias, value] of Object.entries(uniformAliases).sort((a, b) => b[0].length - a[0].length)) {
    if (normalized.includes(alias)) { intent.uniform = value; break; }
  }
  for (const [alias, value] of Object.entries(versionAliases).sort((a, b) => b[0].length - a[0].length)) {
    if (normalized.includes(alias)) { intent.version = value; break; }
  }
  if (/manga longa|long sleeve|\bls\b/.test(normalized)) intent.sleeve = "long";
  else if (/manga curta|short sleeve|\bss\b/.test(normalized)) intent.sleeve = "short";
  const season = normalized.match(/\b(?:19|20)?\d{2}\s*\/\s*(?:\d{2}|\d{4})\b/);
  if (season) intent.season = season[0].replace(/\s/g, "");
  const remove = new Set("camisa camisas shirt shirts jersey jerseys de do da dos das com e modelo versao versão masculina masculino feminina feminino".split(" "));
  intent.terms = tokens.filter((token) => !remove.has(token) && !Object.hasOwn(uniformAliases, token) && !Object.hasOwn(versionAliases, token) && !["manga", "longa", "curta", "sleeve"].includes(token));
  return intent;
}

function productText(product: Product) {
  const league = getLeague(product.liga);
  return normalize([product.nome, product.clube, product.clubeSlug.replaceAll("-", " "), product.temporada, product.tipo, product.uniforme, product.imageSeed, league?.nome ?? "", league?.competicao ?? ""].join(" "));
}

function basicScore(product: Product, intent: SearchIntent) {
  const text = productText(product);
  const required = [...intent.terms, ...(intent.season ? [intent.season] : [])];
  const matched = required.filter((term) => text.includes(term));
  return { score: matched.length, complete: matched.length === required.length, required: required.length };
}

function facetsMatch(product: Product, intent: SearchIntent) {
  const facts = classifyProduct(product);
  return (!intent.uniform || facts.uniform === intent.uniform)
    && (!intent.version || facts.version === intent.version)
    && (!intent.sleeve || facts.sleeve === intent.sleeve);
}

export function searchProducts(products: Product[], query: string) {
  const intent = parseSearchIntent(query);
  const scored = products.map((product) => ({ product, ...basicScore(product, intent) }))
    .filter((item) => item.required === 0 || item.complete)
    .sort((a, b) => b.score - a.score);
  const results = scored.filter(({ product }) => facetsMatch(product, intent)).map(({ product }) => product);
  const alternatives = results.length ? [] : scored.slice(0, 12).map(({ product }) => product);
  return { intent, results, alternatives };
}
