import test from "node:test";
import assert from "node:assert/strict";
import { toCatalogPreview, productImageAsset } from "@/lib/catalog";
import type { Product } from "@/lib/types";

test("toCatalogPreview limita o preview a apenas 1 imagem única (sem alternateImage para hover)", () => {
  const mockProduct = {
    id: "prod-123",
    slug: "camisa-flamengo-2026",
    nome: "Camisa Flamengo I 25/26",
    preco: 180,
    images: [
      { src: "/images/camisas/flamengo-1.jpg", alt: "Foto 1" },
      { src: "/images/camisas/flamengo-2.jpg", alt: "Foto 2" },
      { src: "/images/camisas/flamengo-3.jpg", alt: "Foto 3" },
    ],
  } as unknown as Product;

  const preview = toCatalogPreview(mockProduct);
  assert.equal(preview.images?.length, 1);
  assert.equal(preview.images?.[0]?.src, "/images/camisas/flamengo-1.jpg");
});

test("productImageAsset trata array vazio, nulo ou src em branco com fallback seguro", () => {
  const productNoImages = {
    nome: "Camisa Teste",
    images: [],
  };
  const assetEmpty = productImageAsset(productNoImages as any);
  assert.equal(assetEmpty.fallbackSrc, "/product-placeholder.svg");

  const productBlankSrc = {
    nome: "Camisa Teste",
    images: [{ src: "   ", alt: "Espaço em branco" }],
  };
  const assetBlank = productImageAsset(productBlankSrc as any);
  assert.equal(assetBlank.fallbackSrc, "/product-placeholder.svg");

  const productValid = {
    nome: "Camisa F1",
    images: [{ src: "/images/f1/mercedes.webp", alt: "Mercedes F1" }],
  };
  const assetValid = productImageAsset(productValid as any);
  assert.equal(assetValid.src, "/images/f1/mercedes.webp");
});
