"use client";

import Link from "next/link";
import { useState, useMemo, useEffect } from "react";
import { ArrowDown, Check, ChevronLeft, ChevronRight, Heart, MessageCircle, Ruler, ShoppingBag, Truck, X, ZoomIn } from "lucide-react";
import { ProductGrid } from "@/components/product-grid";
import { SafeProductImage } from "@/components/safe-product-image";
import { formatCurrency, productImageAsset } from "@/lib/catalog";
import { catalogLabel } from "@/lib/catalog-taxonomy";
import type { Product, ProductImage } from "@/lib/types";
import { storeConfig } from "@/config";
import { useCart } from "@/store/cart";
import { classifyProduct, getProductUnitPrice } from "@/lib/product-classification";
import { getAvailablePatches } from "@/lib/patch-compatibility";
import type { PatchPosition } from "@/data/patches";
import { getProductOfferText } from "@/lib/commerce";
import { allowsCustomization } from "@/lib/formula-one";
import { detectUniformVariants, cleanAndDeduplicateImages } from "@/lib/uniform-variants";
import { CUSTOMIZATION_NAME_MAX_LENGTH, filterCustomizationNumber, formatCustomization, getCustomizationError, sanitizeCustomizationName } from "@/lib/customization";
import { whatsappLink } from "@/lib/whatsapp";
import { siteCompanyConfig } from "@/lib/site-config";

