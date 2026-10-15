"use client";

import Image from "next/image";
import Link from "next/link";
import { Minus, Plus, Trash2 } from "lucide-react";
import { storeConfig } from "@/config";
import { formatCurrency, productImageAsset } from "@/lib/catalog";
import { getCartPricing } from "@/lib/commerce";
import { classifyProduct, getProductUnitPrice } from "@/lib/product-classification";
import { patchOptions } from "@/data/patches";
import { useCart } from "@/store/cart";

export default function CartPage() {
  const { items, updateQuantity, removeItem } = useCart();
  const { subtotal, bundleDiscount, shipping, grandTotal, needsReview } = getCartPricing(items);
  return <main className="mx-auto max-w-7xl px-4 py-9 lg:px-8"><h1 className="text-3xl font-black">Sua sacola</h1><p className="mt-2 text-sm text-muted">Confira seus itens antes de seguir para o checkout.</p>
    {!items.length ? <div className="mt-8 rounded-xl bg-paper px-5 py-16 text-center"><h2 className="text-xl font-black">Sua sacola está vazia</h2><p className="mt-2 text-sm text-muted">Tem muita camisa esperando para entrar em campo.</p><Link href="/masculino" className="mt-5 inline-block rounded bg-action px-6 py-3 text-xs font-black uppercase">Explorar camisas</Link></div> :
      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_360px]">
        <section className="rounded-xl border p-4 sm:p-6">{items.map((item) => { const classification = classifyProduct(item.product); return <article key={item.lineId} className="flex gap-4 border-b py-5 first:pt-0 last:border-b-0 last:pb-0"><div className="relative h-28 w-24 shrink-0 overflow-hidden rounded bg-paper"><Image src={productImageAsset(item.product).src} alt={item.product.nome} fill sizes="96px" className="object-cover" /></div><div className="min-w-0 flex-1"><Link href={`/produto/${item.product.slug}`} className="line-clamp-2 text-sm font-bold">{item.product.nome}</Link><p className="mt-1 text-xs text-muted">Tamanho {item.size}{item.customization ? ` · ${item.customization.name} ${item.customization.number}` : ""}</p><p className="mt-2 font-black">{classification.reviewRequired ? classification.priceLabel : formatCurrency(getProductUnitPrice(item.product, item.size)!)} / camisa{item.customization ? ` + ${formatCurrency(storeConfig.customizationPrice)} de personalização` : ""}</p>{item.patches?.map((selected) => <p key={selected.id} className="mt-1 text-xs text-muted">{patchOptions.find((patch) => patch.id === selected.id)?.name ?? "Patch"} · {selected.position.replaceAll("-", " ")}</p>)}<div className="mt-3 flex items-center gap-3"><button onClick={() => updateQuantity(item.lineId, item.quantity - 1)} aria-label="Diminuir quantidade"><Minus size={14} /></button><span className="text-sm">{item.quantity}</span><button onClick={() => updateQuantity(item.lineId, item.quantity + 1)} aria-label="Aumentar quantidade"><Plus size={14} /></button><button onClick={() => removeItem(item.lineId)} className="ml-auto flex items-center gap-1 text-xs text-muted"><Trash2 size={14} /> Remover</button></div></div></article>; })}</section>
        <aside className="h-fit rounded-xl border p-5"><h2 className="text-lg font-black">Resumo do pedido</h2><div className="mt-5 flex justify-between text-sm"><span>Subtotal</span><span>{formatCurrency(subtotal)}</span></div>{bundleDiscount > 0 && <div className="mt-3 flex justify-between text-sm text-blue-600"><span>Oferta por quantidade</span><span>-{formatCurrency(bundleDiscount)}</span></div>}<div className="mt-3 flex justify-between text-sm"><span>Frete</span><span>{shipping === 0 ? "Grátis" : formatCurrency(shipping)}</span></div>
          <div className="mt-5 flex justify-between border-t pt-4 text-lg font-black"><span>Total</span><span>{formatCurrency(grandTotal)}</span></div>
          {needsReview ? <p role="status" className="mt-5 rounded bg-amber-50 p-3 text-xs leading-5 text-amber-950">Há produto com preço em revisão. Remova-o para continuar ao checkout.</p> : <Link href="/checkout" className="primary-button mt-5 block py-3.5 text-center text-sm font-black uppercase">Continuar para checkout</Link>}
          <Link href="/masculino" className="mt-3 block text-center text-xs font-bold underline">Continuar comprando</Link>
        </aside>
      </div>}
  </main>;
}
