import { CatalogPage } from "@/components/catalog-page";
import { products } from "@/lib/catalog";

export const metadata = { title: "Camisas femininas", description: "Camisas femininas, cropped, retrô e modelos para torcer do seu jeito." };

export default async function FemininoPage({ searchParams }: { searchParams: Promise<{ tipo?: string }> }) {
  const { tipo = "" } = await searchParams;
  const initialType = ["torcedor", "jogador", "retro", "cropped", "vestido", "treino"].includes(tipo) ? tipo : "";
  return <CatalogPage title="Camisas femininas" description="Da baby look ao cropped: encontre o seu jeito de viver a torcida." products={products.filter((product) => product.publico === "feminino" || product.publico === "unissex")} breadcrumb={[{ name: "Feminino" }]} initialType={initialType} />;
}
