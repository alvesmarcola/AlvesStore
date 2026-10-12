"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { Minus, Plus, Trash2, Truck } from "lucide-react";
import { storeConfig } from "@/config";
import { formatCurrency, productImageAsset } from "@/lib/catalog";
import { useCart } from "@/store/cart";
import { getCartPricing, qualifiesForFreeShipping } from "@/lib/commerce";

export default function CartPage() {
  const { items, updateQuantity, removeItem, coupon, setCoupon } = useCart();
  const [cep, setCep] = useState("");
  const [shipping, setShipping] = useState<number | null>(null);
  const [cepError, setCepError] = useState("");
  const { subtotal, couponDiscount, bundleDiscount, totalDiscount } = getCartPricing(items, coupon);
  const validCoupon = coupon.trim().toUpperCase() === storeConfig.firstPurchaseCoupon;
  const freeShipping = qualifiesForFreeShipping(items);
  const freight = freeShipping ? 0 : shipping ?? 0;
  const total = subtotal - totalDiscount + freight;
  const hasUnavailableItems = items.some((item) => item.product.estoque < item.quantity);

  function calculate() {
    if (cep.replace(/\D/g, "").length !== 8) { setCepError("Informe um CEP válido com 8 números."); return; }
    setCepError(""); setShipping(19.9);
  }

  return <main className="mx-auto max-w-7xl px-4 py-9 lg:px-8"><h1 className="text-3xl font-black">Sua sacola</h1><p className="mt-2 text-sm text-muted">Confira seus itens antes de seguir para o checkout.</p>
    {!items.length ? <div className="mt-8 rounded-xl bg-paper px-5 py-16 text-center"><h2 className="text-xl font-black">Sua sacola está vazia</h2><p className="mt-2 text-sm text-muted">Tem muita camisa esperando para entrar em campo.</p><Link href="/masculino" className="mt-5 inline-block rounded bg-action px-6 py-3 text-xs font-black uppercase">Explorar camisas</Link></div> :
      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_360px]">
        <section className="rounded-xl border p-4 sm:p-6">{items.map((item) => <article key={item.lineId} className="flex gap-4 border-b py-5 first:pt-0 last:border-b-0 last:pb-0"><div className="relative h-28 w-24 shrink-0 overflow-hidden rounded bg-paper"><Image src={productImageAsset(item.product).src} alt={item.product.nome} fill sizes="96px" className="object-cover" /></div><div className="min-w-0 flex-1"><Link href={`/produto/${item.product.slug}`} className="line-clamp-2 text-sm font-bold">{item.product.nome}</Link><p className="mt-1 text-xs text-muted">Tamanho {item.size}{item.customization ? ` · ${item.customization.name} ${item.customization.number}` : ""}</p>{item.product.estoque < item.quantity && <p role="alert" className="mt-1 text-xs font-bold text-danger">{item.product.estoque <= 0 ? "Produto esgotado. Remova-o para continuar." : `Estoque disponível: ${item.product.estoque} unidade(s).`}</p>}<p className="mt-2 font-black">{formatCurrency(storeConfig.shirtPrice + (item.customization ? storeConfig.customizationPrice : 0))} / un.</p><div className="mt-3 flex items-center gap-3"><button onClick={() => updateQuantity(item.lineId, item.quantity - 1)} aria-label="Diminuir quantidade"><Minus size={14} /></button><span className="text-sm">{item.quantity}</span><button onClick={() => updateQuantity(item.lineId, item.quantity + 1)} aria-label="Aumentar quantidade"><Plus size={14} /></button><button onClick={() => removeItem(item.lineId)} className="ml-auto flex items-center gap-1 text-xs text-muted"><Trash2 size={14} /> Remover</button></div></div></article>)}</section>
        <aside className="h-fit rounded-xl border p-5"><h2 className="text-lg font-black">Resumo do pedido</h2><div className="mt-5 flex justify-between text-sm"><span>Subtotal</span><span>{formatCurrency(subtotal)}</span></div><div className="mt-3 flex justify-between text-sm"><span>Frete</span><span>{freeShipping ? "Grátis" : shipping === null ? "A calcular" : formatCurrency(freight)}</span></div>{couponDiscount > 0 && <div className="mt-3 flex justify-between text-sm text-blue-600"><span>Cupom</span><span>-{formatCurrency(couponDiscount)}</span></div>}{bundleDiscount > 0 && <div className="mt-3 flex justify-between text-sm text-blue-600"><span>Desconto nos pacotes</span><span>-{formatCurrency(bundleDiscount)}</span></div>}
          <div className="mt-5 border-t pt-4"><label htmlFor="cart-coupon" className="text-xs font-bold">Cupom</label><div className="mt-1 flex gap-2"><input id="cart-coupon" value={coupon} onChange={(event) => setCoupon(event.target.value)} placeholder="PRIMEIRACOMPRA" className="min-w-0 flex-1 rounded border px-3 py-2 text-xs uppercase" /><button onClick={() => setCoupon(coupon.trim().toUpperCase())} className="rounded-lg border px-3 text-[10px] font-black">APLICAR</button></div>{coupon && <p role="status" className={`mt-1 text-xs ${validCoupon ? "text-success" : "text-danger"}`}>{validCoupon ? "Cupom aplicado: 10% OFF" : "Cupom não reconhecido"}</p>}</div>
          <div className="mt-5 border-t pt-4"><label htmlFor="cart-cep" className="flex items-center gap-2 text-xs font-bold"><Truck size={15} />Calcular frete</label><div className="mt-2 flex gap-2"><input id="cart-cep" inputMode="numeric" maxLength={9} value={cep} onChange={(event) => setCep(event.target.value.replace(/[^\d-]/g, ""))} placeholder="00000-000" className="min-w-0 flex-1 rounded border px-3 py-2 text-xs" /><button onClick={calculate} className="rounded bg-pitch px-3 text-[10px] font-black text-white">CALCULAR</button></div>{cepError && <p role="alert" className="mt-1 text-xs text-red-600">{cepError}</p>}{!freeShipping && shipping === null && <p className="mt-2 text-[10px] text-muted">Frete grátis na compra de {storeConfig.freeShippingQuantity} camisas. CEP válido: frete estimado de {formatCurrency(19.9)}.</p>}</div>
          {total < storeConfig.minimumOrder && <p className="mt-4 text-xs text-red-600">Pedido mínimo de {formatCurrency(storeConfig.minimumOrder)}.</p>}
          <div className="mt-5 flex justify-between border-t pt-4 text-lg font-black"><span>Total</span><span>{formatCurrency(total)}</span></div><p className="mt-1 text-right text-xs font-bold text-blue-600">{formatCurrency(total * (1 - storeConfig.pixDiscount))} no Pix</p><p className="mt-1 text-right text-[10px] text-muted">ou até 12x de {formatCurrency(total / 12)}</p>
          {hasUnavailableItems && <p role="alert" className="mt-3 text-xs font-semibold text-danger">Remova ou ajuste os produtos sem estoque antes de continuar.</p>}
          <Link aria-disabled={hasUnavailableItems} tabIndex={hasUnavailableItems ? -1 : undefined} href={hasUnavailableItems ? "/carrinho" : "/checkout"} className={`primary-button mt-5 block py-3.5 text-center text-sm font-black uppercase ${hasUnavailableItems ? "pointer-events-none opacity-50" : ""}`}>Continuar para checkout</Link>
          <Link href="/masculino" className="mt-3 block text-center text-xs font-bold underline">Continuar comprando</Link>
        </aside>
      </div>}
  </main>;
}
