"use client";

import type { FormEvent, ReactNode } from "react";
import {
  AlertTriangle,
  Inbox,
  KeyRound,
  LoaderCircle,
  type LucideIcon,
} from "lucide-react";

export function LockedState({
  token,
  onTokenChange,
  onSubmit,
  loading,
  message,
}: {
  token: string;
  onTokenChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  loading: boolean;
  message?: string;
}) {
  return (
    <section className="mx-auto mt-10 w-full max-w-md rounded-2xl border border-border bg-white p-6 text-center shadow-sm sm:p-8">
      <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-paper text-ink"><KeyRound size={25} /></span>
      <h2 className="mt-4 text-xl font-black">Acesso restrito</h2>
      <p className="mt-2 text-sm leading-6 text-muted">Informe seu token administrativo para acessar os dados privados da loja.</p>
      <form onSubmit={onSubmit} className="mt-5 grid gap-3 text-left">
        <label htmlFor="admin-access-token" className="text-xs font-bold">Token administrativo</label>
        <input
          id="admin-access-token"
          type="password"
          autoComplete="current-password"
          required
          value={token}
          onChange={(event) => onTokenChange(event.target.value)}
          className="min-h-12 rounded-lg border border-border px-4 py-3 text-sm outline-none focus:border-ink focus:ring-2 focus:ring-ink/10"
          placeholder="Digite o token"
        />
        {message && <p role="alert" className="text-xs leading-5 text-red-700">{message}</p>}
        <button disabled={loading} className="min-h-12 rounded-lg bg-ink px-5 py-3 text-sm font-bold text-white transition hover:bg-ink/90 disabled:opacity-50">
          {loading ? "Verificando..." : "Acessar painel"}
        </button>
      </form>
    </section>
  );
}

export function AdminSkeleton({ cards = 3 }: { cards?: number }) {
  return (
    <div aria-label="Carregando" aria-busy="true" className="mt-8 animate-pulse space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: cards }).map((_, index) => <div key={index} className="h-28 rounded-xl border border-border bg-white p-5"><div className="h-3 w-24 rounded bg-zinc-200" /><div className="mt-5 h-7 w-32 rounded bg-zinc-200" /></div>)}
      </div>
      <div className="h-64 rounded-xl border border-border bg-white p-5">
        <div className="h-4 w-40 rounded bg-zinc-200" />
        <div className="mt-6 grid gap-3">{[1, 2, 3].map((row) => <div key={row} className="h-10 rounded bg-zinc-100" />)}</div>
      </div>
    </div>
  );
}

export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
}: {
  icon?: LucideIcon;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-dashed border-border bg-white px-5 py-12 text-center">
      <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-paper text-muted"><Icon size={22} /></span>
      <h2 className="mt-4 text-base font-black">{title}</h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted">{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </section>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <section role="alert" className="rounded-2xl border border-red-200 bg-white px-5 py-8 text-center">
      <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-red-50 text-red-700"><AlertTriangle size={22} /></span>
      <h2 className="mt-4 text-base font-black">Não foi possível carregar</h2>
      <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-muted">{message}</p>
      <button type="button" onClick={onRetry} className="mt-4 min-h-11 rounded-lg bg-ink px-5 py-2.5 text-sm font-bold text-white">Tentar novamente</button>
    </section>
  );
}

export function StatCard({ label, value, detail, icon: Icon }: { label: string; value: string; detail?: string; icon?: LucideIcon }) {
  return (
    <article className="rounded-xl border border-border bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[10px] font-black uppercase tracking-wider text-muted">{label}</p>
        {Icon && <Icon aria-hidden="true" size={18} className="shrink-0 text-muted" />}
      </div>
      <p className="mt-2 text-2xl font-black tabular-nums">{value}</p>
      {detail && <p className="mt-1 text-[11px] leading-5 text-muted">{detail}</p>}
    </article>
  );
}

export function StatusBadge({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "green" | "amber" | "red" | "blue" }) {
  const styles = {
    neutral: "bg-paper text-ink",
    green: "bg-green-50 text-green-800",
    amber: "bg-amber-50 text-amber-800",
    red: "bg-red-50 text-red-800",
    blue: "bg-blue-50 text-blue-800",
  };
  return <span className={`inline-flex min-h-6 items-center rounded-full px-2.5 py-1 text-[10px] font-bold ${styles[tone]}`}>{children}</span>;
}

export function LoadingLabel({ children }: { children: ReactNode }) {
  return <span className="inline-flex items-center gap-2"><LoaderCircle size={14} className="animate-spin" />{children}</span>;
}
