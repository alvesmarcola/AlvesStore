"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { Check, Heart, Ruler, ShieldCheck, Truck } from "lucide-react";
import { ProductGrid } from "@/components/product-grid";
import { discountPercent, formatCurrency, productImage, products } from "@/lib/catalog";
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
  const [activeImage, setActiveImage] = useState(false);
  const [sizeGuideOpen, setSizeGuideOpen] = useState(false);
  const addItem = useCart((state) => state.addItem);
  const related = products.filter((item) => item.id !== product.id && (item.clubeSlug === product.clubeSlug || item.liga === product.liga)).slice(0, 4);
  const price = product.preco + (personalize ? storeConfig.customizationPrice : 0);
  const soldOut = product.estoque <= 0;

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
      setShipping(`${address.localidade} - ${address.uf}: PAC 6–9 dias úteis por R$ 19,90 · Expresso 2–4 dias úteis por R$ 29,90`);
    } catch {
      setCepError("Não foi possível consultar o CEP neste momento. Tente novamente.");
    }
  }

  function buy() {
    if (!size || soldOut || (personalize && (!name.trim() || !number.trim()))) return;
    addItem(product, size, personalize ? { name: name.trim(), number: number.trim() } : undefined);
    setAdded(true);
    window.setTimeout(() => setAdded(false), 1800);
  }

  return <main className="mx-auto max-w-7xl px-4 py-7 pb-24 lg:px-8 lg:pb-10">
    <nav className="mb-6 text-xs text-muted"><Link href="/">Início</Link> / <Link href={`/ligas/${product.liga}`}>{product.liga.replaceAll("-", " ")}</Link> / {product.clube}</nav>
    <div className="grid gap-8 lg:grid-cols-2 lg:gap-12">
      <div className="grid grid-cols-[58px_1fr] gap-3 sm:grid-cols-[76px_1fr]">
        <div className="flex flex-col gap-3"><button onClick={() => setActiveImage(false)} className={`relative aspect-[.8] overflow-hidden rounded border ${!activeImage ? "border-pitch" : "border-transparent"}`}><Image src={productImage(product.imageSeed)} alt={`Frente de ${product.nome}`} fill sizes="76px" priority className="object-cover" /></button><button onClick={() => setActiveImage(true)} className={`relative aspect-[.8] overflow-hidden rounded border ${activeImage ? "border-pitch" : "border-transparent"}`}><Image src={productImage(product.imageSeed, true)} alt={`Detalhe de ${product.nome}`} fill sizes="76px" className="object-cover" /></button></div>
        <button type="button" onClick={() => setActiveImage(!activeImage)} aria-label="Ampliar e alternar imagem do produto" className="group relative aspect-[.82] overflow-hidden rounded-xl bg-paper"><Image src={productImage(product.imageSeed, activeImage)} alt={product.nome} fill priority sizes="(max-width: 1024px) 80vw, 50vw" className="object-cover transition-transform duration-300 group-hover:scale-110" /><span className="absolute left-3 top-3 rounded-lg bg-action px-2 py-1 text-xs font-black text-white">-{discountPercent(product)}% OFF</span><span className="absolute bottom-3 right-3 rounded-full bg-white/90 px-3 py-1 text-[10px] font-bold text-ink">Toque para ampliar</span></button>
      </div>
      <div>
        <p className="text-[10px] font-black uppercase tracking-[.2em] text-blue-600">{product.clube} · Temporada {product.temporada}</p>
        <h1 className="mt-2 text-2xl font-black leading-tight sm:text-3xl">{product.nome}</h1>
        <div className="mt-4 flex items-center gap-2 text-sm"><span className="text-amber-500">★★★★★</span><span className="text-muted">4,8 · 126 avaliações</span></div>
        <div className="mt-5 flex items-baseline gap-3"><span className="text-sm text-muted line-through">{formatCurrency(product.precoAnterior)}</span><span className="text-3xl font-black">{formatCurrency(price)}</span></div>
        {personalize && <p className="mt-1 text-xs text-muted">Personalização: +{formatCurrency(storeConfig.customizationPrice)}</p>}
        <p className="mt-1 text-sm font-bold text-blue-600">{formatCurrency(price * (1 - storeConfig.pixDiscount))} no Pix · 3% OFF</p><p className="mt-1 text-xs text-muted">ou 12x de {formatCurrency(price / 12)} sem juros</p>
        {product.estoque <= 3 && product.estoque > 0 && <p className="mt-4 text-xs font-bold text-orange-700">Últimas peças disponíveis!</p>}
        <div className="mt-6 flex items-center justify-between"><h2 className="text-sm font-black">Tamanho</h2><button type="button" onClick={() => setSizeGuideOpen(true)} className="flex items-center gap-1 text-xs font-bold text-blue-700 underline"><Ruler size={14} /> Guia de medidas</button></div>
        <div className="mt-3 flex flex-wrap gap-2">{product.tamanhos.map((itemSize) => <button key={itemSize} disabled={product.esgotados.includes(itemSize) || soldOut} onClick={() => setSize(itemSize)} className={`grid h-11 min-w-12 place-items-center rounded border px-3 text-xs font-bold ${size === itemSize ? "border-pitch bg-pitch text-white" : "border-black/15"} disabled:cursor-not-allowed disabled:opacity-30`}>{itemSize}</button>)}</div>
        {!size && <p className="mt-2 text-[11px] text-muted">Selecione um tamanho para continuar.</p>}
        <div className="mt-6 rounded-lg border p-4"><label className="flex items-center gap-2 text-sm font-bold"><input type="checkbox" checked={personalize} onChange={(event) => setPersonalize(event.target.checked)} />Quero personalizar (+{formatCurrency(storeConfig.customizationPrice)})</label>{personalize && <div className="mt-3 grid grid-cols-2 gap-3"><label className="text-xs font-semibold">Nome<input maxLength={12} value={name} onChange={(event) => setName(event.target.value)} placeholder="Ex.: ALEX" className="mt-1 w-full rounded border px-3 py-2 text-sm uppercase" /></label><label className="text-xs font-semibold">Número<input inputMode="numeric" maxLength={2} value={number} onChange={(event) => setNumber(event.target.value.replace(/\D/g, ""))} placeholder="10" className="mt-1 w-full rounded border px-3 py-2 text-sm" /></label></div>}</div>
        <button disabled={!size || soldOut || (personalize && (!name.trim() || !number.trim()))} onClick={buy} className="mt-5 hidden w-full items-center justify-center gap-2 rounded bg-lime py-4 text-sm font-black uppercase tracking-wide hover:bg-[#b6e351] disabled:bg-gray-200 disabled:text-gray-500 sm:flex">{added ? <><Check size={18} /> Adicionado ao carrinho!</> : soldOut ? "Esgotado" : "Comprar agora"}</button>
        <div className="mt-6 rounded-lg bg-paper p-4"><form onSubmit={calculateShipping} className="flex gap-2"><label htmlFor="product-cep" className="sr-only">Calcular frete pelo CEP</label><input id="product-cep" inputMode="numeric" maxLength={9} value={cep} onChange={(event) => setCep(event.target.value.replace(/[^\d-]/g, ""))} placeholder="Digite seu CEP" className="min-w-0 flex-1 rounded border bg-white px-3 py-2.5 text-sm" /><button className="rounded bg-pitch px-4 text-xs font-black text-white">CALCULAR</button></form>{cepError && <p role="alert" className="mt-2 text-xs text-red-600">{cepError}</p>}{shipping && <p className="mt-2 text-xs leading-5">{shipping}</p>}<Link href="https://viacep.com.br/" target="_blank" className="mt-2 inline-block text-[10px] text-muted underline">Não sei meu CEP</Link></div>
        <div className="mt-5 grid gap-3 text-xs text-muted"><p className="flex items-center gap-2"><Truck size={17} />Frete grátis acima de {formatCurrency(storeConfig.freeShippingMinimum)}</p><p className="flex items-center gap-2"><ShieldCheck size={17} />Compra protegida e troca em até 7 dias</p><p className="flex items-center gap-2"><Heart size={17} />Produzida para torcer com conforto</p></div>
        <details className="mt-6 border-t py-4"><summary className="cursor-pointer text-sm font-black">Descrição e informações</summary><p className="mt-3 text-sm leading-6 text-muted">Vista as cores de {product.clube}. Modelo {product.tipo === "jogador" ? "jogador, com tecido leve e caimento mais ajustado" : "torcedor, com caimento confortável para o dia a dia"}. Temporada {product.temporada}, uniforme {product.uniforme}.</p></details>
        <details className="border-t py-4"><summary className="cursor-pointer text-sm font-black">Torcedor ou jogador: qual escolher?</summary><p className="mt-3 text-sm leading-6 text-muted">A versão torcedor prioriza conforto e versatilidade. A versão jogador tem tecido mais leve e modelagem ajustada ao corpo.</p></details>
      </div>
    </div>
    <section className="mt-14"><h2 className="mb-5 text-2xl font-black">Quem torce por {product.clube} também curte</h2><ProductGrid items={related} /></section>
    <section className="mt-14 rounded-xl bg-paper p-6"><h2 className="text-xl font-black">Quem já vestiu, recomenda</h2><div className="mt-5 grid gap-5 sm:grid-cols-3">{["Caimento muito confortável e cores lindas!", "Chegou antes do prazo. Já vou usar no próximo jogo.", "O tecido é leve e o tamanho ficou certinho."].map((review, index) => <blockquote key={review} className="rounded bg-white p-4"><span className="text-amber-500">★★★★★</span><p className="mt-2 text-sm">{review}</p><cite className="mt-2 block text-xs not-italic text-muted">Torcedor(a) verificado(a) · {["Marina", "Rafael", "Lucas"][index]}</cite></blockquote>)}</div></section>
    {sizeGuideOpen && <div className="fixed inset-0 z-[80] grid place-items-center bg-black/60 p-4" onClick={() => setSizeGuideOpen(false)}><section role="dialog" aria-modal="true" aria-labelledby="size-guide-title" className="max-h-[90dvh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white p-5 shadow-xl sm:p-7" onClick={(event) => event.stopPropagation()}><div className="flex items-start justify-between gap-3"><div><h2 id="size-guide-title" className="text-xl font-black">Guia rápido de medidas</h2><p className="mt-1 text-xs text-muted">Medidas aproximadas do corpo em centímetros.</p></div><button type="button" onClick={() => setSizeGuideOpen(false)} aria-label="Fechar guia de medidas" className="rounded-lg border border-border px-3 py-2 text-sm font-bold">Fechar</button></div><div className="mt-5 overflow-x-auto"><table className="w-full min-w-[440px] text-left text-xs"><thead className="bg-paper"><tr>{["Tamanho", "Peito", "Cintura", "Quadril"].map((item) => <th key={item} className="px-3 py-3">{item} (cm)</th>)}</tr></thead><tbody>{[["P", "88–96", "72–80", "88–96"], ["M", "96–104", "80–88", "96–104"], ["G", "104–112", "88–96", "104–112"], ["GG", "112–120", "96–104", "112–120"], ["2GG", "120–128", "104–112", "120–128"], ["3GG", "128–136", "112–120", "128–136"]].map((row) => <tr key={row[0]} className="border-t border-border">{row.map((value) => <td key={value} className="px-3 py-3">{value}</td>)}</tr>)}</tbody></table></div><Link href="/guia-de-medidas" onClick={() => setSizeGuideOpen(false)} className="mt-4 inline-block text-xs font-bold text-blue-700 underline">Ver guia completo (masculino, feminino e infantil)</Link></section></div>}
    <button disabled={!size || soldOut || (personalize && (!name.trim() || !number.trim()))} onClick={buy} className="fixed bottom-0 left-0 right-0 z-30 flex items-center justify-center gap-2 bg-lime py-4 text-sm font-black uppercase shadow-lg disabled:bg-gray-300 sm:hidden">{added ? "Adicionado ao carrinho!" : `Comprar · ${formatCurrency(price)}`}</button>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({ "@context": "https://schema.org", "@type": "Product", name: product.nome, image: [productImage(product.imageSeed)], description: `Camisa ${product.clube}, temporada ${product.temporada}.`, offers: { "@type": "Offer", priceCurrency: "BRL", price: product.preco, availability: product.estoque > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock" } }).replace(/</g, "\\u003c") }} />
  </main>;
}
