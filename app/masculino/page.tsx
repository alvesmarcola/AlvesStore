import { CatalogPage } from "@/components/catalog-page";
import { products } from "@/lib/catalog";

export const metadata = { title: "Camisas masculinas", description: "Encontre camisas masculinas de futebol, versões torcedor, jogador e retrô." };

export default async function MasculinoPage({ searchParams }: { searchParams: Promise<{ tipo?: string }> }) {
  const { tipo = "" } = await searchParams;
  const initialType = ["torcedor", "jogador", "retro", "treino", "inverno", "regata"].includes(tipo) ? tipo : "";
  return <CatalogPage title="Camisas masculinas" description="Vista as cores do seu time com modelos torcedor, jogador, retrô, treino e muito mais." products={products.filter((product) => product.publico === "masculino" || product.publico === "unissex")} breadcrumb={[{ name: "Masculino" }]} initialType={initialType} />;
}
