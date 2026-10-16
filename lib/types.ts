import type { LeagueImageSlot } from "@/data/images";
import type { PatchPosition } from "@/data/patches";

export type Audience = "masculino" | "feminino" | "unissex" | "infantil" | "revisar";
export type ProductType = "torcedor" | "jogador" | "goleiro" | "retro" | "treino" | "cropped" | "regata" | "inverno" | "vestido" | "formula1" | "revisar";
export type Uniform = "titular" | "reserva" | "terceiro" | "quarto" | "revisar";
export type ShirtVersion = "fan" | "player" | "retro" | "goalkeeper" | "unknown";
export type SleeveType = "short" | "long" | "unknown";

export interface ProductImage {
  src: string;
  fallbackSrc?: string;
  source: string;
  alt: string;
  credit: string;
  focalPoint: { x: number; y: number };
  blurDataURL: string;
}

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
  tamanhos: string[];
  cor: string;
  imageSeed: string;
  images?: ProductImage[];
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
  patches?: { id: string; position: PatchPosition }[];
}

export interface SelectedPatch {
  id: string;
  name: string;
  image: string;
  position: PatchPosition;
  priceCents: number;
}
