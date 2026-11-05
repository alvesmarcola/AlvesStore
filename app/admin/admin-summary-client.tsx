"use client";

import { useEffect, useState } from "react";
import { AdminNavigation, type AdminSection } from "@/components/admin-navigation";
import { AdminSkeleton, EmptyState, ErrorState, StatCard } from "@/components/admin-states";
import { BarChart3, CircleDollarSign, PackageOpen, Truck } from "lucide-react";
import { adminFetch } from "@/lib/client/admin-fetch";
import { SITE_NAME } from "@/lib/site";

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
    promoOrderCount: number;
    promoDiscountCents: number;
    promoRevenueCents: number;
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

export default function AdminSummaryClient({ current }: { current: AdminSection }) {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const response = await adminFetch("/api/admin/summary", {
        cache: "no-store",
      });
      const body = await response.json();
      if (response.status === 401) {
        setAuthorized(false);
        setError("Sua sessão expirou. Entre novamente.");
        return;
      }
      if (!response.ok) throw new Error(body.error ?? "Não foi possível carregar os dados administrativos.");
      setSummary(body as Summary);
      setAuthorized(true);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Não foi possível carregar os dados administrativos.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  const metrics = summary?.metrics;
  const heading = current === "overview" ? "Visão geral" : current === "suppliers" ? "Fornecedores" : current === "finance" ? "Financeiro" : "Configurações";
  return (
    <main className="mx-auto max-w-7xl px-5 py-10 lg:px-8">
      <AdminNavigation current={current} />
      <p className="text-[10px] font-black uppercase tracking-[.2em] text-action">{SITE_NAME} · Administração</p>
      <h1 className="mt-2 text-3xl font-black">{heading}</h1>
      <p className="mt-2 text-sm text-muted">{current === "overview" ? "Resumo da operação e dos indicadores da loja." : "Dados internos disponíveis somente para a equipe administrativa."}</p>
      {loading && <AdminSkeleton cards={current === "finance" ? 4 : 3} />}
      {!loading && error && <div className="mt-8"><ErrorState message={error} onRetry={() => void load()} /></div>}

      {authorized && summary && !loading && !error && current === "overview" && metrics && (
        metrics.orderCount === 0 ? <div className="mt-8"><EmptyState icon={PackageOpen} title="Ainda não há pedidos" description="Os indicadores aparecerão aqui assim que a loja receber pedidos." /></div> :
        <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard label="Faturamento recebido" value={money.format(metrics.revenueCents / 100)} detail={`${metrics.paidOrderCount} pedidos com pagamento aprovado`} icon={CircleDollarSign} />
          <StatCard label="Gasto com fornecedores" value={money.format(metrics.supplierCostCents / 100)} icon={BarChart3} />
          <StatCard label="Lucro estimado" value={money.format(metrics.estimatedProfitCents / 100)} detail="Faturamento aprovado menos custos registrados" icon={CircleDollarSign} />
          <StatCard label="Pedidos" value={String(metrics.orderCount)} icon={PackageOpen} />
          <StatCard label="Aguardando fornecedor" value={String(metrics.awaitingSupplierCount)} icon={PackageOpen} />
          <StatCard label="Pedidos enviados" value={String(metrics.shippedOrderCount)} icon={Truck} />
          <StatCard label="Pedidos Black Friday NBA" value={String(metrics.promoOrderCount)} icon={PackageOpen} />
          <StatCard label="Desconto Black Friday NBA" value={money.format(metrics.promoDiscountCents / 100)} icon={CircleDollarSign} />
          <StatCard label="Faturamento Black Friday NBA" value={money.format(metrics.promoRevenueCents / 100)} icon={CircleDollarSign} />
          <div className="rounded-xl border border-border bg-paper p-5 text-xs leading-6 text-muted sm:col-span-2 lg:col-span-3">O faturamento considera somente pedidos aprovados no Mercado Pago. O lucro é estimado e considera os custos registrados nos pedidos pagos; custos ainda não informados não são estimados automaticamente.</div>
        </section>
      )}

      {authorized && summary && !loading && !error && current === "finance" && metrics && (
        <section className="mt-8">
          {metrics.orderCount === 0 ? <EmptyState icon={CircleDollarSign} title="Sem movimentação financeira" description="Vendas e custos registrados serão resumidos aqui." /> : <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Faturamento aprovado" value={money.format(metrics.revenueCents / 100)} icon={CircleDollarSign} />
            <StatCard label="Fornecedores" value={money.format(metrics.supplierCostCents / 100)} icon={BarChart3} />
            <StatCard label="Frete e outras despesas" value={money.format((metrics.shippingCostCents + metrics.otherExpensesCents) / 100)} icon={Truck} />
            <StatCard label="Lucro estimado" value={money.format(metrics.estimatedProfitCents / 100)} icon={CircleDollarSign} />
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
          </>}
        </section>
      )}

      {authorized && summary && !loading && !error && current === "suppliers" && (
        <section className="mt-8">
          <p className="text-sm text-muted">Fornecedores encontrados nos produtos e nos pedidos. Os dados são internos e não aparecem na vitrine.</p>
          {summary.suppliers.length === 0 ? <div className="mt-4"><EmptyState icon={PackageOpen} title="Nenhum fornecedor cadastrado" description="Adicione o fornecedor padrão em um produto ou nos detalhes do pedido para acompanhar sua operação." /></div> : (
            <div className="mt-4 overflow-x-auto rounded-xl border border-border bg-white">
              <table className="w-full min-w-[680px] text-left text-xs">
                <thead className="bg-paper text-[10px] uppercase text-muted"><tr>{["Fornecedor", "Produtos", "Pedidos", "Custos de fornecedor registrados"].map((heading) => <th key={heading} className="px-4 py-3">{heading}</th>)}</tr></thead>
                <tbody className="divide-y divide-border">{summary.suppliers.map((supplier) => <tr key={supplier.name}><td className="px-4 py-3 font-bold">{supplier.name}</td><td className="px-4 py-3">{supplier.products}</td><td className="px-4 py-3">{supplier.orders}</td><td className="px-4 py-3">{money.format(supplier.supplierSpendCents / 100)}</td></tr>)}</tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {authorized && summary && !loading && !error && current === "settings" && (
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
