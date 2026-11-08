"use client";

import { useEffect, useState } from "react";
import { AdminNavigation } from "@/components/admin-navigation";
import { AdminSkeleton, EmptyState, ErrorState, StatCard, StatusBadge } from "@/components/admin-states";
import { PackageOpen } from "lucide-react";
import { formatCustomization } from "@/lib/customization";
import { adminFetch } from "@/lib/client/admin-fetch";
import { SITE_NAME } from "@/lib/site";
import { isOrderExpired, isOrderPaid, isOrderPending, isOrderRefunded } from "@/lib/order-status";
import { generateOrdersCsv, type OrderFinanceRecord } from "@/lib/finance";

type OrderItem = {
  title: string;
  size: string;
  quantity: number;
  uniformVariation?: string | null;
  customization?: { name?: string; number?: string } | null;
  patches?: { name: string; position: string; priceCents: number }[];
};
type Order = {
  id: string;
  status: string;
  item_lines: OrderItem[];
  customer: Record<string, string>;
  shipping: { label?: string };
  shipping_cents: number;
  total_cents: number;
  promo: string | null;
  valor_desconto: number;
  tracking_code: string | null;
  tracking_url: string | null;
  shipped_at: string | null;
  operational_status: OperationalStatus | null;
  supplier_name: string | null;
  supplier_status: SupplierStatus | null;
  supplier_ordered_at: string | null;
  supplier_cost_cents: number | null;
  shipping_cost_cents: number | null;
  other_expenses_cents: number | null;
  payment_fee_cents?: number | null;
  refunded_cents?: number | null;
  is_test?: boolean | null;
  paid_notified_at?: string | null;
  internal_notes: string | null;
  payment_method_id: string | null;
  payment_type_id: string | null;
  mercado_pago_status: string | null;
  mercado_pago_id: string | null;
  created_at: string;
  updated_at: string;
};

type PaymentEvent = {
  id: string;
  payment_id: string;
  order_id: string | null;
  topic: string | null;
  action: string | null;
  status: string;
  payload: Record<string, unknown>;
  is_orphan: boolean;
  is_divergent: boolean;
  processed: boolean;
  error_message: string | null;
  created_at: string;
};
type OperationalStatus = "aguardando_pagamento" | "pagamento_aprovado" | "aguardando_fornecedor" | "pedido_realizado" | "em_preparacao" | "enviado" | "cancelado" | "divergencia_pagamento" | "expirado";
type SupplierStatus = "nao_solicitado" | "solicitado" | "confirmado" | "em_preparacao" | "recebido" | "cancelado";

const operationalOptions: [OperationalStatus, string][] = [
  ["aguardando_pagamento", "Aguardando pagamento"],
  ["pagamento_aprovado", "Pagamento aprovado"],
  ["aguardando_fornecedor", "Aguardando solicitação ao fornecedor"],
  ["pedido_realizado", "Pedido realizado com fornecedor"],
  ["em_preparacao", "Em preparação"],
  ["enviado", "Enviado"],
  ["cancelado", "Cancelado"],
  ["divergencia_pagamento", "Divergência de pagamento"],
  ["expirado", "Expirado"],
];
const supplierOptions: [SupplierStatus, string][] = [
  ["nao_solicitado", "Não solicitado"],
  ["solicitado", "Solicitado"],
  ["confirmado", "Confirmado"],
  ["em_preparacao", "Em preparação"],
  ["recebido", "Recebido"],
  ["cancelado", "Cancelado"],
];
const statusLabels: Record<string, string> = {
  pending: "Aguardando pagamento",
  pago: "Pagamento aprovado",
  enviado: "Enviado (pedido antigo)",
  approved: "Aprovado",
  rejected: "Recusado",
  cancelled: "Cancelado",
  refunded: "Reembolsado",
  in_process: "Em processamento",
  divergencia_pagamento: "Divergência de pagamento",
  pagamento_recusado: "Pagamento recusado",
  reembolsado: "Reembolsado",
  contestado: "Contestado",
  expirado: "Expirado (> 48h)",
};
const paymentLabels: Record<string, string> = {
  credit_card: "Cartão de crédito",
  debit_card: "Cartão de débito",
  pix: "Pix",
  ticket: "Boleto",
  account_money: "Saldo Mercado Pago",
};
const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const date = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" });
const shortDate = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" });

