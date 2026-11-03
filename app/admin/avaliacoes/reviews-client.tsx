"use client";

import { useState } from "react";
import { Check, MessageSquareQuote, Star, Trash2, X } from "lucide-react";
import { AdminNavigation } from "@/components/admin-navigation";
import {
  AdminSkeleton,
  EmptyState,
  ErrorState,
  LockedState,
  StatCard,
  StatusBadge,
} from "@/components/admin-states";

type ReviewStatus = "pending" | "approved" | "rejected";
type Review = {
  id: string;
  created_at: string;
  nome: string;
  cidade: string;
  produto: string;
  nota: number;
  comentario: string;
  status: ReviewStatus;
  moderated_at: string | null;
  moderated_by: string | null;
};
type Counts = Record<ReviewStatus, number>;

const tabs: { status: ReviewStatus; label: string; tone: "amber" | "green" | "red" }[] = [
  { status: "pending", label: "Pendentes", tone: "amber" },
  { status: "approved", label: "Aprovadas", tone: "green" },
  { status: "rejected", label: "Rejeitadas", tone: "red" },
];
const date = new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeStyle: "short" });

function StarRating({ rating }: { rating: number }) {
  return <span aria-label={`${rating} de 5 estrelas`} className="inline-flex items-center gap-1 text-amber-700"><Star size={15} className="fill-amber-400 text-amber-500" />{rating}/5</span>;
}

