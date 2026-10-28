"use client";

import { useState } from "react";

type OrderItem = {
  title: string;
  size: string;
  quantity: number;
  customization?: { name: string; number: string } | null;
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
  tracking_code: string | null;
  created_at: string;
};

const statusLabels: Record<string, string> = {
  pending: "Pagamento pendente",
  approved: "Pagamento aprovado",
  rejected: "Pagamento recusado",
  cancelled: "Cancelado",
  refunded: "Reembolsado",
};

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const date = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" });

function address(customer: Record<string, string>) {
  return [
    `${customer.street ?? ""}, ${customer.number ?? ""}${customer.complement ? `, ${customer.complement}` : ""}`,
    `${customer.neighborhood ?? ""} · ${customer.city ?? ""}/${customer.state ?? ""}`,
    customer.cep ? `CEP ${customer.cep}` : "",
  ].filter(Boolean).join("\n");
}

function itemDescription(item: OrderItem) {
  const options = [
    `Tam. ${item.size}`,
    `${item.quantity} un.`,
    item.customization ? `${item.customization.name} ${item.customization.number}` : "",
    item.patches?.length ? item.patches.map((patch) => `${patch.name} (${patch.position})`).join(", ") : "",
  ].filter(Boolean);
  return `${item.title} · ${options.join(" · ")}`;
}

