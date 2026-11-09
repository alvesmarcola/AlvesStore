"use client";

import { useState } from "react";
import { PackageCheck } from "lucide-react";

type TrackedOrder = { code: string; status: string; operationalStatus: string | null; trackingCode: string | null; trackingUrl: string | null };
const paymentStatusLabels: Record<string, string> = { pago: "Pagamento confirmado", enviado: "Pagamento confirmado", approved: "Pagamento aprovado", pending: "Pagamento pendente", rejected: "Pagamento recusado", cancelled: "Pedido cancelado", refunded: "Pagamento reembolsado" };
const operationalStatusLabels: Record<string, string> = { aguardando_pagamento: "Aguardando pagamento", pagamento_aprovado: "Pagamento aprovado", aguardando_fornecedor: "Aguardando preparação do fornecedor", pedido_realizado: "Pedido realizado com fornecedor", em_preparacao: "Em preparação", enviado: "Enviado pelos Correios", cancelado: "Cancelado" };

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
  return <main className="mx-auto max-w-2xl px-5 py-12"><div className="rounded-xl border border-border p-6 sm:p-9"><span className="grid h-12 w-12 place-items-center rounded-full bg-action-soft text-blue-700"><PackageCheck /></span><h1 className="mt-4 text-3xl font-bold tracking-tight">Rastreie seu pedido</h1><section className="mt-4 rounded-lg border border-blue-200/70 bg-blue-50/70 p-4 text-sm leading-6 text-blue-950" aria-labelledby="tracking-processing-title"><h2 id="tracking-processing-title" className="font-bold">Atenção ao prazo de processamento</h2><p className="mt-1">Após a confirmação do pagamento, seu pedido é encaminhado para processamento junto ao fornecedor. Como trabalhamos com produtos sob encomenda e envio direto do fornecedor, o código oficial de rastreamento normalmente fica disponível em 3 a 4 dias úteis.</p><p className="mt-2">Assim que estiver disponível, você poderá acompanhar seu pedido nesta página.</p><p className="mt-2 font-medium">O prazo de processamento não representa o prazo total de entrega.</p></section><p className="mt-4 text-sm leading-6 text-muted">Informe o código interno do pedido (enviado por e-mail e mostrado após o pagamento, não o código de rastreamento) e o e-mail ou CPF usado na compra.</p><form onSubmit={search} className="mt-6 grid gap-3"><label className="text-xs font-bold">Código interno do pedido<input name="code" required minLength={8} maxLength={36} placeholder="Ex.: A1B2C3D4" autoCapitalize="characters" autoComplete="off" className="mt-1 w-full min-h-[44px] rounded-lg border border-border px-4 py-2.5 text-base sm:text-sm" /></label><label className="text-xs font-bold">E-mail ou CPF<input name="contact" required className="mt-1 w-full min-h-[44px] rounded-lg border border-border px-4 py-2.5 text-base sm:text-sm" /></label><button disabled={loading} className="min-h-[44px] rounded-lg bg-ink px-5 py-3 text-xs font-bold uppercase text-white disabled:opacity-50">{loading ? "Consultando…" : "Consultar pedido"}</button></form>{error && <p role="status" className="mt-5 rounded-lg bg-paper p-4 text-sm">{error}</p>}{order && <section className="mt-6 rounded-lg bg-paper p-5" aria-live="polite"><h2 className="font-bold">Pedido {order.code}</h2><p className="mt-2 text-sm">Pagamento: {paymentStatusLabels[order.status] ?? order.status}</p><p className="mt-1 text-sm">Andamento: {operationalStatusLabels[order.operationalStatus ?? ""] ?? (order.status === "enviado" ? "Enviado pelos Correios" : "Em atualização")}</p>{order.trackingCode ? <><p className="mt-1 text-sm">Código oficial de rastreamento: <strong>{order.trackingCode}</strong></p><a href={order.trackingUrl || `https://rastreamento.correios.com.br/app/index.php?codigo=${encodeURIComponent(order.trackingCode)}`} target="_blank" rel="noreferrer" className="mt-2 inline-block text-sm font-bold underline">Acompanhar nos Correios</a></> : <p className="mt-2 text-sm text-muted">O código oficial de rastreamento está sendo preparado e será atualizado em breve.</p>}</section>}</div></main>;
}
