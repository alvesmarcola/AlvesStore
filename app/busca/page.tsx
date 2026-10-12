import { CatalogPage } from "@/components/catalog-page";
import { getLeague, products } from "@/lib/catalog";

export const metadata = { title: "Buscar camisas", description: "Busque camisas por clube, liga ou modelo." };

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q = "" } = await searchParams;
  const term = q.toLocaleLowerCase("pt-BR").trim();
  const isOfferQuery = term.includes("oferta");
  const isClubQuery = term === "clube" || term === "clubes";
  const results = term ? products.filter((product) => {
    if (isOfferQuery) return true;
    if (isClubQuery) return product.liga !== "selecoes" && product.liga !== "revisar" && product.clubeSlug !== "revisar";
    const league = getLeague(product.liga);
    const fields = [
      product.nome,
      product.clube !== "revisar" ? product.clube : "",
      league?.nome ?? "",
      league?.competicao ?? "",
      league?.pais ?? "",
      product.tipo !== "revisar" ? product.tipo : "",
      product.temporada !== "revisar" ? product.temporada : "",
      product.uniforme !== "revisar" ? product.uniforme : "",
    ];
    return fields.join(" ").toLocaleLowerCase("pt-BR").includes(term);
  }) : products;
  return <CatalogPage title={term ? `Resultados para “${q}”` : "Todas as camisas"} description="Use os filtros para encontrar sua próxima camisa de futebol." products={results} breadcrumb={[{ name: "Busca" }]} />;
}
