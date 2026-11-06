import { z } from "zod";

const productSize = z.string().trim().min(1).max(12).refine((size) => size !== "3GG", {
  message: "O tamanho 3GG ainda não está disponível na vitrine.",
});

export const manualProductSchema = z.object({
  id: z.string().trim().min(1).max(100).optional(),
  slug: z.string().trim().min(2).max(100).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  nome: z.string().trim().min(3).max(160),
  description: z.string().trim().max(4000),
  brand: z.string().trim().max(100).default(""),
  supplier_name: z.string().trim().max(160).default(""),
  supplier_cost: z.number().finite().min(0).max(100000).default(0),
  preco: z.number().finite().min(0).max(100000),
  publico: z.enum(["masculino", "feminino", "unissex", "infantil"]),
  tipo: z.enum(["torcedor", "jogador", "goleiro", "retro", "treino", "cropped", "regata", "inverno", "vestido", "f1"]),
  liga: z.string().trim().min(2).max(80).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  clube: z.string().trim().min(2).max(100),
  temporada: z.string().trim().min(1).max(32),
  uniforme: z.enum(["titular", "reserva", "terceiro", "quarto"]),
  cor: z.string().trim().min(1).max(60),
  tamanhos: z.array(productSize).min(1).max(20).refine((sizes) => new Set(sizes).size === sizes.length, {
    message: "Remova tamanhos repetidos.",
  }),
  stock_by_size: z.record(z.string(), z.number().int().min(0).max(10000)),
  tem_variacao_uniforme: z.boolean().default(false),
  oculto: z.boolean().default(false),
  imageUrls: z.array(z.string().url()).max(6),
}).strict().superRefine((product, context) => {
  for (const size of Object.keys(product.stock_by_size)) {
    if (!product.tamanhos.includes(size)) {
      context.addIssue({
        code: "custom",
        message: `O estoque do tamanho ${size} não corresponde aos tamanhos cadastrados.`,
        path: ["stock_by_size", size],
      });
    }
  }
});

export type ManualProductInput = z.infer<typeof manualProductSchema>;
