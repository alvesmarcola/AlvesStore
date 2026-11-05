import assert from "node:assert/strict";
import { test } from "node:test";
import { searchProducts } from "@/lib/smart-search";
import { isFormulaOneEvidence, isFormulaOneProduct, allowsCustomization } from "@/lib/formula-one";
import { isNbaTankTop } from "@/lib/product-classification";
import type { Product } from "@/lib/types";

const mockNbaProduct: Product = {
  id: "232244398",
  slug: "regata-nba-thunder-city-edition-8-jalen-williams",
  clube: "Thunder",
  clubeSlug: "thunder",
  liga: "nba",
  publico: "masculino",
  tipo: "regata",
  temporada: "25/26",
  uniforme: "revisar",
  nome: "Regata NBA Thunder City Edition #8 Jalen Williams",
  preco: 230,
  tamanhos: ["P", "M", "G", "GG"],
  cor: "revisar",
  imageSeed: "regata-nba-thunder-city-edition-8-jalen-williams",
  images: [
    {
      src: "https://rlbdgyajikbdhivwfyzk.supabase.co/storage/v1/object/public/produtos/nba/232244398/0.webp",
      source: "https://xingkong-sports.x.yupoo.com/albums/232244398",
      alt: "Regata NBA Thunder City Edition #8 Jalen Williams",
      credit: "Yupoo",
      focalPoint: { x: 50, y: 50 },
      blurDataURL: "",
    },
  ],
};

const mockNbaLakers: Product = {
  id: "230511700",
  slug: "regata-nba-lakers-icon-edition-23-lebron-james",
  clube: "Lakers",
  clubeSlug: "lakers",
  liga: "nba",
  publico: "masculino",
  tipo: "regata",
  temporada: "24/25",
  uniforme: "titular",
  nome: "Regata NBA Lakers Icon Edition #23 LeBron James",
  preco: 230,
  tamanhos: ["P", "M", "G", "GG"],
  cor: "amarelo",
  imageSeed: "regata-nba-lakers-icon-edition-23-lebron-james",
  images: [
    {
      src: "https://rlbdgyajikbdhivwfyzk.supabase.co/storage/v1/object/public/produtos/nba/230511700/0.webp",
      source: "https://xingkong-sports.x.yupoo.com/albums/230511700",
      alt: "Regata NBA Lakers Icon Edition #23 LeBron James",
      credit: "Yupoo",
      focalPoint: { x: 50, y: 50 },
      blurDataURL: "",
    },
  ],
};

test("Regatas NBA são identificadas corretamente como NBA e não são classificadas como F1", () => {
  assert.equal(isNbaTankTop(mockNbaProduct), true, "Jalen Williams deve ser identificado como regata NBA");
  assert.equal(isNbaTankTop(mockNbaLakers), true, "LeBron James deve ser identificado como regata NBA");

  // Jalen Williams tem o sobrenome Williams, mas é NBA e NÃO F1
  assert.equal(isFormulaOneEvidence("regata nba thunder jalen williams"), false, "Regata NBA com Williams não deve ser evidência de F1");
  assert.equal(isFormulaOneProduct(mockNbaProduct), false, "Produto Jalen Williams não deve ser F1");
  assert.equal(allowsCustomization(mockNbaProduct), false, "Regatas NBA não aceitam personalização de nome e número");
});

test("Busca inteligente encontra regatas NBA tanto por 'nba' quanto por 'regata'", () => {
  const catalog = [mockNbaProduct, mockNbaLakers];

  const searchNba = searchProducts(catalog, "nba");
  assert.equal(searchNba.results.length, 2, "Busca por 'nba' deve retornar os dois produtos");

  const searchRegata = searchProducts(catalog, "regata");
  assert.equal(searchRegata.results.length, 2, "Busca por 'regata' deve retornar os dois produtos");

  const searchThunder = searchProducts(catalog, "thunder");
  assert.equal(searchThunder.results.length, 1, "Busca por 'thunder' deve retornar Thunder");
  assert.equal(searchThunder.results[0].slug, "regata-nba-thunder-city-edition-8-jalen-williams");
});

test("Menu e categorias de Masculino possuem apenas 'Regatas NBA', e rota antiga possui redirect", async () => {
  const categories = (await import("@/data/categories.json", { with: { type: "json" } })).default;
  const masculino = categories.find((c) => c.slug === "masculino");
  assert.ok(masculino, "Categoria masculino deve existir");
  assert.ok(!masculino.subcategories.includes("Regatas"), "Não deve conter 'Regatas'");
  assert.ok(masculino.subcategories.includes("Regatas NBA"), "Deve conter 'Regatas NBA'");

  const nextConfigModule = await import("@/next.config");
  const nextConfig = nextConfigModule.default;
  if (nextConfig.redirects) {
    const redirects = await nextConfig.redirects();
    const regatasRedirect = redirects.find((r: { source: string }) => r.source === "/regatas");
    const regataRedirect = redirects.find((r: { source: string }) => r.source === "/regata");
    assert.ok(regatasRedirect, "Deve haver redirect para /regatas");
    assert.equal(regatasRedirect.destination, "/masculino?tipo=regata-nba");
    assert.ok(regataRedirect, "Deve haver redirect para /regata");
    assert.equal(regataRedirect.destination, "/masculino?tipo=regata-nba");
  }
});
