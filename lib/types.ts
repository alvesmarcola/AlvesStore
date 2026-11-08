import type { LeagueImageSlot } from "@/data/images";
import type { PatchPosition } from "@/data/patches";

export type Audience = "masculino" | "feminino" | "unissex" | "infantil" | "revisar";
export type ProductType = "torcedor" | "jogador" | "goleiro" | "retro" | "treino" | "cropped" | "regata" | "inverno" | "vestido" | "f1" | "formula1" | "revisar";
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
  description?: string;
  stock_by_size?: Record<string, number>;
  brand?: string;
  supplier_name?: string;
  supplier_cost?: number;
  category?: string;
  gender?: string;
  league?: string;
  subcategory?: string;
  tags?: string[];
  title?: string;
  name?: string;
  model?: string;
  version?: string;
  tem_variacao_uniforme?: boolean;
  oculto?: boolean;
  yupoo_id?: string;
  ignorar_regras_preco?: boolean;
  sem_oferta_quantidade?: boolean;
  deleted_at?: string;
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
  uniformVariation?: "Casa" | "Fora";
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


export interface Avaliacao {
  id: string;
  created_at: string;
  nome: string;
  cidade: string;
  produto?: string;
  nota: number;
  comentario: string;
  status: "pending" | "approved" | "rejected";
  aprovado?: boolean;
  imagem_path?: string | null;
  imagem_url?: string | null;
}
