import { CatalogPage } from "@/components/catalog-page";
import { getSupabaseProducts } from "@/lib/server/supabase-catalog";
import { toCatalogPreview } from "@/lib/catalog";
import { parseSearchIntent, searchProducts } from "@/lib/smart-search";

export const metadata = { title: "Buscar camisas", description: "Busque camisas por clube, liga ou modelo.", alternates: { canonical: "/busca" } };

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q = "" } = await searchParams;
  const products = await getSupabaseProducts();
  const query = q.trim();
  const clubsOnly = ["clube", "clubes", "club", "clubs"].includes(query.toLocaleLowerCase("pt-BR"));
  const intent = parseSearchIntent(query);
  const search = query && !clubsOnly ? searchProducts(products, query) : { results: clubsOnly ? products.filter((product) => product.liga !== "selecoes" && product.liga !== "revisar" && product.clubeSlug !== "revisar") : products, alternatives: [] };
  const alternativesOnly = search.results.length === 0 && search.alternatives.length > 0;
  const resultProducts = alternativesOnly ? search.alternatives : search.results;
  const facetName = intent.uniform ? ({ titular: "Home", reserva: "Away", terceiro: "Third", quarto: "Fourth" } as const)[intent.uniform] : "versão solicitada";
  const notice = alternativesOnly
    ? `Não encontramos uma camisa com ${facetName} confirmado no cadastro. Estas alternativas correspondem ao clube ou temporada pesquisados; a versão ainda precisa ser conferida.`
    : undefined;
  return <CatalogPage title={query ? `Resultados para “${query}”` : "Todas as camisas"} description="Busque por clube, temporada, versão e tipo de manga." products={resultProducts.map(toCatalogPreview)} breadcrumb={[{ name: "Busca" }]} initialSearch={alternativesOnly ? "" : query} notice={notice} />;
}
