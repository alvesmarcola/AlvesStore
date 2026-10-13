import { CatalogPage } from "@/components/catalog-page";
import { images } from "@/data/images";
import { products } from "@/lib/catalog";

export const metadata = { title: "Camisas femininas", description: "Camisas femininas e modelos para torcer do seu jeito.", alternates: { canonical: "/feminino" } };

export default async function FemininoPage({ searchParams }: { searchParams: Promise<{ tipo?: string }> }) {
  const { tipo = "" } = await searchParams;
  const initialType = ["torcedor", "treino"].includes(tipo) ? tipo : "";
  return <CatalogPage title="Feminino" description="Camisas e peças para viver o futebol com o seu jeito e a sua torcida." products={products.filter((product) => (product.publico === "feminino" || product.publico === "unissex") && !["jogador", "retro", "cropped", "vestido"].includes(product.tipo))} breadcrumb={[{ name: "Feminino" }]} initialType={initialType} heroImage={images.categories.female} heroEyebrow="Coleção feminina · alves store" />;
}