const isPaid = isOrderPaid;

function getOperationalStatus(order: Order): OperationalStatus {
  if (order.operational_status) return order.operational_status;
  if (isOrderExpired(order)) return "cancelado";
  if (order.status === "cancelled") return "cancelado";
  if (order.status === "enviado") return "enviado";
  if (isPaid(order)) return "aguardando_fornecedor";
  return "aguardando_pagamento";
}

function itemDescription(item: OrderItem) {
  const options = [
    `Tam. ${item.size}`,
    item.uniformVariation ? `Uniforme: ${item.uniformVariation}` : "",
    `${item.quantity} un.`,
    formatCustomization(item.customization),
    item.patches?.length ? item.patches.map((patch) => `${patch.name} (${patch.position})`).join(", ") : "",
  ].filter(Boolean);
  return `${item.title} · ${options.join(" · ")}`;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="grid gap-1 text-[11px] font-bold text-muted">{label}{children}</label>;
}

function OrderOperations({ order, isPartner, onSaved }: { order: Order; isPartner?: boolean; onSaved: () => void }) {
  const [operationalStatus, setOperationalStatus] = useState(getOperationalStatus(order));
  const [supplierStatus, setSupplierStatus] = useState<SupplierStatus>(order.supplier_status ?? "nao_solicitado");
  const [supplierName, setSupplierName] = useState(order.supplier_name ?? "");
  const [supplierOrderedAt, setSupplierOrderedAt] = useState(order.supplier_ordered_at?.slice(0, 10) ?? "");
  const [supplierCost, setSupplierCost] = useState(order.supplier_cost_cents === null || order.supplier_cost_cents === undefined ? "" : String(order.supplier_cost_cents / 100));
  const [paymentFee, setPaymentFee] = useState(order.payment_fee_cents === null || order.payment_fee_cents === undefined ? "" : String(order.payment_fee_cents / 100));
  const [shippingCost, setShippingCost] = useState(order.shipping_cost_cents === null || order.shipping_cost_cents === undefined ? "" : String(order.shipping_cost_cents / 100));
  const [otherExpenses, setOtherExpenses] = useState(order.other_expenses_cents === null || order.other_expenses_cents === undefined ? "" : String(order.other_expenses_cents / 100));
  const [internalNotes, setInternalNotes] = useState(order.internal_notes ?? "");
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState("");

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setFeedback("");
    try {
      const payload: Record<string, unknown> = {
        orderId: order.id,
        action: "update_operations",
        operationalStatus,
        supplierName,
        supplierStatus,
        supplierOrderedAt: supplierOrderedAt ? new Date(`${supplierOrderedAt}T12:00:00.000Z`).toISOString() : null,
        internalNotes,
      };

      if (!isPartner) {
        payload.supplierCost = supplierCost === "" ? null : Number(supplierCost);
        payload.paymentFee = paymentFee === "" ? null : Number(paymentFee);
        payload.shippingCost = shippingCost === "" ? null : Number(shippingCost);
        payload.otherExpenses = otherExpenses === "" ? null : Number(otherExpenses);
      }

      const response = await adminFetch("/api/admin/orders", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Não foi possível salvar as informações.");
      setFeedback("Informações do pedido salvas com sucesso.");
      onSaved();
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Não foi possível salvar as informações.");
    } finally {
      setSaving(false);
    }
  }

  const hasCost = supplierCost !== "";
  const revenueCents = isPaid(order) ? Math.max(0, order.total_cents - (order.refunded_cents || 0)) : 0;
  const totalDeductionsCents = (hasCost ? Math.round(Number(supplierCost) * 100) : 0)
    + (paymentFee !== "" ? Math.round(Number(paymentFee) * 100) : 0)
    + (shippingCost !== "" ? Math.round(Number(shippingCost) * 100) : 0)
    + (otherExpenses !== "" ? Math.round(Number(otherExpenses) * 100) : 0);

  return (
    <details className="mt-2">
      <summary className="cursor-pointer rounded-md border border-border px-3 py-2 text-[10px] font-bold">
        Fornecedor, andamento {isPartner ? "" : "e financeiro"}
      </summary>
      <form onSubmit={(event) => void save(event)} className="mt-3 grid gap-3 rounded-lg bg-paper p-3 sm:grid-cols-2">
        <Field label="Andamento do pedido">
          <select value={operationalStatus} onChange={(event) => setOperationalStatus(event.target.value as OperationalStatus)} className="rounded border border-border bg-white px-2 py-2 text-ink">
            {operationalOptions.filter(([value]) => value !== "enviado" || operationalStatus === "enviado").map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </Field>
        <Field label="Status da solicitação ao fornecedor">
          <select value={supplierStatus} onChange={(event) => setSupplierStatus(event.target.value as SupplierStatus)} className="rounded border border-border bg-white px-2 py-2 text-ink">
            {supplierOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </Field>
        <Field label="Fornecedor">
          <input value={supplierName} maxLength={160} onChange={(event) => setSupplierName(event.target.value)} className="rounded border border-border bg-white px-2 py-2 text-ink" />
        </Field>
        <Field label="Data solicitada ao fornecedor">
          <input type="date" value={supplierOrderedAt} onChange={(event) => setSupplierOrderedAt(event.target.value)} className="rounded border border-border bg-white px-2 py-2 text-ink" />
        </Field>
        {!isPartner && (
          <>
            <Field label="Custo do fornecedor (R$)">
              <input type="number" inputMode="decimal" min="0" max="100000" step="0.01" value={supplierCost} onChange={(event) => setSupplierCost(event.target.value)} className="rounded border border-border bg-white px-2 py-2 text-ink" placeholder="Ex: 55.00" />
            </Field>
            <Field label="Taxa Mercado Pago (R$)">
              <input type="number" inputMode="decimal" min="0" max="100000" step="0.01" value={paymentFee} onChange={(event) => setPaymentFee(event.target.value)} className="rounded border border-border bg-white px-2 py-2 text-ink" placeholder="Ex: 1.45" />
            </Field>
            <Field label="Custo de frete (R$)">
              <input type="number" inputMode="decimal" min="0" max="100000" step="0.01" value={shippingCost} onChange={(event) => setShippingCost(event.target.value)} className="rounded border border-border bg-white px-2 py-2 text-ink" />
            </Field>
            <Field label="Outras despesas (R$)">
              <input type="number" inputMode="decimal" min="0" max="100000" step="0.01" value={otherExpenses} onChange={(event) => setOtherExpenses(event.target.value)} className="rounded border border-border bg-white px-2 py-2 text-ink" />
            </Field>
          </>
        )}
        <Field label="Observações internas">
          <textarea maxLength={4000} rows={2} value={internalNotes} onChange={(event) => setInternalNotes(event.target.value)} className="rounded border border-border bg-white px-2 py-2 text-ink" />
        </Field>
        <div className="sm:col-span-2">
          {!isPartner && (
            <p className="text-[11px] text-muted">
              Lucro estimado: <strong>{hasCost && isPaid(order) ? money.format((revenueCents - totalDeductionsCents) / 100) : "—"}</strong>
              {(!hasCost || !isPaid(order)) ? " · informe o custo do fornecedor para calcular o lucro." : " · faturamento líquido menos despesas registradas."}
            </p>
          )}
          <button disabled={saving} className="mt-2 rounded-md bg-ink px-3 py-2 text-[10px] font-bold text-white disabled:opacity-50">{saving ? "Salvando..." : "Salvar operação"}</button>
          {feedback && <p role="status" className="mt-2 text-[11px] font-bold">{feedback}</p>}
        </div>
      </form>
    </details>
  );
}

export default function AdminOrders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [paymentEvents, setPaymentEvents] = useState<PaymentEvent[]>([]);
  const [trackingValues, setTrackingValues] = useState<Record<string, string>>({});
  const [trackingUrls, setTrackingUrls] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState("");
  const [reconcilingId, setReconcilingId] = useState("");
  const [togglingTestId, setTogglingTestId] = useState("");
  const [resendingNoticeId, setResendingNoticeId] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [isPartner, setIsPartner] = useState(false);
  const [filter, setFilter] = useState<"paid" | "pending" | "expired" | "test" | "all">("paid");

  const testOrders = orders.filter((order) => order.is_test === true);
  const nonTestOrders = orders.filter((order) => !order.is_test);
  const paidOrders = nonTestOrders.filter(isOrderPaid);
  const pendingOrders = nonTestOrders.filter((order) => isOrderPending(order));
  const expiredOrders = nonTestOrders.filter((order) => isOrderExpired(order));
  const divergentOrders = orders.filter((order) => order.status === "divergencia_pagamento" || order.operational_status === "divergencia_pagamento");
  const orphanEvents = paymentEvents.filter((event) => event.is_orphan || !event.order_id);

  const visibleOrders = filter === "paid"
    ? paidOrders
    : filter === "pending"
      ? pendingOrders
      : filter === "expired"
        ? expiredOrders
        : filter === "test"
          ? testOrders
          : orders;

  async function load() {
    setLoading(true);
    setLoadError("");
    try {
      const response = await adminFetch("/api/admin/orders", { cache: "no-store" });
      const body = await response.json();
      if (response.status === 401) {
        setLoadError("Sua sessão expirou. Entre novamente.");
        return;
      }
      if (!response.ok) throw new Error(body.error ?? "Não foi possível carregar os pedidos.");
      const rows = (body.orders ?? []) as Order[];
      const events = (body.paymentEvents ?? []) as PaymentEvent[];
      setOrders(rows);
      setPaymentEvents(events);
      setIsPartner(body.isPartner === true);
      setTrackingValues(Object.fromEntries(rows.map((order) => [order.id, order.tracking_code ?? ""])));
      setTrackingUrls(Object.fromEntries(rows.map((order) => [order.id, order.tracking_url ?? ""])));
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Não foi possível carregar os pedidos.");
    } finally {
      setLoading(false);
    }
  }

  async function reconcileOrder(orderId: string) {
    setReconcilingId(orderId);
    setMessage("");
    try {
      const response = await adminFetch("/api/admin/orders", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ orderId, action: "reconcile" }),
      });
      const body = await response.json();
      if (response.status === 401) {
        setLoadError("Sua sessão expirou. Entre novamente.");
        return;
      }
      if (!response.ok) throw new Error(body.error ?? "Não foi possível consultar o Mercado Pago.");
      setMessage(body.message ?? "Consulta ao Mercado Pago finalizada.");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Falha ao consultar Mercado Pago.");
    } finally {
      setReconcilingId("");
    }
  }

  async function toggleTest(order: Order) {
    setTogglingTestId(order.id);
    setMessage("");
    try {
      const nextIsTest = !order.is_test;
      const response = await adminFetch("/api/admin/orders", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ orderId: order.id, action: "toggle_test", isTest: nextIsTest }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Não foi possível alterar o pedido.");
      setOrders((current) => current.map((item) => item.id === order.id ? { ...item, is_test: nextIsTest } : item));
      setMessage(body.message ?? (nextIsTest ? "Pedido marcado como teste." : "Pedido removido dos testes."));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Erro ao alterar pedido.");
    } finally {
      setTogglingTestId("");
    }
  }

  async function resendNotice(orderId: string) {
    setResendingNoticeId(orderId);
    setMessage("");
    try {
      const response = await adminFetch("/api/admin/orders", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ orderId, action: "resend_notification" }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Não foi possível reenviar o aviso.");
      setMessage(body.message ?? "Aviso reenviado!");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Falha ao reenviar aviso.");
    } finally {
      setResendingNoticeId("");
    }
  }

  useEffect(() => { void load(); }, []);

  async function saveShipping(order: Order) {
    setSavingId(order.id);
    setMessage("");
    try {
      const trackingCode = (trackingValues[order.id] ?? "").trim();
      const trackingUrl = (trackingUrls[order.id] ?? "").trim();
      const response = await adminFetch("/api/admin/orders", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ orderId: order.id, action: "save_shipping", trackingCode, trackingUrl }),
      });
      const body = await response.json();
      if (response.status === 401) {
        setLoadError("Sua sessão expirou. Entre novamente.");
        return;
      }
      if (!response.ok) throw new Error(body.error ?? "Não foi possível salvar o rastreio.");
      setOrders((current) => current.map((item) => item.id === order.id
        ? { ...item, tracking_code: trackingCode || null, tracking_url: trackingUrl || null }
        : item));
      setMessage(body.message ?? "Informações de rastreamento salvas.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível salvar o rastreio.");
    } finally {
      setSavingId("");
    }
  }

  async function markAsShipped(order: Order) {
    setSavingId(order.id);
    setMessage("");
    try {
      const response = await adminFetch("/api/admin/orders", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ orderId: order.id, action: "mark_shipped" }),
      });
      const body = await response.json();
      if (response.status === 401) {
        setLoadError("Sua sessão expirou. Entre novamente.");
        return;
      }
      if (!response.ok) throw new Error(body.error ?? "Não foi possível marcar o pedido como enviado.");
      setOrders((current) => current.map((item) => item.id === order.id
        ? { ...item, operational_status: "enviado", shipped_at: new Date().toISOString() }
        : item));
      setMessage(body.message ?? `Pedido ${order.id.slice(0, 8).toUpperCase()} marcado como enviado.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível marcar o pedido como enviado.");
    } finally {
      setSavingId("");
    }
  }

  function exportCsv() {
    const csvContent = generateOrdersCsv(visibleOrders as unknown as OrderFinanceRecord[], "all");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `pedidos-imports-alves-${filter}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="mx-auto max-w-7xl px-5 py-10 lg:px-8">
      <AdminNavigation current="orders" />
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[.2em] text-action">{SITE_NAME} · Administração</p>
          <h1 className="mt-2 text-3xl font-black">Pedidos recentes</h1>
          <p className="mt-2 text-sm text-muted">Pagamento é acompanhado separadamente do andamento operacional.</p>
        </div>
        {orders.length > 0 && <button onClick={exportCsv} className="rounded-lg border border-border px-4 py-2.5 text-xs font-bold hover:bg-paper">Exportar CSV</button>}
      </header>
      {loading ? (
        <AdminSkeleton cards={4} />
      ) : loadError ? (
        <div className="mt-8"><ErrorState message={loadError} onRetry={() => void load()} /></div>
      ) : <>
      <section className="mt-7 grid gap-3 sm:grid-cols-3">
        <StatCard label="Pagamentos aprovados" value={String(paidOrders.length)} icon={PackageOpen} detail="Vendas confirmadas" />
        <StatCard label="Aguardando pagamento" value={String(pendingOrders.length)} detail="Pendentes recentes (≤ 48h)" />
        <StatCard label="Expirados" value={String(expiredOrders.length)} detail="Abandonos de checkout (> 48h)" />
      </section>
      {message && <p role="status" aria-live="polite" className="mt-4 rounded-lg bg-paper px-4 py-3 text-sm">{message}</p>}

      {orphanEvents.length > 0 && (
        <section className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-4 text-xs text-amber-950">
          <div className="flex items-center gap-2 text-sm font-bold text-amber-900">
            <span>⚠️ Pagamentos sem pedido correspondente (órfãos): {orphanEvents.length}</span>
          </div>
          <p className="mt-1 text-muted">
            Pagamentos recebidos no Mercado Pago cujo número de referência (external_reference) não foi encontrado no Supabase:
          </p>
          <div className="mt-3 overflow-x-auto rounded-lg border border-amber-200 bg-white p-2">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-border text-[10px] uppercase text-muted">
                  <th className="px-2 py-1">ID Pagamento</th>
                  <th className="px-2 py-1">Data / Hora</th>
                  <th className="px-2 py-1">Status MP</th>
                  <th className="px-2 py-1">Valor</th>
                  <th className="px-2 py-1">Detalhes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {orphanEvents.map((evt) => (
                  <tr key={evt.id}>
                    <td className="px-2 py-2 font-mono font-bold">{evt.payment_id}</td>
                    <td className="px-2 py-2">{date.format(new Date(evt.created_at))}</td>
                    <td className="px-2 py-2 font-bold text-amber-700">{evt.status}</td>
                    <td className="px-2 py-2 font-bold">
                      {evt.payload && typeof evt.payload.transaction_amount === "number"
                        ? money.format(evt.payload.transaction_amount)
                        : "—"}
                    </td>
                    <td className="px-2 py-2 text-[10px] text-muted">{evt.error_message ?? "Verifique no painel do Mercado Pago"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {divergentOrders.length > 0 && (
        <section className="mt-4 rounded-xl border border-red-300 bg-red-50 p-4 text-xs text-red-950">
          <div className="flex items-center gap-2 text-sm font-bold text-red-900">
            <span>⚠️ Pedidos com divergência de pagamento: {divergentOrders.length}</span>
          </div>
          <p className="mt-1 text-muted">
            O valor recebido difere do total do pedido. A confirmação foi bloqueada para revisão da equipe:
          </p>
          <ul className="mt-2 list-disc pl-5">
            {divergentOrders.map((ord) => (
              <li key={ord.id} className="py-0.5">
                Pedido <strong>{ord.id.slice(0, 8).toUpperCase()}</strong> ({ord.customer.fullName}): esperado {money.format(ord.total_cents / 100)}.
              </li>
            ))}
          </ul>
        </section>
      )}
      {orders.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setFilter("paid")}
            className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${filter === "paid" ? "bg-ink text-white" : "border border-border bg-white text-muted hover:text-ink"}`}
          >
            Pagos / Aprovados ({paidOrders.length})
          </button>
          <button
            type="button"
            onClick={() => setFilter("pending")}
            className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${filter === "pending" ? "bg-ink text-white" : "border border-border bg-white text-muted hover:text-ink"}`}
          >
            Aguardando pagamento ({pendingOrders.length})
          </button>
          <button
            type="button"
            onClick={() => setFilter("expired")}
            className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${filter === "expired" ? "bg-ink text-white" : "border border-border bg-white text-muted hover:text-ink"}`}
          >
            Expirados ({expiredOrders.length})
          </button>
          <button
            type="button"
            onClick={() => setFilter("test")}
            className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${filter === "test" ? "bg-ink text-white" : "border border-border bg-white text-muted hover:text-ink"}`}
          >
            Testes ({testOrders.length})
          </button>
          <button
            type="button"
            onClick={() => setFilter("all")}
            className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${filter === "all" ? "bg-ink text-white" : "border border-border bg-white text-muted hover:text-ink"}`}
          >
            Todos ({orders.length})
          </button>
        </div>
      )}
      {orders.length === 0 ? (
        <div className="mt-6"><EmptyState icon={PackageOpen} title="Ainda não há pedidos" description="Os pedidos novos aparecerão aqui assim que um cliente finalizar o checkout." /></div>
      ) : visibleOrders.length === 0 ? (
        <div className="mt-6"><EmptyState icon={PackageOpen} title="Nenhum pedido nesta categoria" description="Selecione outra aba acima para visualizar os demais pedidos." /></div>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-xl border border-border bg-white">
          <table className="w-full min-w-[1350px] border-collapse text-left text-xs">
            <thead className="bg-paper text-[10px] uppercase tracking-wider text-muted">
              <tr>{["Pedido", "Cliente", "Produtos / tamanhos", "Endereço de entrega", "Valor pago", "Pagamento", "Andamento / gestão", "Envio e rastreamento"].map((heading) => <th key={heading} className="px-4 py-3 font-black">{heading}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-border">
              {visibleOrders.map((order) => {
                const operationalStatus = getOperationalStatus(order);
                const operationalLabel = operationalOptions.find(([value]) => value === operationalStatus)?.[1] ?? operationalStatus;
                const paymentStatus = order.mercado_pago_status ?? order.status;
                const trackingUrl = order.tracking_url || (order.tracking_code ? `https://rastreamento.correios.com.br/app/index.php?codigo=${encodeURIComponent(order.tracking_code)}` : "");
                return (
                  <tr key={order.id} className={`align-top hover:bg-paper/50 ${order.is_test ? "bg-amber-50/40" : ""}`}>
                    <td className="whitespace-nowrap px-4 py-4">
                      <div className="flex items-center gap-1.5">
                        <span className="font-black">{order.id.slice(0, 8).toUpperCase()}</span>
                        {order.is_test && (
                          <span className="rounded bg-amber-200 px-1 py-0.5 text-[9px] font-black text-amber-900">TESTE</span>
                        )}
                      </div>
                      <span className="mt-1 block text-[10px] text-muted">{date.format(new Date(order.created_at))}</span>
                      {isPaid(order) && !order.is_test && (
                        <div className="mt-1.5">
                          {order.paid_notified_at ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700">
                              ✓ Aviso enviado
                            </span>
                          ) : (
                            <div className="flex flex-col items-start gap-1">
                              <span className="inline-flex items-center rounded border border-amber-300 bg-amber-100 px-1.5 py-0.5 text-[10px] font-black text-amber-900">
                                Aviso pendente
                              </span>
                              <button
                                type="button"
                                disabled={resendingNoticeId === order.id}
                                onClick={() => void resendNotice(order.id)}
                                className="text-[10px] font-bold text-blue-700 underline hover:text-blue-900 disabled:opacity-50"
                              >
                                {resendingNoticeId === order.id ? "Enviando..." : "Reenviar aviso"}
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                      {!isPartner && (
                        <button
                          type="button"
                          disabled={togglingTestId === order.id}
                          onClick={() => void toggleTest(order)}
                          className="mt-1 block text-[10px] text-muted underline hover:text-ink disabled:opacity-50"
                        >
                          {order.is_test ? "Remover teste" : "Marcar teste"}
                        </button>
                      )}
                    </td>
                    <td className="max-w-48 px-4 py-4"><span className="font-bold">{order.customer.fullName}</span><span className="mt-1 block break-all text-[10px] text-muted">{order.customer.email}</span><span className="mt-1 block text-[10px] text-muted">{order.customer.phone}</span></td>
                    <td className="max-w-64 px-4 py-4"><ul className="grid gap-2">{order.item_lines.map((item, index) => <li key={`${item.title}-${index}`} className="leading-5">{itemDescription(item)}</li>)}</ul>{order.promo === "BF-NBA-2026" && <p className="mt-2 text-[10px] font-bold text-blue-700">Promo Black Friday NBA · desconto {money.format(order.valor_desconto)}</p>}</td>
                    <td className="max-w-60 whitespace-pre-line px-4 py-4 leading-5 text-muted">{order.customer.street ? `${order.customer.street}, ${order.customer.number ?? ""}\n${order.customer.neighborhood ?? ""} · ${order.customer.city ?? ""}/${order.customer.state ?? ""}\nCEP ${order.customer.cep ?? ""}` : "—"}</td>
                    <td className="whitespace-nowrap px-4 py-4">
                      <span className="font-black">{isPaid(order) ? money.format(order.total_cents / 100) : "Não pago"}</span>
                      {order.refunded_cents ? (
                        <span className="mt-1 block text-[10px] font-bold text-red-600">Reembolso: {money.format(order.refunded_cents / 100)}</span>
                      ) : null}
                      <span className="mt-1 block text-[10px] text-muted">{isPaid(order) ? `Frete cobrado: ${money.format(order.shipping_cents / 100)}` : `Total: ${money.format(order.total_cents / 100)}`}</span>
                    </td>
                    <td className="px-4 py-4">
                      <span className="font-bold">{isOrderRefunded(order) ? "Reembolsado" : (statusLabels[paymentStatus] ?? paymentStatus)}</span>
                      <span className="mt-1 block text-[10px] text-muted">{paymentLabels[order.payment_type_id ?? ""] ?? paymentLabels[order.payment_method_id ?? ""] ?? order.payment_method_id ?? "Forma não informada"}</span>
                      {order.mercado_pago_id && <span className="mt-1 block font-mono text-[10px] text-muted">ID MP: {order.mercado_pago_id}</span>}
                      {(() => {
                        const orderEvents = paymentEvents.filter((evt) => evt.order_id === order.id || (order.mercado_pago_id && evt.payment_id === order.mercado_pago_id));
                        if (!orderEvents.length) return null;
                        return (
                          <details className="mt-2">
                            <summary className="cursor-pointer text-[10px] font-bold text-muted hover:text-ink">
                              Eventos recebidos ({orderEvents.length})
                            </summary>
                            <ul className="mt-1 space-y-1 rounded border border-border bg-paper/60 p-2 text-[10px]">
                              {orderEvents.map((evt) => (
                                <li key={evt.id} className="border-b border-border/40 pb-1 last:border-0 last:pb-0">
                                  <span className="font-bold">{evt.status}</span> · {shortDate.format(new Date(evt.created_at))}
                                  {evt.error_message && <span className="block text-red-600">{evt.error_message}</span>}
                                </li>
                              ))}
                            </ul>
                          </details>
                        );
                      })()}
                      {!isPaid(order) && (
                        <button
                          type="button"
                          disabled={reconcilingId === order.id}
                          onClick={() => void reconcileOrder(order.id)}
                          className="mt-2 inline-flex items-center gap-1 rounded border border-border bg-paper px-2 py-1 text-[10px] font-bold text-ink hover:bg-zinc-200 disabled:opacity-50"
                        >
                          {reconcilingId === order.id ? "Consultando..." : "Verificar no Mercado Pago"}
                        </button>
                      )}
                    </td>
                    <td className="min-w-72 px-4 py-4">
                      <StatusBadge tone={operationalStatus === "enviado" ? "green" : operationalStatus === "cancelado" ? "red" : operationalStatus === "aguardando_fornecedor" ? "amber" : "neutral"}>{operationalLabel}</StatusBadge>
                      {order.supplier_name && <span className="mt-1 block text-[10px] text-muted">Fornecedor: {order.supplier_name}</span>}
                      <OrderOperations key={`${order.id}-${order.updated_at}-${order.operational_status}`} order={order} isPartner={isPartner} onSaved={() => void load()} />
                    </td>
                    <td className="min-w-56 px-4 py-4">
                      <label className="sr-only" htmlFor={`tracking-${order.id}`}>Código de rastreio do pedido {order.id.slice(0, 8)}</label>
                      <input id={`tracking-${order.id}`} value={trackingValues[order.id] ?? ""} onChange={(event) => setTrackingValues((current) => ({ ...current, [order.id]: event.target.value }))} maxLength={80} disabled={!isPaid(order)} className="w-full rounded-md border border-border px-3 py-2 disabled:bg-paper disabled:text-muted" placeholder={isPaid(order) ? "Código de rastreio" : "Disponível após o pagamento"} />
                      <label className="sr-only" htmlFor={`tracking-url-${order.id}`}>Link de rastreamento</label>
                      <input id={`tracking-url-${order.id}`} type="url" value={trackingUrls[order.id] ?? ""} onChange={(event) => setTrackingUrls((current) => ({ ...current, [order.id]: event.target.value }))} disabled={!isPaid(order)} className="mt-2 w-full rounded-md border border-border px-3 py-2 disabled:bg-paper disabled:text-muted" placeholder="Link dos Correios (opcional)" />
                      <button disabled={!isPaid(order) || savingId === order.id} onClick={() => void saveShipping(order)} className="mt-2 rounded-md bg-ink px-3 py-2 text-[10px] font-bold text-white disabled:cursor-not-allowed disabled:opacity-40">{savingId === order.id ? "Salvando..." : "Salvar rastreamento"}</button>
                      {order.tracking_code && <button disabled={savingId === order.id || operationalStatus === "enviado"} onClick={() => void markAsShipped(order)} className="ml-2 mt-2 rounded-md border border-ink px-3 py-2 text-[10px] font-bold disabled:opacity-40">{operationalStatus === "enviado" ? "Pedido enviado" : "Marcar como enviado"}</button>}
                      {order.tracking_code && <span className="mt-2 block text-[10px] text-muted">{order.tracking_code}{order.shipped_at ? ` · enviado ${shortDate.format(new Date(order.shipped_at))}` : ""}</span>}
                      {trackingUrl && <a href={trackingUrl} target="_blank" rel="noreferrer" className="mt-1 inline-block text-[10px] font-bold underline">Abrir rastreamento</a>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      </>}
    </main>
  );
}
