"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { AdminNavigation } from "@/components/admin-navigation";
import { AdminSkeleton, EmptyState, ErrorState, StatCard, StatusBadge } from "@/components/admin-states";
import { PackageOpen } from "lucide-react";
import type { Audience, ProductType, Uniform } from "@/lib/types";
import { adminFetch } from "@/lib/client/admin-fetch";
import { SITE_NAME } from "@/lib/site";
import { storeConfig } from "@/config";

type ProductPhoto = { src: string; alt?: string };
type ManualProduct = {
  id: string;
  yupoo_id: string;
  slug: string;
  clube: string;
  liga: string;
  publico: Audience;
  tipo: ProductType;
  temporada: string;
  uniforme: Uniform;
  nome: string;
  preco: number;
  tamanhos: string[];
  cor: string;
  images: ProductPhoto[];
  description: string;
  stock_by_size: Record<string, number>;
  brand: string;
  supplier_name: string;
  supplier_cost: number;
};

type ProductDraft = {
  id?: string;
  slug: string;
  nome: string;
  description: string;
  brand: string;
  supplier_name: string;
  supplier_cost: number;
  preco: number;
  publico: "masculino" | "feminino" | "unissex" | "infantil";
  tipo: Exclude<ProductType, "revisar" | "formula1">;
  liga: string;
  clube: string;
  temporada: string;
  uniforme: Exclude<Uniform, "revisar">;
  cor: string;
  tamanhos: string[];
  stock_by_size: Record<string, number>;
  imageUrls: string[];
};

const emptyDraft: ProductDraft = {
  slug: "",
  nome: "",
  description: "",
  brand: "",
  supplier_name: "",
  supplier_cost: 0,
  preco: 0,
  publico: "masculino",
  tipo: "torcedor",
  liga: "",
  clube: "",
  temporada: "2026",
  uniforme: "titular",
  cor: "",
  tamanhos: ["P", "M", "G", "GG"],
  stock_by_size: { P: 0, M: 0, G: 0, GG: 0 },
  imageUrls: [],
};

const KNOWN_COMPETITIONS = [
  { slug: "nba", label: "NBA (Basquete)" },
  { slug: "brasileirao-serie-a", label: "Brasileirão Série A" },
  { slug: "premier-league", label: "Premier League" },
  { slug: "la-liga", label: "La Liga" },
  { slug: "champions-league", label: "Champions League" },
  { slug: "serie-a", label: "Serie A Italiana" },
  { slug: "bundesliga", label: "Bundesliga" },
  { slug: "ligue-1", label: "Ligue 1" },
  { slug: "selecoes", label: "Seleções Nacionais" },
  { slug: "libertadores", label: "Libertadores" },
  { slug: "f1", label: "Fórmula 1" },
  { slug: "revisar", label: "Revisar (pendente de definição)" },
];

const NBA_TEAM_KEYWORDS = [
  "warriors", "golden state", "lakers", "los angeles lakers", "celtics", "boston",
  "bulls", "chicago", "heat", "miami", "nets", "brooklyn", "knicks", "new york",
  "bucks", "milwaukee", "mavericks", "dallas", "suns", "phoenix", "clippers",
  "nuggets", "denver", "76ers", "sixers", "philadelphia", "spurs", "san antonio",
  "raptors", "toronto", "rockets", "houston", "cavaliers", "cleveland",
  "grizzlies", "memphis", "hawks", "atlanta", "pacers", "indiana", "magic", "orlando",
  "pelicans", "new orleans", "timberwolves", "minnesota", "thunder", "oklahoma",
  "trail blazers", "portland", "jazz", "utah", "kings", "sacramento", "wizards", "washington",
  "pistons", "detroit", "hornets", "charlotte", "nba",
];

function isNbaTeamEvidence(text: string): boolean {
  if (!text) return false;
  const norm = text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  return NBA_TEAM_KEYWORDS.some((kw) => norm.includes(kw));
}