export default function AdminOrders() {
  const [token, setToken] = useState("");
  const [orders, setOrders] = useState<Order[]>([]);
  const [trackingValues, setTrackingValues] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState("");
  const [message, setMessage] = useState("");
  const [onlyPaid, setOnlyPaid] = useState(true);
  const visibleOrders = onlyPaid ? orders.filter((order) => order.status === "approved") : orders;

  async function load() {
    setMessage("");
    try {
      const response = await fetch("/api/admin/orders", {
        headers: { authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Não foi possível carregar os pedidos.");
      const rows = body.orders as Order[];
      setOrders(rows);
      setTrackingValues(Object.fromEntries(rows.map((order) => [order.id, order.tracking_code ?? ""])));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível carregar os pedidos.");
    }
  }

  async function saveTracking(order: Order) {
    setSavingId(order.id);
    setMessage("");
    try {
      const trackingCode = (trackingValues[order.id] ?? "").trim();
      const response = await fetch("/api/admin/orders", {
        method: "PATCH",
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify({ orderId: order.id, trackingCode }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Não foi possível salvar o rastreio.");
      setOrders((current) => current.map((item) => item.id === order.id ? { ...item, tracking_code: trackingCode || null } : item));
      setMessage(`Rastreio do pedido ${order.id.slice(0, 8).toUpperCase()} salvo.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível salvar o rastreio.");
    } finally {
      setSavingId("");
    }
  }

  function exportCsv() {
    const columns = ["pedido", "data", "nome", "email", "telefone", "endereco", "itens", "frete_centavos", "total_centavos", "status", "rastreio"];
    const quote = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`;
    const rows = visibleOrders.map((order) => [
      order.id,
      order.created_at,
      order.customer.fullName,
      order.customer.email,
      order.customer.phone,
      address(order.customer).replaceAll("\n", ", "),
      order.item_lines.map(itemDescription).join("; "),
      order.shipping_cents,
      order.total_cents,
      statusLabels[order.status] ?? order.status,
      order.tracking_code,
    ].map(quote).join(","));
    const url = URL.createObjectURL(new Blob([`\uFEFF${[columns.join(","), ...rows].join("\r\n")}`], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "pedidos-alves-store.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="mx-auto max-w-7xl px-5 py-10 lg:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[.2em] text-action">Alves Store · administração</p>
          <h1 className="mt-2 text-3xl font-black">Pedidos recentes</h1>
          <p className="mt-2 text-sm text-muted">Acesso protegido pelo token administrativo do servidor.</p>
        </div>
        {orders.length > 0 && <button onClick={exportCsv} className="rounded-lg border border-border px-4 py-2.5 text-xs font-bold hover:bg-paper">Exportar CSV</button>}
      </div>

      <form onSubmit={(event) => { event.preventDefault(); void load(); }} className="mt-6 flex max-w-xl flex-wrap gap-2">
        <label className="sr-only" htmlFor="admin-token">Token administrativo</label>
        <input id="admin-token" type="password" autoComplete="current-password" required value={token} onChange={(event) => setToken(event.target.value)} className="min-w-0 flex-1 rounded-lg border border-border px-4 py-3 text-sm" placeholder="Token administrativo" />
        <button className="rounded-lg bg-ink px-5 py-3 text-xs font-black uppercase text-white">Carregar pedidos</button>
      </form>

      {message && <p role="status" aria-live="polite" className="mt-4 rounded-lg bg-paper px-4 py-3 text-sm">{message}</p>}
      {orders.length > 0 && <label className="mt-4 flex w-fit items-center gap-2 text-xs font-bold"><input type="checkbox" checked={onlyPaid} onChange={(event) => setOnlyPaid(event.target.checked)} />Mostrar só pedidos pagos ({orders.filter((order) => order.status === "approved").length} de {orders.length})</label>}
      {orders.length === 0 ? (
        <div className="mt-6 rounded-xl border border-dashed border-border px-5 py-12 text-center text-sm text-muted">Informe o token e carregue os pedidos recentes.</div>
      ) : visibleOrders.length === 0 ? (
        <div className="mt-6 rounded-xl border border-dashed border-border px-5 py-12 text-center text-sm text-muted">Nenhum pedido pago entre os pedidos recentes. Desmarque o filtro para ver os demais.</div>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-xl border border-border bg-white">
          <table className="w-full min-w-[1120px] border-collapse text-left text-xs">
            <thead className="bg-paper text-[10px] uppercase tracking-wider text-muted">
              <tr>{["Pedido", "Cliente", "Produto / tamanho", "Endereço de entrega", "Valor", "Status", "Código de rastreio"].map((heading) => <th key={heading} className="px-4 py-3 font-black">{heading}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-border">
              {visibleOrders.map((order) => (
                <tr key={order.id} className="align-top hover:bg-paper/50">
                  <td className="whitespace-nowrap px-4 py-4"><span className="font-black">{order.id.slice(0, 8).toUpperCase()}</span><span className="mt-1 block text-[10px] text-muted">{date.format(new Date(order.created_at))}</span></td>
                  <td className="max-w-48 px-4 py-4"><span className="font-bold">{order.customer.fullName}</span><span className="mt-1 block break-all text-[10px] text-muted">{order.customer.email}</span><span className="mt-1 block text-[10px] text-muted">{order.customer.phone}</span></td>
                  <td className="max-w-64 px-4 py-4"><ul className="grid gap-2">{order.item_lines.map((item, index) => <li key={`${item.title}-${index}`} className="leading-5">{itemDescription(item)}</li>)}</ul></td>
                  <td className="max-w-60 whitespace-pre-line px-4 py-4 leading-5 text-muted">{address(order.customer)}</td>
                  <td className="whitespace-nowrap px-4 py-4"><span className="font-black">{money.format(order.total_cents / 100)}</span><span className="mt-1 block text-[10px] text-muted">Frete: {money.format(order.shipping_cents / 100)}</span></td>
                  <td className="px-4 py-4"><span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold ${order.status === "approved" ? "bg-green-50 text-green-700" : "bg-paper text-ink"}`}>{statusLabels[order.status] ?? order.status}</span></td>
                  <td className="min-w-52 px-4 py-4"><label className="sr-only" htmlFor={`tracking-${order.id}`}>Código de rastreio do pedido {order.id.slice(0, 8)}</label><input id={`tracking-${order.id}`} value={trackingValues[order.id] ?? ""} onChange={(event) => setTrackingValues((current) => ({ ...current, [order.id]: event.target.value }))} maxLength={80} disabled={order.status !== "approved"} className="w-full rounded-md border border-border px-3 py-2 disabled:bg-paper disabled:text-muted" placeholder={order.status === "approved" ? "Código de rastreio" : "Disponível após o pagamento"}/><button disabled={order.status !== "approved" || savingId === order.id || (trackingValues[order.id] ?? "") === (order.tracking_code ?? "")} onClick={() => void saveTracking(order)} className="mt-2 rounded-md bg-ink px-3 py-2 text-[10px] font-bold text-white disabled:cursor-not-allowed disabled:opacity-40">{savingId === order.id ? "Salvando…" : "Salvar rastreio"}</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
