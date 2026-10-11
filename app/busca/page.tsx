import { CatalogPage } from "@/components/catalog-page";
import { products } from "@/lib/catalog";

export const metadata = { title: "Buscar camisas", description: "Busque camisas por clube, liga ou modelo." };

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q = "" } = await searchParams;
  const term = q.toLocaleLowerCase("pt-BR").trim();
  const results = term ? products.filter((product) => {
    const searchText = `${product.nome} ${product.clube} ${product.liga} ${product.tipo} ${product.tag}`.toLocaleLowerCase("pt-BR");
    return searchText.includes(term) || (term.includes("vendid") && product.tag.toLocaleLowerCase("pt-BR").includes("mais vendido"));
  }) : products;
  return <CatalogPage title={term ? `Resultados para “${q}”` : "Todas as camisas"} description="Use os filtros para encontrar sua próxima camisa de futebol." products={results} breadcrumb={[{ name: "Busca" }]} />;
}
