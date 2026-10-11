import { CatalogPage } from "@/components/catalog-page";
import { images } from "@/data/images";
import { products } from "@/lib/catalog";

export const metadata = { title: "Camisas femininas", description: "Camisas femininas, cropped, retrô e modelos para torcer do seu jeito." };

export default async function FemininoPage({ searchParams }: { searchParams: Promise<{ tipo?: string }> }) {
  const { tipo = "" } = await searchParams;
  const initialType = ["torcedor", "jogador", "retro", "cropped", "vestido", "treino"].includes(tipo) ? tipo : "";
  return <CatalogPage title="Feminino" description="Camisas, croppeds e peças para viver o futebol com o seu jeito e a sua torcida." products={products.filter((product) => product.publico === "feminino" || product.publico === "unissex")} breadcrumb={[{ name: "Feminino" }]} initialType={initialType} heroImage={images.categories.female} heroEyebrow="Coleção feminina · alves store" />;
}
