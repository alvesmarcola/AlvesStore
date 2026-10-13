import type { Product, ShirtVersion, SleeveType, Uniform } from "@/lib/types";
import { classifyProduct } from "@/lib/product-classification";
import { getLeague } from "@/lib/catalog";

export interface SearchIntent {
  uniform?: Exclude<Uniform, "revisar">;
  version?: Exclude<ShirtVersion, "unknown">;
  sleeve?: Exclude<SleeveType, "unknown">;
  fullPatch?: boolean;
  season?: string;
  terms: string[];
}

function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR").replace(/[^a-z0-9/]+/g, " ").trim();
}

const uniformAliases: Record<string, Exclude<Uniform, "revisar">> = {
  home: "titular", titular: "titular", casa: "titular",
  away: "reserva", reserva: "reserva", visitante: "reserva", resrva: "reserva",
  third: "terceiro", "3rd": "terceiro", terceira: "terceiro", terceiro: "terceiro", "terceira camisa": "terceiro",
  fourth: "quarto", "4th": "quarto", quarta: "quarto", quarto: "quarto",
};

const versionAliases: Record<string, Exclude<ShirtVersion, "unknown">> = {
  torcedor: "fan", fan: "fan", "fan version": "fan", jogador: "player", player: "player", "player version": "player",
  retro: "retro", vintage: "retro", goleiro: "goalkeeper", goalkeeper: "goalkeeper", keeper: "goalkeeper", gk: "goalkeeper",
};

const clubAliases: Record<string, string> = {
  fla: "flamengo", mengao: "flamengo", flamngo: "flamengo",
  barca: "barcelona",
  rmadrid: "madrid", realmadrid: "real madrid", madrdi: "madrid",
  gremio: "gremio", gremoi: "gremio", corinthans: "corinthians",
  palmeira: "palmeiras", palmeiraas: "palmeiras", brasill: "brasil",
};

function hasAlias(text: string, alias: string) {
  return ` ${text} `.includes(` ${alias} `);
}

export function parseSearchIntent(query: string): SearchIntent {
  const normalized = normalize(query);
  const tokens = normalized.split(/\s+/).filter(Boolean).flatMap((token) => (clubAliases[token] ?? token).split(" "));
  const intent: SearchIntent = { terms: [...tokens] };
  for (const [alias, value] of Object.entries(uniformAliases).sort((a, b) => b[0].length - a[0].length)) {
    if (hasAlias(normalized, alias)) { intent.uniform = value; break; }
  }
  for (const [alias, value] of Object.entries(versionAliases).sort((a, b) => b[0].length - a[0].length)) {
    if (hasAlias(normalized, alias)) { intent.version = value; break; }
  }
  if (/manga longa|long sleeve|\bls\b/.test(normalized)) intent.sleeve = "long";
  else if (/manga curta|short sleeve|\bss\b/.test(normalized)) intent.sleeve = "short";
  if (/\b(full ?patch(?:es)?|patch completo|patches completos|full sponsor|all sponsors)\b/.test(normalized)) intent.fullPatch = true;
  const season = normalized.match(/\b(?:19|20)?\d{2}\s*[/-]\s*(?:\d{2}|\d{4})\b/);
  if (season) {
    const [start, end] = season[0].split(/[/-]/).map((part) => part.trim());
    intent.season = `${start.slice(-2)}/${end.slice(-2)}`;
  }
  const remove = new Set("camisa camisas shirt shirts jersey jerseys kit uniform uniforme de do da dos das com e modelo versao versão version masculine masculino feminina feminine feminino manga longa curta sleeve short ss ls".split(" "));
  intent.terms = tokens.filter((token) => !remove.has(token) && !["full", "patch", "patches", "completo", "completos"].includes(token) && !Object.hasOwn(uniformAliases, token) && !Object.hasOwn(versionAliases, token));
  return intent;
}

function productText(product: Product) {
  const league = getLeague(product.liga);
  return normalize([product.nome, product.clube, product.clubeSlug.replaceAll("-", " "), product.temporada, product.tipo, product.uniforme, product.imageSeed, ...(product.images ?? []).map((image) => image.source), league?.nome ?? "", league?.competicao ?? ""].join(" "));
}

function basicScore(product: Product, intent: SearchIntent) {
  const text = productText(product);
  const required = [...intent.terms, ...(intent.season ? [intent.season] : [])];
  const words = text.split(" ");
  const oneEditAway = (left: string, right: string) => {
    if (Math.abs(left.length - right.length) > 1) return false;
    let i = 0, j = 0, edits = 0;
    while (i < left.length && j < right.length) {
      if (left[i] === right[j]) { i += 1; j += 1; continue; }
      edits += 1;
      if (edits > 1) return false;
      if (left.length > right.length) i += 1;
      else if (right.length > left.length) j += 1;
      else { i += 1; j += 1; }
    }
    return edits + (i < left.length || j < right.length ? 1 : 0) <= 1;
  };
  const matched = required.filter((term) => text.includes(term) || (term.length >= 6 && words.some((word) => oneEditAway(term, word))));
  return { score: matched.length, complete: matched.length === required.length, required: required.length };
}

function facetsMatch(product: Product, intent: SearchIntent) {
  const facts = classifyProduct(product);
  return (!intent.uniform || facts.uniform === intent.uniform)
    && (!intent.version || facts.version === intent.version)
    && (!intent.sleeve || facts.sleeve === intent.sleeve)
    && (!intent.fullPatch || facts.fullPatch);
}

export function searchProducts(products: Product[], query: string) {
  const intent = parseSearchIntent(query);
  const scored = products.map((product) => ({ product, ...basicScore(product, intent) }))
    .filter((item) => item.required === 0 || item.complete)
    .sort((a, b) => b.score - a.score);
  const results = scored.filter(({ product }) => facetsMatch(product, intent)).map(({ product }) => product);
  const alternatives = results.length || (!intent.terms.length && !intent.season) ? [] : scored.slice(0, 12).map(({ product }) => product);
  return { intent, results, alternatives };
}
