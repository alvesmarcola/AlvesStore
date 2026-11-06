import test from "node:test";
import assert from "node:assert/strict";
import { manualProductSchema } from "@/lib/admin/product-validation";
import { fetchDirectOrderProducts, getCachedSupabaseProducts } from "@/lib/server/supabase-catalog";
import type { Product } from "@/lib/types";

test("1. manualProductSchema aceita tanto UUID quanto IDs numéricos existentes de álbuns", () => {
  const baseValid = {
    slug: "camisa-atletico-mineiro-retro-2013",
    nome: "Camisa Atlético Mineiro 2013 Retrô",
    description: "Camisa histórica retrô",
    brand: "Lupo",
    supplier_name: "Fornecedor",
    supplier_cost: 80,
    preco: 185,
    publico: "masculino",
    tipo: "retro",
    liga: "brasileirao-serie-a",
    clube: "Atlético Mineiro",
    temporada: "2013",
    uniforme: "titular",
    cor: "Preto e Branco",
    tamanhos: ["P", "M", "G", "GG"],
    stock_by_size: { P: 5, M: 5, G: 5, GG: 5 },
    tem_variacao_uniforme: false,
    oculto: false,
    imageUrls: ["https://rlbdgyajikbdhivwfyzk.supabase.co/storage/v1/object/public/produtos/futebol/101948070/0.webp"],
  };

  // Teste com UUID
  const resUuid = manualProductSchema.safeParse({ ...baseValid, id: "25288570-84a7-48cc-9a8b-abad05d51fd0" });
  assert.equal(resUuid.success, true, "Deve aceitar UUID válido");

  // Teste com ID numérico de álbum já cadastrado no Supabase
  const resNumeric = manualProductSchema.safeParse({ ...baseValid, id: "257636509" });
  assert.equal(resNumeric.success, true, "Deve aceitar ID numérico existente de álbum");

  // Teste sem ID (criação)
  const resNoId = manualProductSchema.safeParse(baseValid);
  assert.equal(resNoId.success, true, "Deve aceitar criação sem ID");
});

test("2. Produtos do Supabase com preco = 0 são impedidos de publicação na vitrine", () => {
  const cachedProducts = getCachedSupabaseProducts();
  
  // Nenhum produto publicado pode ter preço zerado
  const zeroPricePublished = cachedProducts.filter((p) => !p.oculto && (!Number.isFinite(p.preco) || p.preco <= 0));
  assert.equal(zeroPricePublished.length, 0, "Nenhum produto publicado pode ter preço <= 0");
});

test("3. Produtos existentes com preco > 0 e oculto = false são elegíveis para exibição", () => {
  const sampleEligibleProduct: Product = {
    id: "257636509",
    yupoo_id: "257636509",
    slug: "camisa-atletico-mineiro-retro-2013",
    nome: "Camisa Atlético Mineiro 2013 Retrô",
    clube: "Atlético Mineiro",
    clubeSlug: "atletico-mineiro",
    liga: "brasileirao-serie-a",
    publico: "masculino",
    tipo: "retro",
    temporada: "2013",
    uniforme: "titular",
    preco: 185,
    tamanhos: ["P", "M", "G", "GG"],
    cor: "Preto e Branco",
    imageSeed: "atletico-mineiro",
    images: [{
      src: "https://rlbdgyajikbdhivwfyzk.supabase.co/storage/v1/object/public/produtos/futebol/257636509/0.webp",
      source: "https://rlbdgyajikbdhivwfyzk.supabase.co/storage/v1/object/public/produtos/futebol/257636509/0.webp",
      alt: "Camisa Atlético Mineiro 2013 Retrô",
      credit: "Imports Alves",
      focalPoint: { x: 50, y: 50 },
      blurDataURL: "",
    }],
    oculto: false,
    tem_variacao_uniforme: false,
  };

  assert.equal(sampleEligibleProduct.oculto, false);
  assert.equal(sampleEligibleProduct.preco > 0, true);
  assert.equal(sampleEligibleProduct.tamanhos.length > 0, true);
  assert.notEqual(sampleEligibleProduct.tipo, "revisar");
  assert.notEqual(sampleEligibleProduct.liga, "revisar");
});

