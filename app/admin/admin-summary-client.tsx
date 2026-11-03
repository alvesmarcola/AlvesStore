"use client";

import { useState } from "react";
import { AdminNavigation, type AdminSection } from "@/components/admin-navigation";

type Summary = {
  metrics: {
    orderCount: number;
    paidOrderCount: number;
    awaitingSupplierCount: number;
    shippedOrderCount: number;
    revenueCents: number;
    supplierCostCents: number;
    shippingCostCents: number;
    otherExpensesCents: number;
    estimatedProfitCents: number;
  };
  orders: {
    id: string;
    status: string;
    mercado_pago_status: string | null;
    operational_status: string | null;
    total_cents: number;
    supplier_name: string | null;
    supplier_status: string | null;
    supplier_cost_cents: number | null;
    shipping_cost_cents: number | null;
    other_expenses_cents: number | null;
    created_at: string;
  }[];
  suppliers: { name: string; orders: number; products: number; supplierSpendCents: number }[];
  configuration: Record<string, boolean>;
};

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const date = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" });
const configLabels: Record<string, string> = {
  supabase: "Supabase servidor",
  mercadoPago: "Mercado Pago",
  mercadoPagoWebhook: "Segredo do webhook Mercado Pago",
  whatsapp: "Webhook de mensagens WhatsApp",
  whatsappToken: "Token do provedor WhatsApp",
  adminToken: "Token administrativo",
};

