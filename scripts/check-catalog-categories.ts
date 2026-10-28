import bundledProducts from "../data/products.json";
import { storeConfig } from "../config";
import { classifyProduct, isPackageEligible } from "../lib/product-classification";
import type { Product } from "../lib/types";

const products = bundledProducts as unknown as Product[];

const published = products.filter((product) =>
  Array.isArray(product.images) && product.images.length > 0 &&
  product.publico !== "revisar" && product.tipo !== "revisar",
);
const productEvidence = (product: typeof products[number]) => [
  product.publico,
  product.tipo,
  product.gender,
  product.category,
  product.subcategory,
  product.title,
  product.name,
  product.version,
  product.model,
  ...(product.tags ?? []),
  product.nome,
  product.slug,
  product.imageSeed,
].join(" ").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");
const feminineEvidence = (product: typeof products[number]) => `${productEvidence(product)} ${(product.images ?? []).flatMap((image) => [image.src, image.source, image.alt]).join(" ")}`;
const femininePublished = published.filter((product) => product.publico === "feminino" || product.publico === "unissex" ||
  /feminin|baby[\s-]*look|women|woman|ladies/.test(feminineEvidence(product)));
const playerProducts = published.filter((product) => classifyProduct(product as Product).version === "player");
const unpricedPlayers = playerProducts.filter((product) => {
  const item = product as Product;
  const classification = classifyProduct(item);
  const expectedPrice = classification.sleeve === "long" ? storeConfig.playerLongSleevePrice : storeConfig.playerShortSleevePrice;
  return classification.reviewRequired || classification.price !== expectedPrice || isPackageEligible(item);
});
if (unpricedPlayers.length) throw new Error(`${unpricedPlayers.length} modelos Jogador não estão ativos pelo preço oficial ou receberam pacote indevido: ${unpricedPlayers.map((product) => product.slug).join(", ")}.`);
const categories: Record<string, number> = {
  vitrine: published.length,
  masculino: published.filter((product) => product.publico === "masculino" || product.publico === "unissex").length,
  feminino: femininePublished.length,
  infantil: published.filter((product) => product.publico === "infantil" ||
    /\b(?:kids|junior|youth|infantil|children)\b/i.test(`${product.nome} ${product.imageSeed}`)).length,
  selecoes: published.filter((product) => product.liga === "selecoes").length,
  clubes: published.filter((product) => product.liga !== "selecoes" && product.liga !== "revisar" && product.clubeSlug !== "revisar").length,
  busca: published.length,
};

const empty = Object.entries(categories).filter(([, count]) => count === 0).map(([name]) => name);
console.log(`Itens ativos: feminino=${femininePublished.length}; modelo-jogador=${playerProducts.length}`);
if (empty.length) throw new Error(`Categorias sem produtos publicados no catálogo incluído no build: ${empty.join(", ")}`);
console.log(`Catálogo verificado: ${Object.entries(categories).map(([name, count]) => `${name}=${count}`).join("; ")}`);
