"use client";

import Link from "next/link";
import { useState } from "react";
import { Check, ShoppingBag } from "lucide-react";
import { SafeProductImage } from "@/components/safe-product-image";
import { formatCurrency, productImageAsset } from "@/lib/catalog";
import type { Product } from "@/lib/types";
import { storeConfig } from "@/config";
import { useCart } from "@/store/cart";
import { flyThumbnailToCart } from "@/lib/fly-to-cart";
import { classifyProduct, getProductUnitPrice } from "@/lib/product-classification";
import { getProductOfferText } from "@/lib/commerce";
import { allowsCustomization } from "@/lib/formula-one";

export function ProductCard({ product }: { product: Product }) {
  const [size, setSize] = useState("");
  const [added, setAdded] = useState(false);
  const addItem = useCart((state) => state.addItem);
  const primaryImage = productImageAsset(product);
  const alternateImage = productImageAsset(product, true);
  const classification = classifyProduct(product);

  function add() {
    if (!size) return;
    flyThumbnailToCart(document.querySelector<HTMLImageElement>(`#product-${product.id} img`));
    addItem(product, size);
    setAdded(true);
    window.setTimeout(() => setAdded(false), 1800);
  }

  return <article id={`product-${product.id}`} className="product-card group flex flex-col h-full min-w-0 w-full overflow-hidden" onMouseMove={(event) => {
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
    <div className="product-image relative aspect-[4/5] overflow-hidden rounded-lg bg-paper shrink-0">
      <Link href={`/produto/${product.slug}`} aria-label={`Ver ${product.nome}`} className="relative block h-full w-full">
        <SafeProductImage src={primaryImage.src} fallbackSrc={primaryImage.fallbackSrc} alt={primaryImage.alt} fill sizes="(max-width: 640px) 48vw, (max-width: 1024px) 30vw, 240px" placeholder="blur" blurDataURL={primaryImage.blurDataURL} className="product-photo object-cover transition-opacity duration-500 group-hover:opacity-0" style={{ objectPosition: `${primaryImage.focalPoint.x}% ${primaryImage.focalPoint.y}%` }} />
        {alternateImage.src !== primaryImage.src && <SafeProductImage src={alternateImage.src} fallbackSrc={alternateImage.fallbackSrc} alt="" aria-hidden="true" fill sizes="(max-width: 640px) 48vw, (max-width: 1024px) 30vw, 240px" placeholder="blur" blurDataURL={alternateImage.blurDataURL} className="product-photo absolute inset-0 object-cover opacity-0 transition-opacity duration-500 group-hover:opacity-100" style={{ objectPosition: `${alternateImage.focalPoint.x}% ${alternateImage.focalPoint.y}%` }} />}
      </Link>
    </div>
    <div className="flex flex-1 flex-col justify-between pt-3 min-w-0 w-full">
      <div className="min-w-0 w-full space-y-1">
        <p className="line-clamp-2 min-h-10 text-xs font-semibold leading-5 text-ink sm:text-sm break-words overflow-hidden" title={product.nome}>
          {product.nome}
        </p>
        <div className="flex flex-wrap items-baseline gap-1.5 min-w-0">
          <span className="text-sm font-bold text-ink sm:text-base break-words">
            {classification.reviewRequired ? classification.priceLabel : `A partir de ${formatCurrency(getProductUnitPrice(product)!)}`}
          </span>
        </div>
        <p className="line-clamp-2 text-[10px] leading-4 text-muted break-words overflow-hidden">
          {getProductOfferText(product)}
        </p>
        <p className="text-[10px] text-muted truncate">
          Tamanho 2GG: +{formatCurrency(storeConfig.size2GGPrice)}
        </p>
        {allowsCustomization(product) && (
          <p className="text-[10px] text-muted truncate">
            Personalização: +{formatCurrency(storeConfig.customizationPrice)} por camisa
          </p>
        )}
      </div>
      <div className="mt-3 pt-1">
        <div className="flex flex-wrap gap-1" aria-label="Selecione um tamanho">
          {product.tamanhos.slice(0, 6).map((itemSize) => (
            <button
              key={itemSize}
              onClick={() => setSize(itemSize)}
              aria-label={`Tamanho ${itemSize}`}
              className={`grid h-7 min-w-7 place-items-center rounded-lg border px-1 text-[10px] font-bold transition-colors ${
                size === itemSize ? "border-pitch bg-pitch text-white" : "border-border text-ink hover:border-pitch"
              }`}
            >
              {itemSize}
            </button>
          ))}
        </div>
        {!classification.reviewRequired && size ? (
          <button
            onClick={add}
            aria-label={"Comprar " + product.nome}
            className="product-buy mt-3 flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-action py-2.5 text-[11px] font-bold uppercase tracking-wider text-white transition hover:bg-action-hover"
          >
            {added ? <><Check size={15} /> Adicionado!</> : <><ShoppingBag size={15} />Comprar</>}
          </button>
        ) : (
          <Link
            href={`/produto/${product.slug}#secao-compra`}
            aria-label={"Ver compra de " + product.nome}
            className="product-buy mt-3 flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-action py-2.5 text-[11px] font-bold uppercase tracking-wider text-white transition hover:bg-action-hover"
          >
            <ShoppingBag size={15} />
            {classification.price !== null ? "Comprar" : "Ver produto"}
          </Link>
        )}
      </div>
    </div>
  </article>;
}