function Card({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return <article className="rounded-xl border border-border bg-white p-5"><p className="text-[10px] font-black uppercase tracking-wider text-muted">{label}</p><p className="mt-2 text-2xl font-black">{value}</p>{detail && <p className="mt-1 text-[11px] text-muted">{detail}</p>}</article>;
}

export default function AdminSummaryClient({ current }: { current: AdminSection }) {
  const [token, setToken] = useState("");
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function load(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/summary", {
        headers: { authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Não foi possível carregar os dados administrativos.");
      setSummary(body as Summary);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível carregar os dados administrativos.");
    } finally {
      setLoading(false);
    }
  }

  const metrics = summary?.metrics;
  const heading = current === "overview" ? "Visão geral" : current === "suppliers" ? "Fornecedores" : current === "finance" ? "Financeiro" : "Configurações";
  return (
    <main className="mx-auto max-w-7xl px-5 py-10 lg:px-8">
      <AdminNavigation current={current} />
      <p className="text-[10px] font-black uppercase tracking-[.2em] text-action">AlvesStore · administração</p>
      <h1 className="mt-2 text-3xl font-black">{heading}</h1>
      <p className="mt-2 text-sm text-muted">Painel protegido. Configure o token administrativo para carregar dados privados da loja.</p>
      <form onSubmit={(event) => void load(event)} className="mt-6 flex max-w-xl flex-wrap gap-2">
        <label className="sr-only" htmlFor={`summary-token-${current}`}>Token administrativo</label>
        <input id={`summary-token-${current}`} type="password" autoComplete="current-password" required value={token} onChange={(event) => setToken(event.target.value)} className="min-w-0 flex-1 rounded-lg border border-border px-4 py-3 text-sm" placeholder="Token administrativo" />
        <button disabled={loading} className="rounded-lg bg-ink px-5 py-3 text-xs font-black uppercase text-white disabled:opacity-50">{loading ? "Carregando..." : summary ? "Atualizar dados" : "Carregar dados"}</button>
      </form>
      {message && <p role="status" className="mt-4 rounded-lg bg-paper px-4 py-3 text-sm">{message}</p>}

      {summary && current === "overview" && metrics && (
        <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Card label="Faturamento recebido" value={money.format(metrics.revenueCents / 100)} detail={`${metrics.paidOrderCount} pedidos com pagamento aprovado`} />
          <Card label="Gasto com fornecedores" value={money.format(metrics.supplierCostCents / 100)} />
          <Card label="Lucro estimado" value={money.format(metrics.estimatedProfitCents / 100)} detail="Faturamento aprovado menos custos registrados" />
          <Card label="Pedidos" value={String(metrics.orderCount)} />
          <Card label="Aguardando fornecedor" value={String(metrics.awaitingSupplierCount)} />
          <Card label="Pedidos enviados" value={String(metrics.shippedOrderCount)} />
          <div className="rounded-xl border border-border bg-paper p-5 text-xs leading-6 text-muted sm:col-span-2 lg:col-span-3">O faturamento considera somente pedidos aprovados no Mercado Pago. O lucro é estimado e considera os custos registrados nos pedidos pagos; custos ainda não informados não são estimados automaticamente.</div>
        </section>
      )}

      {summary && current === "finance" && metrics && (
        <section className="mt-8">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card label="Faturamento aprovado" value={money.format(metrics.revenueCents / 100)} />
            <Card label="Fornecedores" value={money.format(metrics.supplierCostCents / 100)} />
            <Card label="Frete e outras despesas" value={money.format((metrics.shippingCostCents + metrics.otherExpensesCents) / 100)} />
            <Card label="Lucro estimado" value={money.format(metrics.estimatedProfitCents / 100)} />
          </div>
          <h2 className="mt-8 text-lg font-black">Pedidos recentes e custos registrados</h2>
          <div className="mt-3 overflow-x-auto rounded-xl border border-border bg-white">
            <table className="w-full min-w-[820px] text-left text-xs">
              <thead className="bg-paper text-[10px] uppercase text-muted"><tr>{["Pedido", "Data", "Fornecedor", "Venda", "Custos registrados", "Lucro estimado"].map((heading) => <th key={heading} className="px-4 py-3">{heading}</th>)}</tr></thead>
              <tbody className="divide-y divide-border">{summary.orders.map((order) => {
                const expenses = (order.supplier_cost_cents ?? 0) + (order.shipping_cost_cents ?? 0) + (order.other_expenses_cents ?? 0);
                const paid = ["pago", "enviado", "approved"].includes(order.status) || order.mercado_pago_status === "approved";
                const revenue = paid ? order.total_cents : 0;
                return <tr key={order.id}><td className="px-4 py-3 font-bold">{order.id.slice(0, 8).toUpperCase()}</td><td className="px-4 py-3">{date.format(new Date(order.created_at))}</td><td className="px-4 py-3">{order.supplier_name ?? "—"}</td><td className="px-4 py-3">{paid ? money.format(revenue / 100) : "Aguardando pagamento"}</td><td className="px-4 py-3">{money.format(expenses / 100)}</td><td className="px-4 py-3 font-bold">{money.format((revenue - expenses) / 100)}</td></tr>;
              })}</tbody>
            </table>
          </div>
          <p className="mt-2 text-[11px] text-muted">A tabela lista até 300 pedidos recentes; os indicadores acima abrangem todos os pedidos.</p>
        </section>
      )}

      {summary && current === "suppliers" && (
        <section className="mt-8">
          <p className="text-sm text-muted">Fornecedores encontrados nos produtos e nos pedidos. Os dados são internos e não aparecem na vitrine.</p>
          {summary.suppliers.length === 0 ? <p className="mt-4 rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted">Nenhum fornecedor cadastrado. Informe o fornecedor padrão no cadastro de produto ou nos detalhes do pedido.</p> : (
            <div className="mt-4 overflow-x-auto rounded-xl border border-border bg-white">
              <table className="w-full min-w-[680px] text-left text-xs">
                <thead className="bg-paper text-[10px] uppercase text-muted"><tr>{["Fornecedor", "Produtos", "Pedidos", "Custos de fornecedor registrados"].map((heading) => <th key={heading} className="px-4 py-3">{heading}</th>)}</tr></thead>
                <tbody className="divide-y divide-border">{summary.suppliers.map((supplier) => <tr key={supplier.name}><td className="px-4 py-3 font-bold">{supplier.name}</td><td className="px-4 py-3">{supplier.products}</td><td className="px-4 py-3">{supplier.orders}</td><td className="px-4 py-3">{money.format(supplier.supplierSpendCents / 100)}</td></tr>)}</tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {summary && current === "settings" && (
        <section className="mt-8 max-w-2xl rounded-xl border border-border bg-white p-5">
          <h2 className="text-lg font-black">Presença das variáveis de ambiente</h2>
          <p className="mt-1 text-xs leading-5 text-muted">Este painel verifica somente se há valores configurados no servidor; não testa credenciais nem chama os provedores.</p>
          <ul className="mt-4 divide-y divide-border">{Object.entries(configLabels).map(([key, label]) => <li key={key} className="flex items-center justify-between gap-4 py-3 text-sm"><span>{label}</span><span className={summary.configuration[key] ? "font-bold text-green-700" : "font-bold text-red-700"}>{summary.configuration[key] ? "Configurado" : "Pendente"}</span></li>)}</ul>
          <p className="mt-4 text-xs leading-5 text-muted">As chaves permanecem no servidor e nunca são exibidas. Após configurar ou alterar variáveis, reinicie/reimplante a aplicação.</p>
        </section>
      )}
    </main>
  );
}
