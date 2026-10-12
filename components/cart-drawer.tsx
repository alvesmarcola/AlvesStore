"use client";

import Link from "next/link";
import Image from "next/image";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Minus, Plus, ShoppingBag, Trash2, X } from "lucide-react";
import { storeConfig } from "@/config";
import { formatCurrency, productImageAsset } from "@/lib/catalog";
import { useCart } from "@/store/cart";
import { getCartPricing, qualifiesForFreeShipping } from "@/lib/commerce";

export function CartDrawer() {
  const { items, drawerOpen, setDrawerOpen, updateQuantity, removeItem, coupon, setCoupon } = useCart();
  const { subtotal, couponDiscount, bundleDiscount, totalDiscount } = getCartPricing(items, coupon);
  const validCoupon = coupon.trim().toUpperCase() === storeConfig.firstPurchaseCoupon;
  const total = subtotal - totalDiscount;
  const freeShipping = qualifiesForFreeShipping(items);
  const reducedMotion = useReducedMotion();

  return <>
    <AnimatePresence>
    {drawerOpen && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: reducedMotion ? 0 : 0.2 }} className="fixed inset-0 z-[70] bg-black/45" onClick={() => setDrawerOpen(false)}>
      <motion.aside initial={reducedMotion ? { x: 0 } : { x: "100%" }} animate={{ x: 0 }} exit={reducedMotion ? { opacity: 0 } : { x: "100%" }} transition={reducedMotion ? { duration: 0 } : { type: "spring", stiffness: 360, damping: 34 }} role="dialog" aria-modal="true" aria-label="Carrinho de compras" className="ml-auto flex h-full w-full max-w-md flex-col bg-white shadow-xl" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-center justify-between border-b px-5 py-4"><h2 className="flex items-center gap-2 text-lg font-black"><ShoppingBag size={20} /> Sua sacola ({items.reduce((sum, item) => sum + item.quantity, 0)})</h2><button className="icon-button" onClick={() => setDrawerOpen(false)} aria-label="Fechar carrinho"><X /></button></div>
        {!items.length ? <div className="grid flex-1 place-content-center text-center"><ShoppingBag className="mx-auto text-muted" size={38} /><p className="mt-4 font-bold">Sua sacola está esperando por você</p><Link href="/masculino" onClick={() => setDrawerOpen(false)} className="mt-4 rounded bg-action px-5 py-3 text-xs font-black uppercase">Explorar produtos</Link></div> : <>
          <div className="flex-1 overflow-y-auto px-5">
            <p className="my-4 rounded bg-paper p-3 text-xs font-semibold text-ink">{freeShipping ? "Seu pacote inclui frete grátis!" : `Frete grátis na compra de ${storeConfig.freeShippingQuantity} camisas.`}</p>
            {items.map(({ lineId, product, size, quantity, customization }) => <div key={lineId} className="flex gap-3 border-b py-4">
              <div className="relative h-24 w-20 shrink-0 overflow-hidden rounded bg-paper"><Image src={productImageAsset(product).src} alt={product.nome} fill sizes="80px" className="object-cover" /></div>
              <div className="min-w-0 flex-1"><p className="line-clamp-2 text-xs font-bold">{product.nome}</p><p className="mt-1 text-xs text-muted">Tamanho: {size}{customization ? ` · ${customization.name} ${customization.number}` : ""}</p>{product.estoque < quantity && <p role="alert" className="mt-1 text-xs font-bold text-danger">{product.estoque <= 0 ? "Produto esgotado. Remova-o para continuar." : `Estoque disponível: ${product.estoque} unidade(s).`}</p>}<p className="mt-1 text-sm font-black">{formatCurrency(storeConfig.shirtPrice + (customization ? storeConfig.customizationPrice : 0))} / un.</p>
                <div className="mt-2 flex items-center gap-3"><button aria-label="Diminuir quantidade" onClick={() => updateQuantity(lineId, quantity - 1)}><Minus size={14} /></button><span className="text-sm">{quantity}</span><button aria-label="Aumentar quantidade" onClick={() => updateQuantity(lineId, quantity + 1)}><Plus size={14} /></button><button className="ml-auto text-muted" aria-label="Remover produto" onClick={() => removeItem(lineId)}><Trash2 size={15} /></button></div>
              </div>
            </div>)}
          </div>
          <div className="border-t p-5">
            <label htmlFor="drawer-coupon" className="text-xs font-bold">Cupom de desconto</label><div className="mt-1 flex gap-2"><input id="drawer-coupon" value={coupon} onChange={(event) => setCoupon(event.target.value)} placeholder="Digite seu cupom" className="min-w-0 flex-1 rounded border px-3 py-2 text-sm uppercase" /><button className="rounded border px-3 text-xs font-black" onClick={() => setCoupon(coupon.trim().toUpperCase())}>APLICAR</button></div>
            {coupon && <p role="status" className={`mt-1 text-xs ${validCoupon ? "text-success" : "text-danger"}`}>{validCoupon ? "Cupom aplicado: 10% de desconto" : "Cupom não reconhecido"}</p>}
            <div className="mt-4 flex justify-between text-sm"><span>Subtotal</span><span>{formatCurrency(subtotal)}</span></div>{couponDiscount > 0 && <div className="mt-1 flex justify-between text-sm text-success"><span>Cupom</span><span>-{formatCurrency(couponDiscount)}</span></div>}{bundleDiscount > 0 && <div className="mt-1 flex justify-between text-sm text-success"><span>Desconto nos pacotes</span><span>-{formatCurrency(bundleDiscount)}</span></div>}
            <div className="mt-2 flex justify-between text-lg font-black"><span>Total</span><span>{formatCurrency(total)}</span></div><p className="mt-1 text-right text-xs font-bold text-blue-600">{formatCurrency(total * (1 - storeConfig.pixDiscount))} no Pix</p>
            {total < storeConfig.minimumOrder && <p className="mt-2 text-xs text-red-600">Pedido mínimo de {formatCurrency(storeConfig.minimumOrder)}.</p>}
            <Link href="/carrinho" onClick={() => setDrawerOpen(false)} className="mt-4 block rounded bg-action py-3 text-center text-sm font-black uppercase">Ver sacola</Link>
          </div>
        </>}
      </motion.aside>
    </motion.div>}
    </AnimatePresence>
  </>;
}