export default function AdminReviews() {
  const [token, setToken] = useState("");
  const [status, setStatus] = useState<ReviewStatus>("pending");
  const [reviews, setReviews] = useState<Review[]>([]);
  const [counts, setCounts] = useState<Counts>({ pending: 0, approved: 0, rejected: 0 });
  const [authorized, setAuthorized] = useState(false);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [authRejected, setAuthRejected] = useState(false);

  async function load(nextStatus = status) {
    setLoading(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(`/api/admin/reviews?status=${nextStatus}`, {
        headers: { authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const body = await response.json();
      if (response.status === 401) {
        setAuthorized(false);
        setAuthRejected(true);
        setError(body.error ?? "Token inválido. Verifique e tente novamente.");
        return;
      }
      if (!response.ok) throw new Error(body.error ?? "Não foi possível carregar as avaliações.");
      setReviews(body.reviews as Review[]);
      setCounts(body.counts as Counts);
      setAuthorized(true);
      setAuthRejected(false);
    } catch (reason) {
      setAuthRejected(false);
      setError(reason instanceof Error ? reason.message : "Não foi possível carregar as avaliações.");
    } finally {
      setLoading(false);
    }
  }

  async function moderate(review: Review, nextStatus: ReviewStatus) {
    setBusyId(review.id);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/admin/reviews", {
        method: "PATCH",
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify({ id: review.id, status: nextStatus }),
      });
      const body = await response.json();
      if (response.status === 401) {
        setAuthorized(false);
        setAuthRejected(true);
        setError(body.error ?? "Token inválido. Verifique e tente novamente.");
        return;
      }
      if (!response.ok) throw new Error(body.error ?? "Não foi possível atualizar a avaliação.");
      setReviews((current) => current.filter((item) => item.id !== review.id));
      setCounts((current) => ({
        ...current,
        [review.status]: Math.max(0, current[review.status] - 1),
        [nextStatus]: current[nextStatus] + 1,
      }));
      setNotice(nextStatus === "approved" ? "Avaliação aprovada e publicada." : "Avaliação rejeitada.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível atualizar a avaliação.");
    } finally {
      setBusyId("");
    }
  }

  async function deleteReview(review: Review) {
    if (!window.confirm(`Excluir permanentemente a avaliação de ${review.nome}? Esta ação não pode ser desfeita.`)) return;
    setBusyId(review.id);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/admin/reviews", {
        method: "DELETE",
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify({ id: review.id }),
      });
      const body = await response.json();
      if (response.status === 401) {
        setAuthorized(false);
        setAuthRejected(true);
        setError(body.error ?? "Token inválido. Verifique e tente novamente.");
        return;
      }
      if (!response.ok) throw new Error(body.error ?? "Não foi possível excluir a avaliação.");
      setReviews((current) => current.filter((item) => item.id !== review.id));
      setCounts((current) => ({ ...current, [review.status]: Math.max(0, current[review.status] - 1) }));
      setNotice("Avaliação excluída.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível excluir a avaliação.");
    } finally {
      setBusyId("");
    }
  }

  return (
    <main className="mx-auto max-w-7xl px-5 py-8 sm:py-10 lg:px-8">
      <AdminNavigation current="reviews" />
      <header>
        <p className="text-[10px] font-black uppercase tracking-[.2em] text-action">AlvesStore · administração</p>
        <h1 className="mt-2 text-3xl font-black">Avaliações</h1>
        <p className="mt-2 text-sm text-muted">Revise os comentários enviados antes de publicá-los na loja.</p>
      </header>

      {!authorized && !loading && (!error || authRejected) ? (
        <LockedState
          token={token}
          onTokenChange={setToken}
          onSubmit={(event) => { event.preventDefault(); void load(); }}
          loading={loading}
          message={error}
        />
      ) : loading ? (
        <AdminSkeleton cards={3} />
      ) : error ? (
        <div className="mt-8"><ErrorState message={error} onRetry={() => void load()} /></div>
      ) : (
        <>
          <section className="mt-7 grid gap-3 sm:grid-cols-3">
            <StatCard label="Pendentes" value={String(counts.pending)} detail="Aguardam revisão" icon={MessageSquareQuote} />
            <StatCard label="Aprovadas" value={String(counts.approved)} detail="Visíveis na loja" icon={Check} />
            <StatCard label="Rejeitadas" value={String(counts.rejected)} detail="Não aparecem publicamente" icon={X} />
          </section>

          <div className="mt-7 flex gap-2 overflow-x-auto pb-2" role="tablist" aria-label="Filtrar avaliações">
            {tabs.map((tab) => (
              <button
                key={tab.status}
                type="button"
                role="tab"
                aria-selected={status === tab.status}
                onClick={() => { setStatus(tab.status); void load(tab.status); }}
                className={`min-h-11 shrink-0 rounded-lg border px-4 py-2 text-sm font-bold transition ${status === tab.status ? "border-ink bg-ink text-white" : "border-border bg-white hover:bg-paper"}`}
              >
                {tab.label}
                {tab.status === "pending" && <span className={`ml-2 rounded-full px-2 py-0.5 text-[10px] ${status === tab.status ? "bg-white/20" : "bg-amber-100 text-amber-900"}`}>{counts.pending}</span>}
              </button>
            ))}
          </div>

          {notice && <p role="status" className="mt-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-900">{notice}</p>}
          {error && <div className="mt-4"><ErrorState message={error} onRetry={() => void load()} /></div>}

          {reviews.length === 0 && !error ? (
            <div className="mt-4">
              <EmptyState
                icon={MessageSquareQuote}
                title={status === "pending" ? "Tudo revisado" : `Nenhuma avaliação ${tabs.find((tab) => tab.status === status)?.label.toLowerCase()}`}
                description={status === "pending" ? "Novas avaliações aparecerão aqui para aprovação." : "Quando houver avaliações neste filtro, elas serão exibidas aqui."}
              />
            </div>
          ) : (
            <section aria-label="Avaliações" className="mt-4 grid gap-4 lg:grid-cols-2">
              {reviews.map((review) => (
                <article key={review.id} className="rounded-xl border border-border bg-white p-5 shadow-sm sm:p-6">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="break-words text-base font-black">{review.nome}</h2>
                      <p className="mt-1 text-xs text-muted">{review.cidade} · {review.produto || "Avaliação geral"}</p>
                    </div>
                    <StatusBadge tone={review.status === "approved" ? "green" : review.status === "rejected" ? "red" : "amber"}>
                      {review.status === "approved" ? "Aprovada" : review.status === "rejected" ? "Rejeitada" : "Pendente"}
                    </StatusBadge>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs">
                    <StarRating rating={review.nota} />
                    <time dateTime={review.created_at} className="text-muted">{date.format(new Date(review.created_at))}</time>
                  </div>
                  <p className="mt-4 whitespace-pre-wrap break-words text-sm leading-6 text-ink">{review.comentario}</p>
                  <div className="mt-5 flex flex-wrap gap-2 border-t border-border pt-4">
                    {review.status !== "approved" && <button type="button" disabled={Boolean(busyId)} onClick={() => void moderate(review, "approved")} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-green-700 px-4 py-2 text-xs font-bold text-white disabled:opacity-50"><Check size={15} />Aprovar</button>}
                    {review.status !== "rejected" && <button type="button" disabled={Boolean(busyId)} onClick={() => void moderate(review, "rejected")} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-xs font-bold text-amber-900 disabled:opacity-50"><X size={15} />Rejeitar</button>}
                    <button type="button" disabled={Boolean(busyId)} onClick={() => void deleteReview(review)} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-red-200 px-4 py-2 text-xs font-bold text-red-700 hover:bg-red-50 disabled:opacity-50"><Trash2 size={15} />Excluir</button>
                    {busyId === review.id && <span className="self-center text-xs text-muted">Salvando...</span>}
                  </div>
                </article>
              ))}
            </section>
          )}
        </>
      )}
    </main>
  );
}