export function ProductDetails({ product, relatedProducts = [] }: { product: Product; relatedProducts?: Product[] }) {
  const [size, setSize] = useState("");
  const [uniformVariation, setUniformVariation] = useState<"Casa" | "Fora" | "">("");
  const [personalize, setPersonalize] = useState(false);
  const [name, setName] = useState("");
  const [number, setNumber] = useState("");
  const [selectedPatches, setSelectedPatches] = useState<{ id: string; position: PatchPosition }[]>([]);
  const [added, setAdded] = useState(false);
  const [activeImage, setActiveImage] = useState(0);
  const [sizeGuideOpen, setSizeGuideOpen] = useState(false);
  const [zoomOpen, setZoomOpen] = useState(false);
  const [validationAttempted, setValidationAttempted] = useState(false);
  const addItem = useCart((state) => state.addItem);

  // Detecção inteligente de múltiplos uniformes misturados (ex: Home/Away, Third/Away)
  const variants = useMemo(() => detectUniformVariants(product), [product]);
  const [selectedVariantId, setSelectedVariantId] = useState<string>(variants?.[0]?.id ?? "all");

  const related = relatedProducts.filter((item) => item.id !== product.id && ((product.clubeSlug !== "revisar" && item.clubeSlug === product.clubeSlug) || (product.liga !== "revisar" && item.liga === product.liga))).slice(0, 4);

  // Rolagem suave até a seção de compra caso haja âncora na URL
  useEffect(() => {
    if (typeof window !== "undefined" && window.location.hash === "#secao-compra") {
      setTimeout(scrollToPurchase, 150);
    }
  }, []);

  function scrollToPurchase() {
    const el = document.getElementById("secao-compra");
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  // Galeria filtrada pela variante de uniforme selecionada ou galeria completa deduplicada
  const gallery = useMemo(() => {
    let imagesSource: ProductImage[] = product.images?.length
      ? product.images
      : [
          { ...productImageAsset(product), source: product.slug },
          { ...productImageAsset(product, true), source: product.slug },
        ];

    if (variants && selectedVariantId !== "all") {
      const activeVar = variants.find((v) => v.id === selectedVariantId);
      if (activeVar) {
        imagesSource = activeVar.images;
      }
    }

    return cleanAndDeduplicateImages(imagesSource, product.nome).map((image, index) => ({
      ...image,
      alt: `${product.nome} – ${index === 0 ? "frente" : `detalhe ${index + 1}`}`,
    }));
  }, [product, variants, selectedVariantId]);

  const selectedImage = gallery[Math.min(activeImage, Math.max(0, gallery.length - 1))] || {
    ...productImageAsset(product),
    source: product.slug,
  };
  const classification = classifyProduct(product);
  const canPersonalize = allowsCustomization(product);
  const availableSizes = product.tamanhos.filter((itemSize) => itemSize !== "3GG");
  const unitPrice = getProductUnitPrice(product, size) ?? 0;
  const cleanName = sanitizeCustomizationName(name);
  const customization = formatCustomization({ name: cleanName, number });
  const hasCustomization = personalize && Boolean(customization);
  const personalizationError = getCustomizationError(personalize, { name: cleanName, number });
  const price = unitPrice + (hasCustomization ? storeConfig.customizationPrice : 0);
  const compatiblePatches = getAvailablePatches(product);
  const selectedPatchTotal = compatiblePatches.filter((patch) => selectedPatches.some((selected) => selected.id === patch.id)).reduce((sum, patch) => sum + patch.priceCents, 0) / 100;
  const audienceLabels = { masculino: "masculino", feminino: "feminino", unissex: "unissex", infantil: "infantil", revisar: "" };
  const uniformLabels = { titular: "casa (Home)", reserva: "fora (Away)", terceiro: "terceira camisa (Third)", quarto: "quarta camisa (Fourth)", revisar: "" };
  const verifiedMetadata = [
    audienceLabels[product.publico] ? `Público: ${audienceLabels[product.publico]}` : "",
    classification.version !== "unknown" ? `Versão: ${classification.version}` : "",
    classification.sleeve !== "unknown" ? `Manga: ${classification.sleeve === "long" ? "longa" : "curta"}` : "",
    product.temporada !== "revisar" ? `Temporada: ${product.temporada}` : "",
    uniformLabels[classification.uniform] ? `Uniforme: ${uniformLabels[classification.uniform]}` : "",
    product.cor !== "revisar" ? `Cor: ${product.cor}` : "",
  ].filter(Boolean);
  const productContext = [
    product.clube !== "revisar" ? product.clube : "",
    product.temporada !== "revisar" ? `Temporada ${product.temporada}` : "",
  ].filter(Boolean).join(" · ");

  function handleVariantChange(variantId: string) {
    setSelectedVariantId(variantId);
    setActiveImage(0);
  }

  const hasUniformVariation = Boolean(product.tem_variacao_uniforme);
  const missingUniform = hasUniformVariation && !uniformVariation;

  function buy() {
    if (!size || !availableSizes.includes(size) || missingUniform || classification.reviewRequired || classification.price === null || personalizationError) return;

    const activeVar = variants?.find((v) => v.id === selectedVariantId);
    const productToAdd: Product = activeVar && activeVar.id !== "all"
      ? {
          ...product,
          nome: `${product.nome} (${activeVar.name})`,
          images: activeVar.images,
        }
      : product;

    addItem(
      productToAdd,
      size,
      hasCustomization ? { name: cleanName, number } : undefined,
      selectedPatches,
      uniformVariation ? uniformVariation : undefined
    );
    setAdded(true);
    window.setTimeout(() => setAdded(false), 1800);
  }

  function handleBuyClick() {
    if (!size || missingUniform) {
      setValidationAttempted(true);
      scrollToPurchase();
      return;
    }
    if (!availableSizes.includes(size) || classification.reviewRequired || classification.price === null || Boolean(personalizationError)) {
      setValidationAttempted(true);
      return;
    }
    buy();
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-7 pb-24 lg:px-8 lg:pb-12">
      <nav className="mb-6 text-xs text-muted">
        <Link href="/">Início</Link>
        {product.liga !== "revisar" && <> / <Link href={`/ligas/${product.liga}`}>{catalogLabel(product.liga)}</Link></>}
        {product.clube !== "revisar" && <> / {product.clube}</>}
      </nav>

      <div className="grid gap-8 lg:grid-cols-2 lg:gap-12">
        {/* COLUNA ESQUERDA: GALERIA E IMAGENS */}
        <div>
          <div className="grid grid-cols-[58px_1fr] gap-3 sm:grid-cols-[76px_1fr]">
            <div className="flex flex-col gap-3">
              {gallery.map((image, index) => (
                <button
                  key={`${image.src}-${index}`}
                  type="button"
                  aria-label={`Ver foto ${index + 1} de ${gallery.length}`}
                  aria-pressed={activeImage === index}
                  onClick={() => setActiveImage(index)}
                  className={`relative aspect-[4/5] overflow-hidden rounded border transition-all ${
                    activeImage === index ? "border-pitch ring-1 ring-pitch" : "border-transparent hover:border-zinc-300"
                  }`}
                >
                  <SafeProductImage
                    src={image.src}
                    alt={image.alt}
                    fill
                    sizes="76px"
                    placeholder={image.blurDataURL ? "blur" : "empty"}
                    blurDataURL={image.blurDataURL || undefined}
                    className="object-cover"
                    style={{ objectPosition: `${image.focalPoint.x}% ${image.focalPoint.y}%` }}
                  />
                </button>
              ))}
            </div>

            <div className="relative aspect-[4/5] overflow-hidden rounded-xl bg-paper">
              <button
                type="button"
                onClick={() => setZoomOpen(true)}
                aria-label="Ampliar imagem do produto em tela cheia"
                className="group relative block h-full w-full cursor-zoom-in"
              >
                <SafeProductImage
                  src={selectedImage.src}
                  alt={selectedImage.alt}
                  fill
                  priority
                  sizes="(max-width: 1024px) 80vw, 50vw"
                  placeholder={selectedImage.blurDataURL ? "blur" : "empty"}
                  blurDataURL={selectedImage.blurDataURL || undefined}
                  className="object-cover transition-transform duration-300 group-hover:scale-105"
                  style={{ objectPosition: `${selectedImage.focalPoint.x}% ${selectedImage.focalPoint.y}%` }}
                />
                {selectedPatches.map((selected) => {
                  const patch = compatiblePatches.find((item) => item.id === selected.id);
                  if (!patch?.image) return null;
                  const positionClass = selected.position === "manga-esquerda"
                    ? "left-[12%] top-[62%]"
                    : selected.position === "manga-direita"
                      ? "right-[12%] top-[62%]"
                      : "left-[28%] top-[30%]";
                  return (
                    <SafeProductImage
                      key={patch.id}
                      src={patch.image}
                      alt={`Prévia ilustrativa: ${patch.name}`}
                      width={44}
                      height={44}
                      className={`pointer-events-none absolute z-10 h-10 w-10 object-contain drop-shadow ${positionClass}`}
                    />
                  );
                })}
                <span className="absolute bottom-3 right-3 flex max-w-[calc(100%-1.5rem)] truncate items-center gap-1.5 rounded-full bg-white/95 px-3 py-1.5 text-[11px] font-bold text-ink shadow-md transition group-hover:bg-white">
                  <ZoomIn size={14} className="shrink-0" /> <span className="truncate">Toque para ampliar · {activeImage + 1}/{gallery.length}</span>
                </span>
              </button>

              {gallery.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveImage((activeImage - 1 + gallery.length) % gallery.length);
                    }}
                    aria-label="Foto anterior"
                    className="absolute left-2.5 top-1/2 -translate-y-1/2 grid h-9 w-9 place-items-center rounded-full bg-white/85 text-ink shadow backdrop-blur transition hover:bg-white"
                  >
                    <ChevronLeft size={18} />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveImage((activeImage + 1) % gallery.length);
                    }}
                    aria-label="Próxima foto"
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 grid h-9 w-9 place-items-center rounded-full bg-white/85 text-ink shadow backdrop-blur transition hover:bg-white"
                  >
                    <ChevronRight size={18} />
                  </button>
                </>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={scrollToPurchase}
            className="mt-3.5 flex w-full items-center justify-center gap-2 rounded-xl border border-zinc-200 bg-paper py-3 text-xs font-bold text-ink transition hover:bg-zinc-200 lg:hidden"
          >
            <ArrowDown size={14} className="text-blue-600" />
            <span>Ir direto para opções de tamanho e compra ↓</span>
          </button>
        </div>

        {/* COLUNA DIREITA: INFORMAÇÕES, SELEÇÃO E COMPRA (ORDEM 1 -> 2 -> 3 -> 4) */}
        <div className="flex flex-col min-w-0">
          {/* 1. INFORMAÇÕES DO PRODUTO */}
          <div>
            {productContext && <p className="text-[10px] font-bold uppercase tracking-wider text-blue-600">{productContext}</p>}
            <h1 className="mt-2 text-2xl font-bold leading-tight tracking-normal sm:text-3xl text-zinc-900">{product.nome}</h1>
            {product.description && <p className="mt-3 whitespace-pre-line text-sm leading-6 text-muted">{product.description}</p>}
            <div className="mt-4 flex items-baseline gap-3">
              <span className="text-3xl font-bold tracking-tight text-zinc-900">
                {classification.reviewRequired ? classification.priceLabel : formatCurrency(price + selectedPatchTotal)}
              </span>
            </div>
            {classification.reviewRequired && (
              <p role="status" className="mt-2 rounded bg-amber-50 p-3 text-sm text-amber-950">
                A versão e o preço deste produto precisam de confirmação antes da venda.
              </p>
            )}
            <p className="mt-3 rounded-lg bg-paper p-3 text-xs leading-5 text-muted">
              {getProductOfferText(product)}
            </p>
            <div className="mt-3 flex flex-wrap gap-4 text-xs text-muted">
              <p className="flex items-center gap-1.5"><Truck size={15} />Frete grátis no pacote de {storeConfig.freeShippingQuantity} camisas</p>
              {canPersonalize && <p className="flex items-center gap-1.5"><Heart size={15} />Personalização opcional por {formatCurrency(storeConfig.customizationPrice)}</p>}
            </div>

            {verifiedMetadata.length > 0 && (
              <details className="mt-5 border-t border-border pt-3">
                <summary className="cursor-pointer text-xs font-bold uppercase tracking-wider text-zinc-700">
                  Especificações e detalhes do produto
                </summary>
                <ul className="mt-2.5 space-y-1 text-xs leading-5 text-muted">
                  {verifiedMetadata.map((item) => <li key={item}>{item}</li>)}
                </ul>
              </details>
            )}
          </div>

          {/* 2. SELEÇÃO DE TAMANHO E DEMAIS OPÇÕES */}
          <section id="secao-compra" className="mt-7 scroll-mt-24 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-6">
            {/* Seletor Inteligente de Uniforme / Versão */}
            {variants && variants.length > 1 && (
              <div className="mb-6 rounded-xl border border-zinc-200 bg-zinc-50/70 p-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-900">
                    Modelo / Uniforme
                  </h2>
                  <span className="text-[11px] font-bold text-blue-700">
                    {variants.find((v) => v.id === selectedVariantId)?.name || "Galeria completa"}
                  </span>
                </div>

                <div className="mt-3 flex flex-wrap gap-2.5">
                  {variants.map((v) => {
                    const isSelected = selectedVariantId === v.id;
                    const previewImg = v.images[0]?.src;
                    return (
                      <button
                        key={v.id}
                        type="button"
                        onClick={() => handleVariantChange(v.id)}
                        aria-pressed={isSelected}
                        className={`flex items-center gap-3 rounded-lg border p-2.5 text-xs font-bold transition-all ${
                          isSelected
                            ? "border-pitch bg-pitch text-white shadow-sm ring-1 ring-pitch"
                            : "border-zinc-200 bg-white text-zinc-900 hover:border-zinc-400"
                        }`}
                      >
                        {previewImg && (
                          <div className="relative h-10 w-9 shrink-0 overflow-hidden rounded bg-paper">
                            <SafeProductImage
                              src={previewImg}
                              alt={v.name}
                              fill
                              sizes="36px"
                              className="object-cover"
                            />
                          </div>
                        )}
                        <div className="text-left">
                          <span className="block">{v.name}</span>
                          <span className={`block text-[10px] ${isSelected ? "text-zinc-300" : "text-zinc-500"}`}>
                            {v.images.length} fotos
                          </span>
                        </div>
                      </button>
                    );
                  })}

                  <button
                    type="button"
                    onClick={() => handleVariantChange("all")}
                    aria-pressed={selectedVariantId === "all"}
                    className={`flex items-center rounded-lg border px-3 py-2 text-xs font-semibold transition-all ${
                      selectedVariantId === "all"
                        ? "border-pitch bg-pitch text-white"
                        : "border-dashed border-zinc-300 bg-white/70 text-zinc-600 hover:border-zinc-400"
                    }`}
                  >
                    Ver todas ({variants.reduce((acc, v) => acc + v.images.length, 0)} fotos)
                  </button>
                </div>
              </div>
            )}

            {/* Seleção de Tamanho */}
            <div>
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-zinc-900">
                  Selecione o Tamanho <span className="text-red-500">*</span>
                </h2>
                <button
                  type="button"
                  onClick={() => setSizeGuideOpen(true)}
                  className="flex items-center gap-1 text-xs font-bold text-blue-700 underline"
                >
                  <Ruler size={14} /> Guia de medidas
                </button>
              </div>

              <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Tamanhos disponíveis">
                {availableSizes.map((itemSize) => (
                  <button
                    key={itemSize}
                    type="button"
                    aria-pressed={size === itemSize}
                    onClick={() => {
                      setSize(itemSize);
                      setValidationAttempted(false);
                    }}
                    className={`grid h-12 min-w-14 place-items-center rounded-lg border px-3 text-xs font-bold transition-all ${
                      size === itemSize
                        ? "border-pitch bg-pitch text-white shadow-sm ring-1 ring-pitch"
                        : "border-zinc-300 bg-white text-zinc-900 hover:border-pitch"
                    }`}
                  >
                    {itemSize}
                  </button>
                ))}
              </div>

              {validationAttempted && !size && (
                <p role="alert" className="mt-2.5 text-xs font-bold text-red-600 animate-pulse">
                  ⚠️ Por favor, selecione um tamanho antes de continuar.
                </p>
              )}
              {availableSizes.includes("2GG") && (
                <p className="mt-2 text-[11px] font-semibold text-muted">
                  Tamanho 2GG: +{formatCurrency(storeConfig.size2GGPrice)}
                </p>
              )}
              {!size && !validationAttempted && product.tamanhos.length > 0 && (
                <p className="mt-2 text-[11px] text-muted">Selecione um dos tamanhos acima para avançar.</p>
              )}
            </div>

            {/* Opção de Uniforme: Casa / Fora */}
            {hasUniformVariation && (
              <div className="mt-6 rounded-xl border border-zinc-200 bg-zinc-50/60 p-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-bold text-zinc-900">
                    Uniforme <span className="text-red-500">*</span>
                  </h2>
                  {uniformVariation && (
                    <span className="text-xs font-bold text-blue-700">
                      Selecionado: {uniformVariation}
                    </span>
                  )}
                </div>

                <div className="mt-3 grid grid-cols-2 gap-3" role="radiogroup" aria-label="Escolha o uniforme">
                  {(["Casa", "Fora"] as const).map((option) => {
                    const isSelected = uniformVariation === option;
                    return (
                      <label
                        key={option}
                        className={`flex min-h-12 cursor-pointer items-center justify-center gap-2.5 rounded-lg border p-3 text-sm font-bold transition-all select-none ${
                          isSelected
                            ? "border-pitch bg-pitch text-white shadow-sm ring-1 ring-pitch"
                            : "border-zinc-300 bg-white text-zinc-900 hover:border-pitch hover:bg-zinc-50"
                        }`}
                      >
                        <input
                          type="radio"
                          name="uniform-variation"
                          value={option}
                          checked={isSelected}
                          onChange={() => {
                            setUniformVariation(option);
                          }}
                          className="h-4 w-4 border-zinc-300 text-pitch focus:ring-pitch"
                        />
                        <span>{option}</span>
                      </label>
                    );
                  })}
                </div>

                {validationAttempted && !uniformVariation && (
                  <p role="alert" className="mt-2.5 text-xs font-bold text-red-600 animate-pulse">
                    ⚠️ Por favor, selecione o uniforme (Casa ou Fora) antes de continuar.
                  </p>
                )}
                {!uniformVariation && !validationAttempted && (
                  <p className="mt-2 text-[11px] text-muted">
                    Selecione entre o uniforme Casa ou Fora para avançar.
                  </p>
                )}
              </div>
            )}

            {/* 3. INFORMAÇÕES E CAMPOS DE PERSONALIZAÇÃO */}
            {canPersonalize && (
              <div className="mt-6 rounded-xl border border-zinc-200 bg-zinc-50/60 p-4">
                <label className="flex min-h-[44px] cursor-pointer items-center gap-2.5 text-sm font-bold text-zinc-900 select-none">
                  <input
                    type="checkbox"
                    checked={personalize}
                    onChange={(event) => {
                      setPersonalize(event.target.checked);
                      if (!event.target.checked) {
                        setName("");
                        setNumber("");
                      }
                    }}
                    className="h-5 w-5 rounded border-zinc-300 text-pitch focus:ring-pitch shrink-0"
                  />
                  <span>Quero personalizar com nome e número (+{formatCurrency(storeConfig.customizationPrice)})</span>
                </label>

                {personalize && (
                  <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <label className="text-xs font-semibold text-zinc-700">
                      Nome na camisa (opcional)
                      <input
                        maxLength={CUSTOMIZATION_NAME_MAX_LENGTH}
                        value={name}
                        onChange={(event) => setName(sanitizeCustomizationName(event.target.value).slice(0, CUSTOMIZATION_NAME_MAX_LENGTH))}
                        placeholder="Ex.: ALEX"
                        className="mt-1.5 w-full min-h-[44px] rounded-lg border border-zinc-300 bg-white px-3.5 py-2.5 text-base sm:text-sm uppercase shadow-sm focus:border-pitch focus:outline-none"
                      />
                    </label>
                    <label className="text-xs font-semibold text-zinc-700">
                      Número (opcional)
                      <input
                        inputMode="numeric"
                        maxLength={3}
                        value={number}
                        onChange={(event) => setNumber(filterCustomizationNumber(event.target.value))}
                        placeholder="10"
                        className="mt-1.5 w-full min-h-[44px] rounded-lg border border-zinc-300 bg-white px-3.5 py-2.5 text-base sm:text-sm shadow-sm focus:border-pitch focus:outline-none"
                      />
                    </label>
                    {personalizationError && (
                      <p role="status" className="col-span-1 sm:col-span-2 text-xs font-bold text-red-600">
                        {personalizationError}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            {canPersonalize && (
              <a
                href={whatsappLink(`Olá! Quero uma personalização especial na camisa ${product.nome}.`)}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 flex min-h-11 items-center gap-2 rounded-lg border border-[#25D366]/30 bg-[#25D366]/5 px-3.5 py-2.5 text-xs leading-5 text-ink transition hover:bg-[#25D366]/10"
              >
                <MessageCircle size={16} className="shrink-0 text-[#16853d]" />
                <span>Personalização especial ou frase? <span className="font-bold text-[#16853d] underline">Chame no WhatsApp!</span></span>
              </a>
            )}

            {compatiblePatches.length > 0 && (
              <section className="mt-6 rounded-xl border border-zinc-200 bg-zinc-50/60 p-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-900">Personalize com patches</h3>
                <p className="mt-1 text-[11px] text-muted">Opcional: adicione patches oficiais por +{formatCurrency(storeConfig.patchPrice)} cada.</p>
                <div className="mt-3 grid gap-2">
                  {compatiblePatches.map((patch) => {
                    const selected = selectedPatches.find((item) => item.id === patch.id);
                    const shortName = patch.shortName ?? patch.name.slice(0, 3).toUpperCase();
                    return (
                      <label key={patch.id} className="flex cursor-pointer items-center gap-3 rounded-lg border border-zinc-200 bg-white p-2.5 transition hover:border-zinc-400">
                        <input
                          type="checkbox"
                          checked={Boolean(selected)}
                          onChange={(event) => setSelectedPatches((items) =>
                            event.target.checked
                              ? [...items, { id: patch.id, position: patch.positions[0] }]
                              : items.filter((item) => item.id !== patch.id)
                          )}
                          className="h-4 w-4 rounded border-zinc-300 text-pitch"
                        />
                        <span aria-hidden="true" className="grid h-8 w-10 place-items-center rounded bg-paper text-[10px] font-bold">
                          {shortName}
                        </span>
                        <span className="text-xs font-bold text-zinc-900">
                          {patch.name}
                          <span className="ml-1.5 font-normal text-muted">+ {formatCurrency(patch.priceCents / 100)}</span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              </section>
            )}

            {selectedPatches.length > 0 && (
              <p className="mt-3 rounded-lg bg-paper p-3 text-xs text-zinc-700">
                Resumo: {selectedPatches.length} patch(es) · Adicional de {formatCurrency(selectedPatchTotal)} na camisa.
              </p>
            )}

            {/* 4. BOTÃO ADICIONAR À SACOLA (ABAIXO DE TODAS AS OPÇÕES E INFORMAÇÕES) */}
            <div className="mt-6 border-t border-border pt-5">
              {validationAttempted && !size && (
                <p role="alert" className="mb-3 rounded-lg bg-red-50 p-3 text-xs font-bold text-red-700">
                  ⚠️ Por favor, selecione um tamanho acima para adicionar à sacola.
                </p>
              )}
              {validationAttempted && size && missingUniform && (
                <p role="alert" className="mb-3 rounded-lg bg-red-50 p-3 text-xs font-bold text-red-700">
                  ⚠️ Por favor, selecione o uniforme (Casa ou Fora) acima para adicionar à sacola.
                </p>
              )}
              {validationAttempted && personalizationError && (
                <p role="alert" className="mb-3 rounded-lg bg-red-50 p-3 text-xs font-bold text-red-700">
                  {personalizationError}
                </p>
              )}
              <button
                type="button"
                disabled={classification.reviewRequired || classification.price === null}
                onClick={handleBuyClick}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-action py-4 text-sm font-bold uppercase tracking-wider text-black shadow-sm transition hover:bg-action-hover disabled:bg-gray-200 disabled:text-gray-500"
              >
                {classification.reviewRequired ? (
                  "Preço em revisão"
                ) : added ? (
                  <><Check size={18} /> Adicionado à sacola!</>
                ) : !size ? (
                  <><ShoppingBag size={18} /> Selecionar tamanho e comprar</>
                ) : missingUniform ? (
                  <><ShoppingBag size={18} /> Selecionar uniforme (Casa ou Fora)</>
                ) : (
                  <><ShoppingBag size={18} /> Adicionar à sacola · {formatCurrency(price + selectedPatchTotal)}</>
                )}
              </button>
              {siteCompanyConfig.prazoEstimadoEntrega && (
                <div className="mt-3.5 flex items-center justify-center gap-2 rounded-xl border border-border bg-paper/80 p-3 text-xs text-muted">
                  <Truck size={15} className="shrink-0 text-blue-600" />
                  <span>
                    Prazo estimado de entrega: <strong className="text-ink">{siteCompanyConfig.prazoEstimadoEntrega}</strong>.{" "}
                    <Link href="/envios-e-prazos" className="font-semibold text-blue-700 underline hover:text-blue-800">
                      Envios e prazos
                    </Link>
                  </span>
                </div>
              )}
            </div>
          </section>
        </div>
      </div>

      {related.length > 0 && (
        <section className="mt-16">
          <h2 className="mb-5 text-2xl font-bold tracking-tight">
            {product.clube !== "revisar" ? `Mais camisas de ${product.clube}` : "Mais produtos desta categoria"}
          </h2>
          <ProductGrid items={related} />
        </section>
      )}

      {/* GUIA DE MEDIDAS MODAL */}
      {sizeGuideOpen && (
        <div className="fixed inset-0 z-[80] grid place-items-center bg-black/60 p-4" onClick={() => setSizeGuideOpen(false)}>
          <section role="dialog" aria-modal="true" aria-labelledby="size-guide-title" className="max-h-[90dvh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white p-5 shadow-xl sm:p-7" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 id="size-guide-title" className="text-xl font-bold tracking-tight">Guia de tamanhos</h2>
                <p className="mt-2 text-sm leading-6 text-muted">Consulte as medidas de referência para cada categoria. As medidas podem variar entre modelos.</p>
              </div>
              <button type="button" onClick={() => setSizeGuideOpen(false)} aria-label="Fechar guia de medidas" className="rounded-lg border border-border px-3 py-2 text-sm font-bold">Fechar</button>
            </div>
            <Link href="/guia-de-medidas" onClick={() => setSizeGuideOpen(false)} className="mt-4 inline-block text-xs font-bold text-blue-700 underline">Ver informações completas sobre tamanhos</Link>
          </section>
        </div>
      )}

      {/* MODAL DE AMPLIAÇÃO DA FOTO (LIGHTBOX) */}
      {zoomOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Visualização ampliada do produto"
          className="fixed inset-0 z-[90] flex items-center justify-center bg-black/90 p-4 backdrop-blur-sm"
          onClick={() => setZoomOpen(false)}
        >
          <div className="relative flex max-h-[92vh] max-w-4xl flex-col items-center overflow-hidden rounded-2xl bg-white p-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => setZoomOpen(false)}
              aria-label="Fechar ampliação"
              className="absolute right-3 top-3 z-20 grid h-10 w-10 place-items-center rounded-full bg-black/70 text-white transition hover:bg-black"
            >
              <X size={20} />
            </button>
            <div className="relative aspect-[4/5] h-[65vh] max-h-[750px] w-full overflow-hidden rounded-xl bg-paper">
              <SafeProductImage
                src={selectedImage.src}
                alt={selectedImage.alt}
                fill
                sizes="(max-width: 1024px) 90vw, 800px"
                className="object-contain"
              />
            </div>
            {gallery.length > 1 && (
              <div className="mt-4 flex w-full items-center justify-between px-2">
                <button
                  type="button"
                  onClick={() => setActiveImage((activeImage - 1 + gallery.length) % gallery.length)}
                  className="flex items-center gap-1.5 rounded-lg border border-border px-3.5 py-2 text-xs font-bold transition hover:bg-paper"
                >
                  <ChevronLeft size={16} /> Foto anterior
                </button>
                <span className="text-xs font-bold text-muted">
                  {activeImage + 1} de {gallery.length}
                </span>
                <button
                  type="button"
                  onClick={() => setActiveImage((activeImage + 1) % gallery.length)}
                  className="flex items-center gap-1.5 rounded-lg border border-border px-3.5 py-2 text-xs font-bold transition hover:bg-paper"
                >
                  Próxima foto <ChevronRight size={16} />
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* BARRA FIXA MOBILE NO RODAPÉ */}
      <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-border bg-white/95 p-3 pb-[calc(env(safe-area-inset-bottom,0px)+0.75rem)] backdrop-blur shadow-lg sm:hidden">
        <button
          type="button"
          disabled={classification.reviewRequired || classification.price === null}
          onClick={handleBuyClick}
          className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-action py-3.5 text-xs font-bold uppercase tracking-wider text-black shadow-sm transition hover:bg-action-hover disabled:bg-gray-200 disabled:text-gray-500"
        >
          {added ? (
            <><Check size={18} /> Adicionado à sacola!</>
          ) : classification.reviewRequired ? (
            "Preço em revisão"
          ) : !size ? (
            <><ShoppingBag size={16} /> Selecionar tamanho e comprar</>
          ) : missingUniform ? (
            <><ShoppingBag size={16} /> Selecionar uniforme (Casa ou Fora)</>
          ) : (
            <><ShoppingBag size={16} /> Adicionar à sacola · {formatCurrency(price + selectedPatchTotal)}</>
          )}
        </button>
      </div>
    </main>
  );
}
