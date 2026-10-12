"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { Check, Heart, Ruler, Truck } from "lucide-react";
import { ProductGrid } from "@/components/product-grid";
import { formatCurrency, getLeague, productImageAsset, products } from "@/lib/catalog";
import type { Product } from "@/lib/types";
import { storeConfig } from "@/config";
import { useCart } from "@/store/cart";

export function ProductDetails({ product }: { product: Product }) {
  const [size, setSize] = useState("");
  const [personalize, setPersonalize] = useState(false);
  const [name, setName] = useState("");
  const [number, setNumber] = useState("");
  const [cep, setCep] = useState("");
  const [shipping, setShipping] = useState("");
  const [cepError, setCepError] = useState("");
  const [added, setAdded] = useState(false);
  const [activeImage, setActiveImage] = useState(0);
  const [sizeGuideOpen, setSizeGuideOpen] = useState(false);
  const addItem = useCart((state) => state.addItem);
  const related = products.filter((item) => item.id !== product.id && ((product.clubeSlug !== "revisar" && item.clubeSlug === product.clubeSlug) || (product.liga !== "revisar" && item.liga === product.liga))).slice(0, 4);
  const gallery = product.images?.length ? product.images : [productImageAsset(product), productImageAsset(product, true)];
  const selectedImage = gallery[Math.min(activeImage, gallery.length - 1)];
  const price = product.preco + (personalize ? storeConfig.customizationPrice : 0);
  const audienceLabels = { masculino: "masculino", feminino: "feminino", unissex: "unissex", infantil: "infantil", revisar: "" };
  const typeLabels = { torcedor: "versão torcedor", jogador: "versão jogador", goleiro: "goleiro", retro: "retrô", treino: "treino", cropped: "cropped", regata: "regata", inverno: "mangas compridas", vestido: "vestido", revisar: "" };
  const uniformLabels = { titular: "casa (Home)", reserva: "fora (Away)", terceiro: "terceira camisa (Third)", revisar: "" };
  const verifiedMetadata = [
    audienceLabels[product.publico] ? `Público: ${audienceLabels[product.publico]}` : "",
    typeLabels[product.tipo] ? `Tipo: ${typeLabels[product.tipo]}` : "",
    product.temporada !== "revisar" ? `Temporada: ${product.temporada}` : "",
    uniformLabels[product.uniforme] ? `Uniforme: ${uniformLabels[product.uniforme]}` : "",
    product.cor !== "revisar" ? `Cor: ${product.cor}` : "",
  ].filter(Boolean);
  const productContext = [
    product.clube !== "revisar" ? product.clube : "",
    product.temporada !== "revisar" ? `Temporada ${product.temporada}` : "",
  ].filter(Boolean).join(" · ");

  async function calculateShipping(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setShipping("");
    setCepError("");
    const normalized = cep.replace(/\D/g, "");
    if (normalized.length !== 8) {
      setCepError("Digite um CEP válido com 8 números.");
      return;
    }
    try {
      const response = await fetch(`https://viacep.com.br/ws/${normalized}/json/`);
      if (!response.ok) throw new Error("Não foi possível consultar o CEP agora.");
      const address = await response.json();
      if (address.erro) {
        setCepError("CEP não encontrado. Confira os números e tente novamente.");
        return;
      }
      setShipping(`${address.localidade} - ${address.uf}: o frete não pode ser calculado nesta demonstração. É grátis na compra de ${storeConfig.freeShippingQuantity} camisas.`);
    } catch {
      setCepError("Não foi possível consultar o CEP neste momento. Tente novamente.");
    }
  }

  function buy() {
    if (!size || (personalize && (!name.trim() || !number.trim()))) return;
    addItem(product, size, personalize ? { name: name.trim(), number: number.trim() } : undefined);
    setAdded(true);
    window.setTimeout(() => setAdded(false), 1800);
  }

  return <main className="mx-auto max-w-7xl px-4 py-7 pb-24 lg:px-8 lg:pb-10">
    <nav className="mb-6 text-xs text-muted"><Link href="/">Início</Link>{product.liga !== "revisar" && <> / <Link href={`/ligas/${product.liga}`}>{getLeague(product.liga)?.nome ?? product.liga.replaceAll("-", " ")}</Link></>}{product.clube !== "revisar" && <> / {product.clube}</>}</nav>
    <div className="grid gap-8 lg:grid-cols-2 lg:gap-12">
      <div className="grid grid-cols-[58px_1fr] gap-3 sm:grid-cols-[76px_1fr]">
        <div className="flex flex-col gap-3">{gallery.map((image, index) => <button key={`${image.src}-${index}`} type="button" aria-label={`Ver foto ${index + 1} de ${gallery.length}`} aria-pressed={activeImage === index} onClick={() => setActiveImage(index)} className={`relative aspect-[4/5] overflow-hidden rounded border ${activeImage === index ? "border-pitch" : "border-transparent"}`}><Image src={image.src} alt={image.alt} fill sizes="76px" placeholder="blur" blurDataURL={image.blurDataURL} className="object-cover" style={{ objectPosition: `${image.focalPoint.x}% ${image.focalPoint.y}%` }} /></button>)}</div>
        <button type="button" onClick={() => setActiveImage((activeImage + 1) % gallery.length)} aria-label="Ampliar e ver próxima imagem do produto" className="group relative aspect-[4/5] overflow-hidden rounded-xl bg-paper"><Image src={selectedImage.src} alt={selectedImage.alt} fill priority sizes="(max-width: 1024px) 80vw, 50vw" placeholder="blur" blurDataURL={selectedImage.blurDataURL} className="object-cover transition-transform duration-300 group-hover:scale-110" style={{ objectPosition: `${selectedImage.focalPoint.x}% ${selectedImage.focalPoint.y}%` }} /><span className="absolute bottom-3 right-3 rounded-full bg-white/90 px-3 py-1 text-[10px] font-bold text-ink">Toque para ampliar · {activeImage + 1}/{gallery.length}</span></button>
      </div>
      <div>
        {productContext && <p className="text-[10px] font-black uppercase tracking-[.2em] text-blue-600">{productContext}</p>}
        <h1 className="mt-2 text-2xl font-black leading-tight sm:text-3xl">{product.nome}</h1>
        <div className="mt-5 flex items-baseline gap-3"><span className="text-3xl font-black">{formatCurrency(price)}</span></div>
        <p className="mt-1 text-xs text-muted">1 camisa: {formatCurrency(storeConfig.shirtPrice)} + frete · 2: {formatCurrency(storeConfig.twoShirtPrice)} + frete · 3: {formatCurrency(storeConfig.threeShirtPrice)} com frete grátis</p>
        {personalize && <p className="mt-1 text-xs text-muted">Personalização: +{formatCurrency(storeConfig.customizationPrice)} por camisa</p>}
        <div className="mt-6 flex items-center justify-between"><h2 className="text-sm font-black">Tamanho</h2><button type="button" onClick={() => setSizeGuideOpen(true)} className="flex items-center gap-1 text-xs font-bold text-blue-700 underline"><Ruler size={14} /> Guia de medidas</button></div>
        <div className="mt-3 flex flex-wrap gap-2">{product.tamanhos.map((itemSize) => <button key={itemSize} onClick={() => setSize(itemSize)} className={`grid h-11 min-w-12 place-items-center rounded border px-3 text-xs font-bold ${size === itemSize ? "border-pitch bg-pitch text-white" : "border-black/15"}`}>{itemSize}</button>)}</div>
        <p className="mt-2 text-xs text-muted">Tamanhos sujeitos à confirmação do fornecedor.</p>
        {!size && product.tamanhos.length > 0 && <p className="mt-2 text-[11px] text-muted">Selecione um tamanho para continuar.</p>}
        <div className="mt-6 rounded-lg border p-4"><label className="flex items-center gap-2 text-sm font-bold"><input type="checkbox" checked={personalize} onChange={(event) => setPersonalize(event.target.checked)} />Quero personalizar (+{formatCurrency(storeConfig.customizationPrice)} por camisa)</label>{personalize && <div className="mt-3 grid grid-cols-2 gap-3"><label className="text-xs font-semibold">Nome<input maxLength={12} value={name} onChange={(event) => setName(event.target.value)} placeholder="Ex.: ALEX" className="mt-1 w-full rounded border px-3 py-2 text-sm uppercase" /></label><label className="text-xs font-semibold">Número<input inputMode="numeric" maxLength={2} value={number} onChange={(event) => setNumber(event.target.value.replace(/\D/g, ""))} placeholder="10" className="mt-1 w-full rounded border px-3 py-2 text-sm" /></label></div>}</div>
        <button disabled={!size || (personalize && (!name.trim() || !number.trim()))} onClick={buy} className="mt-5 hidden w-full items-center justify-center gap-2 rounded bg-action py-4 text-sm font-black uppercase tracking-wide hover:bg-[#b6e351] disabled:bg-gray-200 disabled:text-gray-500 sm:flex">{added ? <><Check size={18} /> Adicionado ao carrinho!</> : "Comprar agora"}</button>
        <div className="mt-6 rounded-lg bg-paper p-4"><form onSubmit={calculateShipping} className="flex gap-2"><label htmlFor="product-cep" className="sr-only">Calcular frete pelo CEP</label><input id="product-cep" inputMode="numeric" maxLength={9} value={cep} onChange={(event) => setCep(event.target.value.replace(/[^\d-]/g, ""))} placeholder="Digite seu CEP" className="min-w-0 flex-1 rounded border bg-white px-3 py-2.5 text-sm" /><button className="rounded bg-pitch px-4 text-xs font-black text-white">CALCULAR</button></form>{cepError && <p role="alert" className="mt-2 text-xs text-red-600">{cepError}</p>}{shipping && <p className="mt-2 text-xs leading-5">{shipping}</p>}<Link href="https://viacep.com.br/" target="_blank" className="mt-2 inline-block text-[10px] text-muted underline">Não sei meu CEP</Link></div>
        <div className="mt-5 grid gap-3 text-xs text-muted"><p className="flex items-center gap-2"><Truck size={17} />Frete grátis no pacote de {storeConfig.freeShippingQuantity} camisas</p><p className="flex items-center gap-2"><Heart size={17} />Personalização opcional por {formatCurrency(storeConfig.customizationPrice)} por camisa</p></div>
        {verifiedMetadata.length > 0 && <details className="mt-6 border-t py-4"><summary className="cursor-pointer text-sm font-black">Informações do produto</summary><ul className="mt-3 space-y-1 text-sm leading-6 text-muted">{verifiedMetadata.map((item) => <li key={item}>{item}</li>)}</ul></details>}
      </div>
    </div>
    {related.length > 0 && <section className="mt-14"><h2 className="mb-5 text-2xl font-black">{product.clube !== "revisar" ? `Mais camisas de ${product.clube}` : "Mais produtos desta categoria"}</h2><ProductGrid items={related} /></section>}
    {sizeGuideOpen && <div className="fixed inset-0 z-[80] grid place-items-center bg-black/60 p-4" onClick={() => setSizeGuideOpen(false)}><section role="dialog" aria-modal="true" aria-labelledby="size-guide-title" className="max-h-[90dvh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white p-5 shadow-xl sm:p-7" onClick={(event) => event.stopPropagation()}><div className="flex items-start justify-between gap-3"><div><h2 id="size-guide-title" className="text-xl font-black">Guia de tamanhos</h2><p className="mt-2 text-sm leading-6 text-muted">A tabela de medidas específica dos produtos ainda não foi fornecida. Confirme o tamanho com o fornecedor antes da compra.</p></div><button type="button" onClick={() => setSizeGuideOpen(false)} aria-label="Fechar guia de medidas" className="rounded-lg border border-border px-3 py-2 text-sm font-bold">Fechar</button></div><Link href="/guia-de-medidas" onClick={() => setSizeGuideOpen(false)} className="mt-4 inline-block text-xs font-bold text-blue-700 underline">Ver informações sobre tamanhos</Link></section></div>}
    <button disabled={!size || (personalize && (!name.trim() || !number.trim()))} onClick={buy} className="fixed bottom-0 left-0 right-0 z-30 flex items-center justify-center gap-2 bg-action py-4 text-sm font-black uppercase shadow-lg disabled:bg-gray-300 sm:hidden">{added ? "Adicionado ao carrinho!" : `Comprar · ${formatCurrency(price)}`}</button>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({ "@context": "https://schema.org", "@type": "Product", name: product.nome, image: gallery.map((image) => image.src), offers: { "@type": "Offer", priceCurrency: "BRL", price: product.preco } }).replace(/</g, "\\u003c") }} />
  </main>;
}