const audienceLabels = {
  masculino: "Masculino",
  feminino: "Feminino",
  unissex: "Unissex",
  infantil: "Infantil",
};
const productTypeLabels: Record<ProductDraft["tipo"], string> = {
  torcedor: "Torcedor",
  jogador: "Jogador",
  goleiro: "Goleiro",
  retro: "Retrô",
  treino: "Treino",
  cropped: "Cropped",
  regata: "Regata",
  inverno: "Inverno",
  vestido: "Vestido",
  f1: "Fórmula 1",
};
const uniformLabels = {
  titular: "Casa / titular",
  reserva: "Fora / reserva",
  terceiro: "Terceiro uniforme",
  quarto: "Quarto uniforme",
};
const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

function slugify(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function Field({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return <label className={`grid gap-1.5 text-xs font-bold ${className}`}>{label}{children}</label>;
}

export default function AdminProducts() {
  const [products, setProducts] = useState<ManualProduct[]>([]);
  const [draft, setDraft] = useState<ProductDraft>(emptyDraft);
  const [existingPhotos, setExistingPhotos] = useState<ProductPhoto[]>([]);
  const [sizeInput, setSizeInput] = useState("P, M, G, GG");
  const [slugTouched, setSlugTouched] = useState(false);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [loadError, setLoadError] = useState("");

  async function loadProducts() {
    setLoading(true);
    setMessage("");
    setLoadError("");
    try {
      const response = await adminFetch("/api/admin/products", {
        cache: "no-store",
      });
      const body = await response.json();
      if (response.status === 401) {
        setLoadError("Sua sessão expirou. Entre novamente.");
        return;
      }
      if (!response.ok) throw new Error(body.error ?? "Não foi possível carregar os produtos.");
      setProducts(body.products as ManualProduct[]);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Não foi possível carregar os produtos.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadProducts(); }, []);

  function editProduct(product: ManualProduct) {
    const sizes = product.tamanhos.filter((size) => size !== "3GG");
    setDraft({
      id: product.id,
      slug: product.slug,
      nome: product.nome,
      description: product.description ?? "",
      brand: product.brand ?? "",
      supplier_name: product.supplier_name ?? "",
      supplier_cost: Number(product.supplier_cost ?? 0),
      preco: Number(product.preco),
      publico: product.publico === "revisar" ? "masculino" : product.publico,
      tipo: product.tipo === "formula1" ? "f1" : product.tipo === "revisar" ? "torcedor" : product.tipo,
      liga: product.liga,
      clube: product.clube,
      temporada: product.temporada,
      uniforme: product.uniforme === "revisar" ? "titular" : product.uniforme,
      cor: product.cor,
      tamanhos: sizes,
      stock_by_size: Object.fromEntries(sizes.map((size) => [size, product.stock_by_size?.[size] ?? 0])),
      imageUrls: [],
    });
    setSizeInput(sizes.join(", "));
    setExistingPhotos(product.images ?? []);
    setSlugTouched(true);
    setMessage(`Editando ${product.nome}.`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function resetForm() {
    setDraft(emptyDraft);
    setSizeInput("P, M, G, GG");
    setExistingPhotos([]);
    setSlugTouched(false);
  }

  function setField<Key extends keyof ProductDraft>(key: Key, value: ProductDraft[Key]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  const competitionOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const comp of KNOWN_COMPETITIONS) {
      map.set(comp.slug, comp.label);
    }
    for (const p of products) {
      if (p.liga && !map.has(p.liga)) {
        map.set(p.liga, p.liga);
      }
    }
    return Array.from(map.entries()).map(([slug, label]) => ({ slug, label }));
  }, [products]);

  function handleTipoChange(tipo: ProductDraft["tipo"]) {
    setDraft((current) => {
      const isNba = tipo === "regata" && isNbaTeamEvidence(`${current.clube} ${current.nome}`);
      const shouldSuggestLiga = isNba && (!current.liga || current.liga === "revisar");
      const shouldSuggestPrice = isNba && current.preco === 0;
      return {
        ...current,
        tipo,
        ...(shouldSuggestLiga ? { liga: "nba" } : {}),
        ...(shouldSuggestPrice ? { preco: storeConfig.nbaTankTopPrice } : {}),
      };
    });
  }

  function handleClubeChange(clube: string) {
    setDraft((current) => {
      const isNba = current.tipo === "regata" && isNbaTeamEvidence(`${clube} ${current.nome}`);
      const shouldSuggestLiga = isNba && (!current.liga || current.liga === "revisar");
      const shouldSuggestPrice = isNba && current.preco === 0;
      return {
        ...current,
        clube,
        ...(shouldSuggestLiga ? { liga: "nba" } : {}),
        ...(shouldSuggestPrice ? { preco: storeConfig.nbaTankTopPrice } : {}),
      };
    });
  }

  function handleNomeChange(nome: string) {
    setDraft((current) => {
      const isNba = current.tipo === "regata" && isNbaTeamEvidence(`${current.clube} ${nome}`);
      const shouldSuggestLiga = isNba && (!current.liga || current.liga === "revisar");
      const shouldSuggestPrice = isNba && current.preco === 0;
      return {
        ...current,
        nome,
        ...(!slugTouched ? { slug: slugify(nome) } : {}),
        ...(shouldSuggestLiga ? { liga: "nba" } : {}),
        ...(shouldSuggestPrice ? { preco: storeConfig.nbaTankTopPrice } : {}),
      };
    });
  }

  function changeSizes(value: string) {
    setSizeInput(value);
    const sizes = [...new Set(value.split(",").map((size) => size.trim().toUpperCase()).filter(Boolean))];
    setDraft((current) => ({
      ...current,
      tamanhos: sizes,
      stock_by_size: Object.fromEntries(sizes.map((size) => [size, current.stock_by_size[size] ?? 0])),
    }));
  }

  async function uploadPhotos(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (!files.length) return;
    if (files.length + existingPhotos.length + draft.imageUrls.length > 6) {
      setMessage("Cada produto pode ter no máximo 6 fotos.");
      return;
    }

    setUploading(true);
    setMessage("");
    try {
      const formData = new FormData();
      files.forEach((file) => formData.append("files", file));
      const response = await adminFetch("/api/admin/products/images", {
        method: "POST",
        body: formData,
      });
      const body = await response.json();
      if (response.status === 401) {
        setLoadError("Sua sessão expirou. Entre novamente.");
        return;
      }
      if (!response.ok) throw new Error(body.error ?? "Não foi possível enviar as fotos.");
      setDraft((current) => ({ ...current, imageUrls: [...current.imageUrls, ...body.images.map((image: { url: string }) => image.url)] }));
      setMessage(`${body.images.length} foto(s) enviadas. Salve o produto para publicá-las na vitrine.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível enviar as fotos.");
    } finally {
      setUploading(false);
    }
  }

  async function saveProduct(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    try {
      const payload = {
        ...draft,
        slug: draft.slug || slugify(draft.nome),
        liga: slugify(draft.liga) || draft.liga.trim().toLowerCase() || "revisar",
      };
      const response = await adminFetch("/api/admin/products", {
        method: draft.id ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await response.json();
      if (response.status === 401) {
        setLoadError("Sua sessão expirou. Entre novamente.");
        return;
      }
      if (!response.ok) throw new Error(body.error ?? "Não foi possível salvar o produto.");
      const savedProduct = body.product as ManualProduct;
      setProducts((current) => {
        const next = draft.id
          ? current.map((product) => product.id === savedProduct.id ? savedProduct : product)
          : [...current, savedProduct];
        return next.sort((left, right) => left.nome.localeCompare(right.nome, "pt-BR"));
      });
      setMessage(`Produto ${savedProduct.nome} salvo e publicado no catálogo.`);
      resetForm();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível salvar o produto.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="mx-auto max-w-7xl px-5 py-10 lg:px-8">
      <AdminNavigation current="products" />
      {loading ? (
        <AdminSkeleton cards={3} />
      ) : loadError ? (
        <ErrorState message={loadError} onRetry={() => void loadProducts()} />
      ) : <>
      <div>
        <p className="text-[10px] font-black uppercase tracking-[.2em] text-action">{SITE_NAME} · Administração</p>
        <h1 className="mt-2 text-3xl font-black">Produtos e estoque</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
          Cadastre produtos manuais no mesmo catálogo Supabase usado pela vitrine. O estoque é informativo e editado manualmente; não reserva nem desconta unidades no checkout.
        </p>
      </div>

      {message && <p role="status" aria-live="polite" className="mt-4 rounded-lg bg-paper px-4 py-3 text-sm">{message}</p>}
      <section className="mt-7 grid gap-3 sm:grid-cols-2">
        <StatCard label="Produtos manuais" value={String(products.length)} detail="Produtos importados seguem preservados" icon={PackageOpen} />
        <StatCard label="Estoque informativo" value={String(products.reduce((sum, product) => sum + Object.values(product.stock_by_size ?? {}).reduce((subtotal, count) => subtotal + count, 0), 0))} detail="Não é reservado nem descontado no checkout" />
      </section>

      <section className="mt-8 rounded-xl border border-border bg-white p-5 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-black">{draft.id ? "Editar produto manual" : "Cadastrar produto"}</h2>
            <p className="mt-1 text-xs text-muted">Produtos importados e já cadastrados não são alterados por este formulário.</p>
          </div>
          {draft.id && <button type="button" onClick={resetForm} className="rounded-lg border border-border px-3 py-2 text-xs font-bold">Cancelar edição</button>}
        </div>

        <form onSubmit={(event) => void saveProduct(event)} className="mt-5 grid gap-4 md:grid-cols-2">
          <Field label="Nome do produto">
            <input required minLength={3} maxLength={160} value={draft.nome} onChange={(event) => handleNomeChange(event.target.value)} className="rounded-lg border border-border px-3 py-2.5 font-normal" />
          </Field>
          <Field label="Endereço do produto (slug)">
            <input required pattern="[a-z0-9]+(?:-[a-z0-9]+)*" maxLength={100} value={draft.slug} onChange={(event) => {
              setSlugTouched(true);
              setField("slug", slugify(event.target.value));
            }} className="rounded-lg border border-border px-3 py-2.5 font-normal" placeholder="camisa-clube-modelo" />
          </Field>
          <Field label="Preço (R$)">
            <input required type="number" inputMode="decimal" min="0" max="100000" step="0.01" value={draft.preco} onChange={(event) => setField("preco", Number(event.target.value))} className="rounded-lg border border-border px-3 py-2.5 font-normal" />
            {draft.tipo === "regata" && (draft.liga === "nba" || isNbaTeamEvidence(`${draft.clube} ${draft.nome}`)) && (
              <p className="mt-1 text-[11px] text-muted">
                Preço sugerido: {currency.format(storeConfig.nbaTankTopPrice)}. Regatas NBA têm preço único de {currency.format(storeConfig.nbaTankTopPrice)} garantido no catálogo, carrinho e checkout.
              </p>
            )}
          </Field>
          <Field label="Marca">
            <input maxLength={100} value={draft.brand} onChange={(event) => setField("brand", event.target.value)} className="rounded-lg border border-border px-3 py-2.5 font-normal" placeholder="Ex.: Adidas" />
          </Field>
          <Field label="Fornecedor padrão">
            <input maxLength={160} value={draft.supplier_name} onChange={(event) => setField("supplier_name", event.target.value)} className="rounded-lg border border-border px-3 py-2.5 font-normal" placeholder="Nome do fornecedor" />
          </Field>
          <Field label="Custo de aquisição (R$)">
            <input type="number" inputMode="decimal" min="0" max="100000" step="0.01" value={draft.supplier_cost} onChange={(event) => setField("supplier_cost", Number(event.target.value))} className="rounded-lg border border-border px-3 py-2.5 font-normal" />
          </Field>
          <Field label="Público / categoria">
            <select value={draft.publico} onChange={(event) => setField("publico", event.target.value as ProductDraft["publico"])} className="rounded-lg border border-border px-3 py-2.5 font-normal">
              {Object.entries(audienceLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </Field>
          <Field label="Tipo de produto">
            <select value={draft.tipo} onChange={(event) => handleTipoChange(event.target.value as ProductDraft["tipo"])} className="rounded-lg border border-border px-3 py-2.5 font-normal">
              {Object.entries(productTypeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </Field>
          <Field label="Competição / categoria (slug)">
            <input
              required
              list="competition-list"
              value={draft.liga}
              onChange={(event) => {
                const sanitized = event.target.value
                  .normalize("NFD")
                  .replace(/[\u0300-\u036f]/g, "")
                  .toLowerCase()
                  .replace(/[^a-z0-9-]/g, "");
                setField("liga", sanitized);
              }}
              className="rounded-lg border border-border px-3 py-2.5 font-normal"
              placeholder="Ex.: nba, brasileirao-serie-a, premier-league…"
            />
            <datalist id="competition-list">
              {competitionOptions.map((comp) => (
                <option key={comp.slug} value={comp.slug}>
                  {comp.label}
                </option>
              ))}
            </datalist>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] text-muted">Sugestões rápidas:</span>
              {[
                { slug: "nba", label: "NBA" },
                { slug: "brasileirao-serie-a", label: "Brasileirão" },
                { slug: "premier-league", label: "Premier League" },
                { slug: "la-liga", label: "La Liga" },
                { slug: "champions-league", label: "Champions" },
                { slug: "selecoes", label: "Seleções" },
              ].map((item) => (
                <button
                  key={item.slug}
                  type="button"
                  onClick={() => setField("liga", item.slug)}
                  className={`rounded px-1.5 py-0.5 text-[10px] font-bold transition ${
                    draft.liga === item.slug
                      ? "bg-pitch text-white"
                      : "bg-paper text-muted hover:text-ink hover:bg-zinc-200"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </Field>
          <Field label="Clube ou equipe">
            <input required minLength={2} maxLength={100} value={draft.clube} onChange={(event) => handleClubeChange(event.target.value)} className="rounded-lg border border-border px-3 py-2.5 font-normal" />
          </Field>
          <Field label="Temporada">
            <input required maxLength={32} value={draft.temporada} onChange={(event) => setField("temporada", event.target.value)} className="rounded-lg border border-border px-3 py-2.5 font-normal" placeholder="2026/27" />
          </Field>
          <Field label="Uniforme">
            <select value={draft.uniforme} onChange={(event) => setField("uniforme", event.target.value as ProductDraft["uniforme"])} className="rounded-lg border border-border px-3 py-2.5 font-normal">
              {Object.entries(uniformLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </Field>
          <Field label="Cor principal">
            <input required maxLength={60} value={draft.cor} onChange={(event) => setField("cor", event.target.value)} className="rounded-lg border border-border px-3 py-2.5 font-normal" />
          </Field>
          <Field label="Descrição" className="md:col-span-2">
            <textarea maxLength={4000} rows={4} value={draft.description} onChange={(event) => setField("description", event.target.value)} className="rounded-lg border border-border px-3 py-2.5 font-normal" />
          </Field>
          <div className="md:col-span-2">
            <Field label="Tamanhos (separados por vírgula; exemplo: P, M, G, GG)">
              <input required value={sizeInput} onChange={(event) => changeSizes(event.target.value)} className="rounded-lg border border-border px-3 py-2.5 font-normal" />
            </Field>
            {draft.tamanhos.length > 0 && <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {draft.tamanhos.map((size) => <label key={size} className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2 text-xs">
                <span className="font-bold">{size} · estoque manual</span>
                <input aria-label={`Estoque do tamanho ${size}`} type="number" inputMode="numeric" min="0" max="10000" step="1" value={draft.stock_by_size[size] ?? 0} onChange={(event) => setDraft((current) => ({ ...current, stock_by_size: { ...current.stock_by_size, [size]: Number(event.target.value) } }))} className="w-20 rounded border border-border px-2 py-1 text-right" />
              </label>)}
            </div>}
            <p className="mt-2 text-[11px] leading-5 text-muted">O cadastro do estoque não altera disponibilidade nem bloqueia compras; atualize manualmente quando necessário. O tamanho 3GG ainda não é aceito pelo checkout atual.</p>
          </div>
          <div className="md:col-span-2">
            <label className="grid gap-1.5 text-xs font-bold">Fotos do produto (JPG, PNG ou WebP; até 10 MB por foto)
              <input type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={uploading || existingPhotos.length + draft.imageUrls.length >= 6} onChange={(event) => void uploadPhotos(event)} className="rounded-lg border border-border px-3 py-2.5 font-normal disabled:opacity-50" />
            </label>
            <div className="mt-3 flex flex-wrap gap-3">
              {[...existingPhotos.map((photo) => ({ ...photo, saved: true })), ...draft.imageUrls.map((src) => ({ src, alt: draft.nome, saved: false }))].map((photo, index) => (
                <div key={`${photo.src}-${index}`} className="relative h-24 w-20 overflow-hidden rounded border border-border bg-paper">
                  <Image src={photo.src} alt={photo.alt ?? draft.nome} fill sizes="80px" unoptimized className="object-cover" />
                  <span className="absolute inset-x-0 bottom-0 bg-black/70 px-1 py-0.5 text-center text-[9px] font-bold text-white">{photo.saved ? "Salva" : "Nova"}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="sticky bottom-0 z-10 -mx-3 flex flex-wrap gap-2 bg-white/95 p-3 backdrop-blur md:static md:mx-0 md:col-span-2 md:bg-transparent md:p-0 md:backdrop-blur-0">
            <button type="submit" disabled={saving || uploading} className="rounded-lg bg-ink px-5 py-3 text-xs font-black uppercase text-white disabled:opacity-50">{saving ? "Salvando…" : draft.id ? "Salvar alterações" : "Cadastrar e publicar"}</button>
          </div>
        </form>
      </section>

      <section className="mt-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div><h2 className="text-xl font-black">Produtos cadastrados manualmente</h2><p className="mt-1 text-xs text-muted">{products.length} produto(s) · o catálogo importado continua preservado.</p></div>
          {products.length > 0 && <p className="text-xs text-muted">Estoque total registrado: {products.reduce((sum, product) => sum + Object.values(product.stock_by_size ?? {}).reduce((subtotal, count) => subtotal + count, 0), 0)} unidades</p>}
        </div>
        {products.length === 0 ? (
          <div className="mt-4"><EmptyState icon={PackageOpen} title="Nenhum produto manual ainda" description="Cadastre seu primeiro produto no formulário acima. O catálogo importado continua preservado." /></div>
        ) : (
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {products.map((product) => (
              <article key={product.id} className="flex gap-4 rounded-xl border border-border bg-white p-4">
                <div className="relative h-28 w-24 shrink-0 overflow-hidden rounded bg-paper">
                  {product.images?.[0] && <Image src={product.images[0].src} alt={product.images[0].alt ?? product.nome} fill sizes="96px" unoptimized className="object-cover" />}
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="font-bold leading-5">{product.nome}</h3>
                  <p className="mt-1 text-xs text-muted">{product.clube} · {product.temporada} · {audienceLabels[product.publico as keyof typeof audienceLabels] ?? product.publico}</p>
                  <p className="mt-2 text-sm font-black">{currency.format(Number(product.preco))}</p>
                  <p className="mt-1 text-[11px] text-muted">{product.tamanhos.map((size) => `${size}: ${product.stock_by_size?.[size] ?? 0}`).join(" · ")}</p>
                  <div className="mt-2"><StatusBadge tone="blue">Publicado na vitrine</StatusBadge></div>
                  <button type="button" onClick={() => editProduct(product)} className="mt-3 min-h-11 rounded-md border border-border px-3 py-2 text-xs font-bold hover:bg-paper">Editar produto e estoque</button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
      </>}
    </main>
  );
}
