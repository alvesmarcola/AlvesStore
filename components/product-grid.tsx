import { ProductCard } from "@/components/product-card";
import type { Product } from "@/lib/types";

export function ProductGrid({ items }: { items: Product[] }) {
  if (!items.length) return <div className="rounded-xl bg-paper px-6 py-16 text-center"><h2 className="text-xl font-black">Não encontramos camisas por aqui</h2><p className="mt-2 text-sm text-muted">Tente mudar seus filtros ou explorar outra categoria.</p></div>;
  return <div className="grid grid-cols-2 gap-x-3 gap-y-8 sm:grid-cols-3 sm:gap-x-5 lg:grid-cols-4 lg:gap-y-10">{items.map((product) => <ProductCard key={product.id} product={product} />)}</div>;
}
