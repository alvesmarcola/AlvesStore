"use client";

import { useState } from "react";
import { PackageCheck } from "lucide-react";

type TrackedOrder = { code: string; status: string; trackingCode: string | null; shipping: string; createdAt: string };
const statusLabels: Record<string, string> = { approved: "Pagamento aprovado", pending: "Pagamento pendente", rejected: "Pagamento recusado", cancelled: "Pedido cancelado", refunded: "Pagamento reembolsado" };

export default function TrackingPage() {
  const [order, setOrder] = useState<TrackedOrder | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  async function search(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setLoading(true); setOrder(null); setError("");
    const data = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/orders/track", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ code: data.get("code"), contact: data.get("contact") }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Não foi possível consultar o pedido.");
      setOrder(result.order as TrackedOrder);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Não foi possível consultar o pedido."); }
    finally { setLoading(false); }
  }
  return <main className="mx-auto max-w-2xl px-5 py-12"><div className="rounded-xl border border-border p-6 sm:p-9"><span className="grid h-12 w-12 place-items-center rounded-full bg-action-soft text-blue-700"><PackageCheck /></span><h1 className="mt-4 text-3xl font-black">Rastreie seu pedido</h1><p className="mt-2 text-sm leading-6 text-muted">Informe o código do pedido (enviado por e-mail e mostrado após o pagamento) e o e-mail ou CPF usado na compra.</p><form onSubmit={search} className="mt-6 grid gap-3"><label className="text-xs font-bold">Código do pedido<input name="code" required minLength={8} maxLength={36} placeholder="Ex.: A1B2C3D4" autoCapitalize="characters" autoComplete="off" className="mt-1 w-full rounded-lg border border-border px-4 py-3 text-sm" /></label><label className="text-xs font-bold">E-mail ou CPF<input name="contact" required className="mt-1 w-full rounded-lg border border-border px-4 py-3 text-sm" /></label><button disabled={loading} className="rounded-lg bg-ink px-5 py-3 text-xs font-black uppercase text-white disabled:opacity-50">{loading ? "Consultando…" : "Consultar pedido"}</button></form>{error && <p role="status" className="mt-5 rounded-lg bg-paper p-4 text-sm">{error}</p>}{order && <section className="mt-6 rounded-lg bg-paper p-5" aria-live="polite"><h2 className="font-black">Pedido {order.code}</h2><p className="mt-2 text-sm">Status: {statusLabels[order.status] ?? order.status}</p><p className="mt-1 text-sm">Frete: {order.shipping}</p>{order.trackingCode ? <p className="mt-1 text-sm">Código de rastreio: <strong>{order.trackingCode}</strong></p> : <p className="mt-2 text-sm text-muted">O fornecedor ainda não informou o código de rastreio.</p>}</section>}</div></main>;
}
