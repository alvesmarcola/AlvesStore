import products from "../data/products.json";

const published = products.filter((product) =>
  Array.isArray(product.images) && product.images.length > 0 &&
  product.publico !== "revisar" && product.tipo !== "revisar",
);
const categories: Record<string, number> = {
  vitrine: published.length,
  masculino: published.filter((product) => product.publico === "masculino" || product.publico === "unissex").length,
  feminino: published.filter((product) =>
    (product.publico === "feminino" || product.publico === "unissex") &&
    !["jogador", "retro", "cropped", "vestido"].includes(product.tipo),
  ).length,
  infantil: published.filter((product) => product.publico === "infantil" ||
    /\b(?:kids|junior|youth|infantil|children)\b/i.test(`${product.nome} ${product.imageSeed}`)).length,
  selecoes: published.filter((product) => product.liga === "selecoes").length,
  clubes: published.filter((product) => product.liga !== "selecoes" && product.liga !== "revisar" && product.clubeSlug !== "revisar").length,
  busca: published.length,
};

const empty = Object.entries(categories).filter(([, count]) => count === 0).map(([name]) => name);
if (empty.length) throw new Error(`Categorias sem produtos publicados no catálogo incluído no build: ${empty.join(", ")}`);
console.log(`Catálogo verificado: ${Object.entries(categories).map(([name, count]) => `${name}=${count}`).join("; ")}`);
