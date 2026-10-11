import type { LeagueImageSlot } from "@/data/images";

export type Audience = "masculino" | "feminino" | "unissex";
export type ProductType = "torcedor" | "jogador" | "retro" | "treino" | "cropped" | "regata" | "inverno" | "vestido";
export type Uniform = "titular" | "reserva" | "terceiro";

export interface Product {
  id: string;
  slug: string;
  clube: string;
  clubeSlug: string;
  liga: string;
  publico: Audience;
  tipo: ProductType;
  temporada: string;
  uniforme: Uniform;
  nome: string;
  preco: number;
  precoAnterior: number;
  estoque: number;
  tamanhos: string[];
  esgotados: string[];
  cor: string;
  tag: string;
  imageSeed: string;
}

export interface League {
  slug: string;
  nome: string;
  pais: string;
  competicao: string;
  corDestaque: string;
  imagemCapa: LeagueImageSlot;
  clubesVerificados?: boolean;
  notaClubes?: string;
  fontes?: string[];
  clubes: { slug: string; nome: string; continente?: string }[];
}

export interface CartItem {
  lineId: string;
  product: Product;
  size: string;
  quantity: number;
  customization?: { name: string; number: string };
}
