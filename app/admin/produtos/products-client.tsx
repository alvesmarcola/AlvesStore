"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AdminNavigation } from "@/components/admin-navigation";
import { AdminSkeleton, EmptyState, ErrorState, StatCard, StatusBadge } from "@/components/admin-states";
import { PackageOpen, Trash2, AlertTriangle, EyeOff, X, ArrowLeft, Loader2, CheckCircle2, ChevronLeft, ChevronRight, Star } from "lucide-react";
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
  tem_variacao_uniforme?: boolean;
  oculto?: boolean;
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
  tem_variacao_uniforme: boolean;
  oculto: boolean;
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
  tem_variacao_uniforme: false,
  oculto: false,
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
  const [currentPhotos, setCurrentPhotos] = useState<ProductPhoto[]>([]);
  const [sizeInput, setSizeInput] = useState("P, M, G, GG");
  const [slugTouched, setSlugTouched] = useState(false);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [loadError, setLoadError] = useState("");

  const [productToDelete, setProductToDelete] = useState<ManualProduct | null>(null);
  const [deleteStep, setDeleteStep] = useState<1 | 2>(1);
  const [orderCount, setOrderCount] = useState<number | null>(null);
  const [checkingOrders, setCheckingOrders] = useState(false);
  const [confirmationText, setConfirmationText] = useState("");
  const [deleteConfirmedOrders, setDeleteConfirmedOrders] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteActionError, setDeleteActionError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  async function initiateDelete(product: ManualProduct) {
    setProductToDelete(product);
    setDeleteStep(1);
    setOrderCount(null);
    setConfirmationText("");
    setDeleteConfirmedOrders(false);
    setDeleteActionError("");
    setCheckingOrders(true);

    try {
      const res = await adminFetch(`/api/admin/products?check_orders=${encodeURIComponent(product.id)}`, {
        cache: "no-store",
      });
      const body = await res.json();
      if (res.ok && typeof body.orderCount === "number") {
        setOrderCount(body.orderCount);
      } else {
        setOrderCount(0);
      }
    } catch {
      setOrderCount(0);
    } finally {
      setCheckingOrders(false);
    }
  }

  async function handleConfirmDelete() {
    if (!productToDelete) return;
    setIsDeleting(true);
    setDeleteActionError("");
    try {
      const res = await adminFetch(`/api/admin/products?id=${encodeURIComponent(productToDelete.id)}`, {
        method: "DELETE",
      });
      const body = await res.json();
      if (!res.ok) {
        throw new Error(body.error ?? "Não foi possível excluir o produto.");
      }

      const deletedId = productToDelete.id;
      const deletedName = productToDelete.nome;

      setProducts((prev) => prev.filter((p) => p.id !== deletedId));

      if (draft.id === deletedId) {
        resetForm();
      }

      setProductToDelete(null);
      setMessage(`Produto "${deletedName}" excluído com sucesso.`);
    } catch (err) {
      setDeleteActionError(err instanceof Error ? err.message : "Erro ao excluir produto.");
    } finally {
      setIsDeleting(false);
    }
  }

  async function handleQuickHide() {
    if (!productToDelete) return;
    setIsDeleting(true);
    setDeleteActionError("");
    try {
      const res = await adminFetch("/api/admin/products", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: productToDelete.id,
          slug: productToDelete.slug,
          nome: productToDelete.nome,
          clube: productToDelete.clube,
          liga: productToDelete.liga,
          publico: productToDelete.publico,
          tipo: productToDelete.tipo,
          temporada: productToDelete.temporada,
          uniforme: productToDelete.uniforme,
          preco: productToDelete.preco,
          tamanhos: productToDelete.tamanhos,
          cor: productToDelete.cor,
          description: productToDelete.description,
          stock_by_size: productToDelete.stock_by_size,
          brand: productToDelete.brand,
          supplier_name: productToDelete.supplier_name,
          supplier_cost: productToDelete.supplier_cost,
          imageUrls: [],
          tem_variacao_uniforme: productToDelete.tem_variacao_uniforme,
          oculto: true,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Não foi possível ocultar o produto.");

      setProducts((prev) =>
        prev.map((p) => (p.id === productToDelete.id ? { ...p, oculto: true } : p))
      );
      if (draft.id === productToDelete.id) {
        setDraft((curr) => ({ ...curr, oculto: true }));
      }
      const hiddenName = productToDelete.nome;
      setProductToDelete(null);
      setMessage(`Produto "${hiddenName}" foi ocultado no site.`);
    } catch (err) {
      setDeleteActionError(err instanceof Error ? err.message : "Erro ao ocultar produto.");
    } finally {
      setIsDeleting(false);
    }
  }

  const loadProducts = useCallback(async (term?: string) => {
    setLoading(true);
    setMessage("");
    setLoadError("");
    try {
      const q = typeof term === "string" ? term.trim() : searchTerm.trim();
      const endpoint = q ? `/api/admin/products?q=${encodeURIComponent(q)}` : "/api/admin/products";
      const response = await adminFetch(endpoint, {
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
  }, [searchTerm]);

  useEffect(() => { void loadProducts(); }, [loadProducts]);

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
      tem_variacao_uniforme: Boolean(product.tem_variacao_uniforme),
      oculto: Boolean(product.oculto),
    });
    setSizeInput(sizes.join(", "));
    setCurrentPhotos(product.images ? [...product.images] : []);
    setSlugTouched(true);
    setMessage(`Editando ${product.nome}.`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function resetForm() {
    setDraft(emptyDraft);
    setSizeInput("P, M, G, GG");
    setCurrentPhotos([]);
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
    if (files.length + currentPhotos.length > 6) {
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
      const newPhotos: ProductPhoto[] = body.images.map((image: { url: string }) => ({
        src: image.url,
        alt: draft.nome,
      }));
      setCurrentPhotos((current) => [...current, ...newPhotos]);
      setMessage(`${body.images.length} foto(s) enviadas. Organize a ordem e clique em salvar para publicá-las.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível enviar as fotos.");
    } finally {
      setUploading(false);
    }
  }

  function removePhoto(index: number) {
    setCurrentPhotos((current) => current.filter((_, i) => i !== index));
  }

  function movePhoto(fromIndex: number, toIndex: number) {
    setCurrentPhotos((current) => {
      if (toIndex < 0 || toIndex >= current.length) return current;
      const next = [...current];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
  }

  function makeCoverPhoto(index: number) {
    setCurrentPhotos((current) => {
      if (index <= 0 || index >= current.length) return current;
      const next = [...current];
      const [moved] = next.splice(index, 1);
      next.unshift(moved);
      return next;
    });
  }

  async function saveProduct(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    try {
      const payload = {
        ...draft,
        images: currentPhotos,
        imageUrls: [],
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
            <p className="mt-1 text-[11px] text-muted">
              Produtos manuais utilizam exatamente o preço digitado acima, sem regras de categoria, ofertas por quantidade ou promoções automáticas.
            </p>
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
          <div className="rounded-lg border border-border bg-paper/50 p-3 md:col-span-2">
            <label className="flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                checked={draft.tem_variacao_uniforme}
                onChange={(event) => setField("tem_variacao_uniforme", event.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-border text-pitch focus:ring-pitch"
              />
              <div className="text-xs">
                <span className="font-bold text-ink">Opção de uniforme: Casa / Fora</span>
                <p className="mt-0.5 text-muted">
                  Quando ativo, exibe opções obrigatórias de rádio &quot;Casa&quot; e &quot;Fora&quot; na página do produto antes da compra e adiciona como linhas separadas no carrinho.
                </p>
              </div>
            </label>
          </div>
          <div className="rounded-lg border border-border bg-paper/50 p-3 md:col-span-2">
            <label className="flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                checked={draft.oculto}
                onChange={(event) => setField("oculto", event.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-border text-pitch focus:ring-pitch"
              />
              <div className="text-xs">
                <span className="font-bold text-ink">Ocultar produto no site (Privado / Teste)</span>
                <p className="mt-0.5 text-muted">
                  Quando marcado, o produto NÃO aparece na home, na lista de ligas, na busca nem no sitemap. A rota pública retorna 404, mas administradores logados continuam podendo acessá-lo e testar compras.
                </p>
              </div>
            </label>
          </div>
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
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="text-xs font-bold">
                Fotos do produto ({currentPhotos.length}/6)
                <span className="block text-[11px] font-normal text-muted">A foto #1 é a capa da vitrine. Use as setas para reordenar ou o botão de lixeira para remover.</span>
              </label>
              <label className={`cursor-pointer inline-flex items-center gap-1.5 rounded-lg border border-border bg-paper px-3 py-1.5 text-xs font-bold transition hover:bg-zinc-200 ${uploading || currentPhotos.length >= 6 ? "opacity-50 pointer-events-none" : ""}`}>
                <span>+ Adicionar fotos</span>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  multiple
                  disabled={uploading || currentPhotos.length >= 6}
                  onChange={(event) => void uploadPhotos(event)}
                  className="sr-only"
                />
              </label>
            </div>

            {currentPhotos.length === 0 ? (
              <div className="mt-3 rounded-lg border border-dashed border-border p-6 text-center text-xs text-muted">
                Nenhuma foto cadastrada. Produtos salvos sem fotos serão marcados automaticamente como ocultos.
              </div>
            ) : (
              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-6">
                {currentPhotos.map((photo, index) => (
                  <div
                    key={`${photo.src}-${index}`}
                    className={`group relative flex flex-col overflow-hidden rounded-lg border bg-paper p-1.5 transition ${
                      index === 0 ? "border-action ring-2 ring-action/20" : "border-border"
                    }`}
                  >
                    <div className="relative aspect-[4/5] w-full overflow-hidden rounded bg-black/5">
                      <Image
                        src={photo.src}
                        alt={photo.alt ?? draft.nome}
                        fill
                        sizes="160px"
                        unoptimized
                        className="object-cover"
                      />
                      <span
                        className={`absolute left-1 top-1 rounded px-1.5 py-0.5 text-[9px] font-black text-white shadow ${
                          index === 0 ? "bg-action" : "bg-black/70"
                        }`}
                      >
                        {index === 0 ? "1 · Capa" : `#${index + 1}`}
                      </span>
                    </div>

                    <div className="mt-1 flex items-center justify-between gap-1 border-t border-border/50 pt-1 text-[10px]">
                      <div className="flex items-center gap-0.5">
                        <button
                          type="button"
                          disabled={index === 0}
                          onClick={() => movePhoto(index, index - 1)}
                          title="Mover para esquerda / antes"
                          aria-label={`Mover foto ${index + 1} para esquerda`}
                          className="rounded p-1 text-muted hover:bg-zinc-200 hover:text-ink disabled:opacity-20"
                        >
                          <ChevronLeft className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          disabled={index === currentPhotos.length - 1}
                          onClick={() => movePhoto(index, index + 1)}
                          title="Mover para direita / depois"
                          aria-label={`Mover foto ${index + 1} para direita`}
                          className="rounded p-1 text-muted hover:bg-zinc-200 hover:text-ink disabled:opacity-20"
                        >
                          <ChevronRight className="h-3.5 w-3.5" />
                        </button>
                        {index > 0 && (
                          <button
                            type="button"
                            onClick={() => makeCoverPhoto(index)}
                            title="Definir como foto de capa (principal)"
                            aria-label={`Definir foto ${index + 1} como capa`}
                            className="rounded p-1 text-amber-600 hover:bg-amber-100"
                          >
                            <Star className="h-3.5 w-3.5 fill-amber-500" />
                          </button>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => removePhoto(index)}
                        title="Remover foto"
                        aria-label={`Remover foto ${index + 1}`}
                        className="rounded p-1 text-red-600 hover:bg-red-50 hover:text-red-700"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="sticky bottom-0 z-10 -mx-3 flex flex-wrap items-center gap-2 bg-white/95 p-3 backdrop-blur md:static md:mx-0 md:col-span-2 md:bg-transparent md:p-0 md:backdrop-blur-0">
            <button type="submit" disabled={saving || uploading} className="min-h-[44px] rounded-lg bg-ink px-5 py-3 text-xs font-black uppercase text-white disabled:opacity-50">{saving ? "Salvando…" : draft.id ? "Salvar alterações" : "Cadastrar e publicar"}</button>
            {draft.id && (
              <button
                type="button"
                onClick={() => {
                  const currentProd = products.find((p) => p.id === draft.id);
                  if (currentProd) void initiateDelete(currentProd);
                }}
                className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-xs font-bold text-red-700 hover:bg-red-100 transition-colors"
              >
                <Trash2 className="h-4 w-4" />
                Excluir produto
              </button>
            )}
          </div>
        </form>
      </section>

      <section className="mt-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-xl font-black">Produtos no Supabase</h2>
            <p className="mt-1 text-xs text-muted">{products.length} produto(s) exibido(s) · pesquise para localizar produtos já cadastrados no banco.</p>
          </div>
          {products.length > 0 && <p className="text-xs text-muted">Estoque total registrado: {products.reduce((sum, product) => sum + Object.values(product.stock_by_size ?? {}).reduce((subtotal, count) => subtotal + count, 0), 0)} unidades</p>}
        </div>

        <form onSubmit={(event) => { event.preventDefault(); void loadProducts(searchTerm); }} className="mt-4 flex flex-wrap gap-2 max-w-xl">
          <input
            type="search"
            placeholder="Pesquisar por nome, slug ou ID no Supabase..."
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            className="flex-1 min-w-[240px] rounded-lg border border-border px-3 py-2 text-sm bg-white"
          />
          <button type="submit" className="rounded-lg bg-ink px-4 py-2 text-xs font-bold text-white hover:bg-zinc-800 transition-colors">
            Buscar no banco
          </button>
          {searchTerm && (
            <button
              type="button"
              onClick={() => { setSearchTerm(""); void loadProducts(""); }}
              className="rounded-lg border border-border px-3 py-2 text-xs font-bold hover:bg-paper transition-colors"
            >
              Limpar busca
            </button>
          )}
        </form>

        <div className="mt-3 rounded-lg border border-border bg-paper/60 p-3 text-xs text-muted flex items-center gap-2">
          <span className="font-bold text-ink">Administração do Catálogo:</span>
          <span>
            Produtos configurados com preço válido e desmarcados de &quot;Oculto&quot; entram automaticamente na vitrine da loja.
          </span>
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
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <StatusBadge tone={product.oculto ? "red" : "blue"}>
                      {product.oculto ? "Oculto no site" : "Publicado na vitrine"}
                    </StatusBadge>
                    {product.tem_variacao_uniforme && <StatusBadge tone="amber">Casa / Fora</StatusBadge>}
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <button type="button" onClick={() => editProduct(product)} className="min-h-[44px] rounded-md border border-border px-3 py-1.5 text-xs font-bold hover:bg-paper">Editar produto e estoque</button>
                    <a href={`/produto/${product.slug}`} target="_blank" rel="noreferrer" className="inline-flex min-h-[44px] items-center rounded-md border border-border bg-paper px-3 py-1.5 text-xs font-bold text-ink hover:bg-zinc-200">Ver página</a>
                    <button
                      type="button"
                      onClick={() => void initiateDelete(product)}
                      className="inline-flex min-h-[44px] items-center gap-1.5 rounded-md border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-bold text-red-700 hover:bg-red-100 transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Excluir
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
      </>}

      {productToDelete && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-dialog-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
        >
          <div className="relative max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl border border-border">
            <button
              type="button"
              onClick={() => {
                if (!isDeleting) setProductToDelete(null);
              }}
              aria-label="Fechar modal"
              className="absolute right-4 top-4 rounded-lg p-2 text-muted hover:bg-paper hover:text-ink min-h-[44px] min-w-[44px] flex items-center justify-center"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="flex items-center gap-2.5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600">
                <Trash2 className="h-5 w-5" />
              </div>
              <div>
                <h3 id="delete-dialog-title" className="text-lg font-black text-ink">
                  {deleteStep === 1 ? "Remover produto" : "Confirmação de exclusão"}
                </h3>
                <p className="text-xs text-muted">
                  {deleteStep === 1 ? "Etapa 1 de 2 · Verificação" : "Etapa 2 de 2 · Confirmação final"}
                </p>
              </div>
            </div>

            <div className="mt-4 flex items-center gap-3 rounded-xl border border-border bg-paper/40 p-3">
              <div className="relative h-14 w-12 shrink-0 overflow-hidden rounded bg-paper">
                {productToDelete.images?.[0] ? (
                  <Image
                    src={productToDelete.images[0].src}
                    alt={productToDelete.nome}
                    fill
                    sizes="48px"
                    unoptimized
                    className="object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-[10px] text-muted">Sem foto</div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-bold text-sm text-ink truncate">{productToDelete.nome}</p>
                <p className="text-xs text-muted">
                  {productToDelete.clube} · {currency.format(Number(productToDelete.preco))}
                </p>
                <p className="text-[11px] font-mono text-muted truncate">/{productToDelete.slug}</p>
              </div>
            </div>

            {deleteActionError && (
              <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                <p className="font-bold flex items-center gap-1.5">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  Não foi possível concluir
                </p>
                <p className="mt-1">{deleteActionError}</p>
              </div>
            )}

            {deleteStep === 1 ? (
              <div className="mt-5 space-y-4">
                {checkingOrders ? (
                  <div className="flex items-center justify-center gap-2 rounded-xl border border-border p-4 text-xs text-muted">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Verificando pedidos vinculados a este produto...</span>
                  </div>
                ) : orderCount && orderCount > 0 ? (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900 space-y-2">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600 mt-0.5" />
                      <div>
                        <p className="font-bold text-amber-950">
                          Este produto possui {orderCount} pedido(s) registrado(s)
                        </p>
                        <p className="mt-1 text-amber-800 leading-relaxed">
                          Os pedidos continuam no histórico (snapshot completo); só o produto some do site. A exclusão definitiva é permitida mediante confirmação reforçada.
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-xs text-emerald-900">
                    <div className="flex items-start gap-2">
                      <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600 mt-0.5" />
                      <div>
                        <p className="font-bold text-emerald-950">Nenhum pedido vinculado encontrado</p>
                        <p className="mt-1 text-emerald-800 leading-relaxed">
                          Este produto nunca foi comprado. Você pode escolher entre ocultá-lo da loja ou excluí-lo definitivamente (junto com suas fotos).
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex flex-col gap-2 pt-2">
                  <button
                    type="button"
                    disabled={isDeleting || checkingOrders || productToDelete.oculto === undefined}
                    onClick={() => void handleQuickHide()}
                    className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-ink px-4 py-2.5 text-xs font-bold text-white hover:bg-pitch transition-colors disabled:opacity-50"
                  >
                    <EyeOff className="h-4 w-4" />
                    {productToDelete.oculto === undefined
                      ? "Ocultar indisponível (migração 20261105000002 não aplicada)"
                      : productToDelete.oculto
                        ? "Já está oculto no site (manter)"
                        : "Ocultar produto no site agora"}
                  </button>

                  <button
                    type="button"
                    disabled={isDeleting || checkingOrders}
                    onClick={() => setDeleteStep(2)}
                    className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border border-red-300 bg-red-50 px-4 py-2.5 text-xs font-bold text-red-700 hover:bg-red-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Trash2 className="h-4 w-4" />
                    {orderCount && orderCount > 0
                      ? "Continuar para exclusão definitiva →"
                      : "Continuar para exclusão definitiva →"}
                  </button>

                  <button
                    type="button"
                    disabled={isDeleting}
                    onClick={() => setProductToDelete(null)}
                    className="flex min-h-[44px] w-full items-center justify-center rounded-xl border border-border px-4 py-2.5 text-xs font-bold text-muted hover:text-ink hover:bg-paper transition-colors"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-5 space-y-4">
                <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-xs text-red-900">
                  <p className="font-bold flex items-center gap-1.5 text-red-950">
                    <AlertTriangle className="h-4 w-4 shrink-0 text-red-600" />
                    Atenção: Ação irreversível!
                  </p>
                  <p className="mt-1.5 leading-relaxed text-red-800">
                    O produto será removido permanentemente do banco de dados e todas as fotos associadas no Supabase Storage serão apagadas.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-ink">
                    Para confirmar, digite o nome do produto:
                  </label>
                  <div className="mt-1 rounded-md bg-paper p-2 font-mono text-xs text-ink font-bold select-all border border-border">
                    {productToDelete.nome}
                  </div>
                  <p className="mt-1 text-[11px] text-muted">Ou digite a palavra <span className="font-mono font-bold text-ink">EXCLUIR</span>:</p>
                  <input
                    type="text"
                    autoFocus
                    disabled={isDeleting}
                    value={confirmationText}
                    onChange={(e) => setConfirmationText(e.target.value)}
                    placeholder="Digite o nome ou EXCLUIR"
                    className="mt-2 w-full rounded-xl border border-border px-3 py-2.5 text-xs font-normal focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none"
                  />
                </div>

                {orderCount && orderCount > 0 && (
                  <label className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                    <input
                      type="checkbox"
                      checked={deleteConfirmedOrders}
                      disabled={isDeleting}
                      onChange={(e) => setDeleteConfirmedOrders(e.target.checked)}
                      className="mt-0.5 h-4 w-4 shrink-0"
                    />
                    <span>Entendo que há {orderCount} pedido(s) vinculado(s) e que o produto será removido definitivamente</span>
                  </label>
                )}

                {(() => {
                  const isConfirmed =
                    (confirmationText.trim().toLowerCase() === productToDelete.nome.trim().toLowerCase() ||
                      confirmationText.trim() === "EXCLUIR") &&
                    (orderCount === null || orderCount === 0 || deleteConfirmedOrders);

                  return (
                    <div className="flex flex-col gap-2 pt-2">
                      <button
                        type="button"
                        disabled={!isConfirmed || isDeleting}
                        onClick={() => void handleConfirmDelete()}
                        className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-red-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        {isDeleting ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Excluindo produto e fotos...
                          </>
                        ) : (
                          <>
                            <Trash2 className="h-4 w-4" />
                            Excluir definitivamente agora
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        disabled={isDeleting}
                        onClick={() => {
                          setDeleteStep(1);
                          setConfirmationText("");
                          setDeleteConfirmedOrders(false);
                        }}
                        className="flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-xl border border-border px-4 py-2.5 text-xs font-bold text-muted hover:text-ink hover:bg-paper transition-colors"
                      >
                        <ArrowLeft className="h-3.5 w-3.5" />
                        Voltar à etapa anterior
                      </button>

                      <button
                        type="button"
                        disabled={isDeleting}
                        onClick={() => setProductToDelete(null)}
                        className="flex min-h-[44px] w-full items-center justify-center rounded-xl border border-transparent px-4 py-2 text-xs font-bold text-muted hover:text-ink"
                      >
                        Cancelar
                      </button>
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
