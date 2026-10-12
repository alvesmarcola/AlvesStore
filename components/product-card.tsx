"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { Check, ShoppingBag } from "lucide-react";
import { formatCurrency, productImageAsset } from "@/lib/catalog";
import type { Product } from "@/lib/types";
import { storeConfig } from "@/config";
import { useCart } from "@/store/cart";
import { flyThumbnailToCart } from "@/lib/fly-to-cart";

export function ProductCard({ product }: { product: Product }) {
  const [size, setSize] = useState("");
  const [added, setAdded] = useState(false);
  const addItem = useCart((state) => state.addItem);
  const soldOut = product.estoque <= 0;
  const pix = product.preco * (1 - storeConfig.pixDiscount);
  const primaryImage = productImageAsset(product);
  const alternateImage = productImageAsset(product, true);

  function add() {
    if (!size || soldOut) return;
    flyThumbnailToCart(document.querySelector<HTMLImageElement>(`#product-${product.id} img`));
    addItem(product, size);
    setAdded(true);
    window.setTimeout(() => setAdded(false), 1800);
  }

  return <article id={`product-${product.id}`} className="product-card group min-w-0" onMouseMove={(event) => {
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    event.currentTarget.style.setProperty("--spot-x", `${event.clientX - bounds.left}px`);
    event.currentTarget.style.setProperty("--spot-y", `${event.clientY - bounds.top}px`);
    const rotateX = ((event.clientY - bounds.top) / bounds.height - 0.5) * -3;
    const rotateY = ((event.clientX - bounds.left) / bounds.width - 0.5) * 3;
    event.currentTarget.style.transform = `perspective(900px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
  }} onMouseLeave={(event) => {
    event.currentTarget.style.transform = "";
  }}>
    <div className="product-image relative aspect-[4/5] overflow-hidden rounded-lg bg-paper">
      <Link href={`/produto/${product.slug}`} aria-label={`Ver ${product.nome}`} className="relative block h-full w-full">
        <Image src={primaryImage.src} alt={primaryImage.alt} fill sizes="(max-width: 640px) 48vw, (max-width: 1024px) 30vw, 240px" placeholder="blur" blurDataURL={primaryImage.blurDataURL} className="product-photo object-cover transition-opacity duration-500 group-hover:opacity-0" style={{ objectPosition: `${primaryImage.focalPoint.x}% ${primaryImage.focalPoint.y}%` }} />
        <Image src={alternateImage.src} alt="" aria-hidden="true" fill sizes="(max-width: 640px) 48vw, (max-width: 1024px) 30vw, 240px" placeholder="blur" blurDataURL={alternateImage.blurDataURL} className="product-photo absolute inset-0 object-cover opacity-0 transition-opacity duration-500 group-hover:opacity-100" style={{ objectPosition: `${alternateImage.focalPoint.x}% ${alternateImage.focalPoint.y}%` }} />
      </Link>
      {product.estoque <= 3 && product.estoque > 0 && <span className="absolute bottom-2 left-2 rounded bg-white/95 px-2 py-1 text-[10px] font-bold text-ink">Últimas peças!</span>}
      {soldOut && <span className="absolute inset-0 grid place-items-center bg-black/35 font-black text-white">ESGOTADO</span>}
    </div>
    <div className="pt-3">
      <Link href={`/produto/${product.slug}`} className="line-clamp-2 min-h-10 text-xs font-medium leading-5 text-ink hover:underline sm:text-sm">{product.nome}</Link>
      <div className="mt-2 flex items-baseline gap-2"><span className="text-base font-black text-ink">{formatCurrency(storeConfig.shirtPrice)}</span></div>
      <p className="mt-0.5 text-xs font-bold text-blue-600">{formatCurrency(pix)} no Pix</p>
      <p className="mt-1 text-[10px] leading-4 text-muted">2 camisas por {formatCurrency(storeConfig.twoShirtPrice)} · 3 por {formatCurrency(storeConfig.threeShirtPrice)} com frete grátis</p>
      <p className="mt-1 text-[10px] text-muted">Personalização: +{formatCurrency(storeConfig.customizationPrice)} por camisa</p>
      <p className="mt-1 text-[10px] text-muted">ou 12x de {formatCurrency(product.preco / 12)} sem juros</p>
      <div className="mt-3 flex flex-wrap gap-1" aria-label="Selecione um tamanho">
        {product.tamanhos.slice(0, 6).map((itemSize) => <button key={itemSize} disabled={product.esgotados.includes(itemSize) || soldOut} onClick={() => setSize(itemSize)} aria-label={`Tamanho ${itemSize}${product.esgotados.includes(itemSize) ? ", esgotado" : ""}`} className={`grid h-7 min-w-7 place-items-center rounded-lg border px-1 text-[10px] font-bold ${size === itemSize ? "border-pitch bg-pitch text-white" : "border-border text-ink"} disabled:cursor-not-allowed disabled:text-secondary disabled:line-through`}>{itemSize}</button>)}
      </div>
      <button onClick={add} disabled={!size || soldOut} className="product-buy mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-action py-2.5 text-[11px] font-black uppercase tracking-wide text-white transition hover:bg-action-hover disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-500">{added ? <><Check size={15} /> Adicionado!</> : <><ShoppingBag size={15} />{soldOut ? "Esgotado" : "Comprar"}</>}</button>
    </div>
  </article>;
}
