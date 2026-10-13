import type { ProductType } from "@/lib/types";

function normalizeSource(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR").replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
}

export function inferProductTypeFromSource(category: string, filename: string): ProductType {
  const normalizedCategory = normalizeSource(category);
  const text = normalizeSource(`${category} ${filename}`);
  if (/\b(goleiro|goleira|keeper|goalkeeper|gk)\b/.test(text)) return "goleiro";
  if (/\b(treino|training|pre jogo|pre match)\b/.test(text)) return "treino";
  if (/\b(retro|vintage)\b/.test(text)) return "retro";
  if (/\bcropped\b/.test(text)) return "cropped";
  if (/\bregata\b/.test(text)) return "regata";
  if (/\bvestido\b/.test(text)) return "vestido";
  if (normalizedCategory.includes("camisa jogador") || /\b(player version|versao jogador|jogador)\b/.test(text)) return "jogador";
  if (normalizedCategory.includes("torcedor") || /\b(torcedor|supporter|fan version)\b/.test(text) || /\bultra\s*pass(?:\s*o|\s*os)?\b/.test(text)) return "torcedor";
  if (/\b(manga longa|long sleeve|ls)\b/.test(text)) return "inverno";
  return "revisar";
}
