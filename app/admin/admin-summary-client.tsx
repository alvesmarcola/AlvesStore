"use client";

import { useEffect, useState } from "react";
import { AdminNavigation, type AdminSection } from "@/components/admin-navigation";
import { AdminSkeleton, EmptyState, ErrorState, StatCard } from "@/components/admin-states";
import { BarChart3, CircleDollarSign, Download, PackageOpen, Percent, ShieldAlert, Truck } from "lucide-react";
import { adminFetch } from "@/lib/client/admin-fetch";
import { SITE_NAME } from "@/lib/site";
import { isOrderExpired, isOrderPaid, isOrderPending } from "@/lib/order-status";
import {
  calculateFinancialSummary,
  generateOrdersCsv,
  isOrderInPeriod,
  type FinancePeriod,
  type OrderFinanceRecord,
} from "@/lib/finance";

type Summary = {
  isPartner?: boolean;
  metrics: {
    orderCount: number;
    paidOrderCount: number;
    awaitingSupplierCount: number;
    shippedOrderCount: number;
    revenueCents: number;
    supplierCostCents: number;
    shippingCostCents: number;
    otherExpensesCents: number;
    paymentFeeCents?: number;
    refundedCents?: number;
    estimatedProfitCents: number;
    promoOrderCount: number;
    promoDiscountCents: number;
    promoRevenueCents: number;
  };
  orders: (OrderFinanceRecord & {
    id: string;
    status: string;
    mercado_pago_status: string | null;
    operational_status: string | null;
    total_cents: number;
    supplier_name?: string | null;
    supplier_status?: string | null;
    supplier_cost_cents?: number | null;
    shipping_cost_cents?: number | null;
    other_expenses_cents?: number | null;
    payment_fee_cents?: number | null;
    refunded_cents?: number | null;
    is_test?: boolean | null;
    created_at: string;
  })[];
  suppliers: { name: string; orders: number; products: number; supplierSpendCents: number }[];
  configuration: Record<string, boolean>;
};

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const date = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: "America/Sao_Paulo" });
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
  const [financeFilter, setFinanceFilter] = useState<"paid" | "pending" | "expired" | "test" | "all">("paid");
  const [periodFilter, setPeriodFilter] = useState<FinancePeriod>("all");
  const [togglingTestId, setTogglingTestId] = useState<string>("");

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

  async function toggleTest(orderId: string, currentTest: boolean) {
    setTogglingTestId(orderId);
    try {
      const response = await adminFetch("/api/admin/orders", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ orderId, action: "toggle_test", isTest: !currentTest }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Erro ao alterar pedido de teste.");
      setSummary((prev) => prev ? {
        ...prev,
        orders: prev.orders.map((o) => o.id === orderId ? { ...o, is_test: !currentTest } : o),
      } : prev);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Erro ao alterar pedido.");
    } finally {
      setTogglingTestId("");
    }
  }

  function downloadCsv() {
    if (!summary?.orders) return;
    const csvContent = generateOrdersCsv(summary.orders, periodFilter);
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `financeiro-imports-alves-${periodFilter}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  const metrics = summary?.metrics;
  const isPartner = summary?.isPartner === true;
  const heading = current === "overview" ? "Visão geral" : current === "suppliers" ? "Fornecedores" : current === "finance" ? "Financeiro" : "Configurações";

  return (
    <main className="mx-auto max-w-7xl px-5 py-10 lg:px-8">
      <AdminNavigation current={current} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[.2em] text-action">{SITE_NAME} · Administração</p>
          <h1 className="mt-2 text-3xl font-black">{heading}</h1>
          <p className="mt-2 text-sm text-muted">
            {current === "overview" ? "Resumo da operação e dos indicadores da loja." : "Dados internos disponíveis somente para a equipe administrativa."}
          </p>
        </div>
        {isPartner && (
          <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-900">
            Perfil Parceiro (Custos e dados financeiros ocultos)
          </div>
        )}
      </div>

      {loading && <AdminSkeleton cards={current === "finance" ? 5 : 3} />}
      {!loading && error && <div className="mt-8"><ErrorState message={error} onRetry={() => void load()} /></div>}

      {authorized && summary && !loading && !error && current === "overview" && metrics && (
        metrics.orderCount === 0 ? <div className="mt-8"><EmptyState icon={PackageOpen} title="Ainda não há pedidos" description="Os indicadores aparecerão aqui assim que a loja receber pedidos." /></div> :
        <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard label="Faturamento recebido" value={isPartner ? "—" : money.format(metrics.revenueCents / 100)} detail={`${metrics.paidOrderCount} pedidos com pagamento aprovado`} icon={CircleDollarSign} />
          <StatCard label="Gasto com fornecedores" value={isPartner ? "—" : money.format(metrics.supplierCostCents / 100)} icon={BarChart3} />
          <StatCard label="Lucro estimado" value={isPartner ? "—" : money.format(metrics.estimatedProfitCents / 100)} detail="Faturamento aprovado menos custos registrados" icon={CircleDollarSign} />
          <StatCard label="Pedidos aprovados" value={String(metrics.paidOrderCount)} detail={`${metrics.orderCount} no total (inclui pendentes/cancelados)`} icon={PackageOpen} />
          <StatCard label="Aguardando fornecedor" value={String(metrics.awaitingSupplierCount)} icon={PackageOpen} />
          <StatCard label="Pedidos enviados" value={String(metrics.shippedOrderCount)} icon={Truck} />
          <StatCard label="Pedidos Black Friday NBA" value={String(metrics.promoOrderCount)} icon={PackageOpen} />
          <StatCard label="Desconto Black Friday NBA" value={isPartner ? "—" : money.format(metrics.promoDiscountCents / 100)} icon={CircleDollarSign} />
          <StatCard label="Faturamento Black Friday NBA" value={isPartner ? "—" : money.format(metrics.promoRevenueCents / 100)} icon={CircleDollarSign} />
          <div className="rounded-xl border border-border bg-paper p-5 text-xs leading-6 text-muted sm:col-span-2 lg:col-span-3">
            O faturamento considera somente pedidos aprovados no Mercado Pago e desconsidera pedidos marcados como teste. O lucro é estimado e considera os custos registrados nos pedidos pagos; custos ainda não informados não são estimados automaticamente.
          </div>
        </section>
      )}

      {authorized && summary && !loading && !error && current === "finance" && (
        isPartner ? (
          <section className="mt-8 rounded-xl border border-border bg-white p-8 text-center text-sm text-muted">
            <ShieldAlert className="mx-auto h-8 w-8 text-amber-600 mb-2" />
            <h2 className="text-base font-bold text-ink">Acesso restrito ao perfil de Administrador</h2>
            <p className="mt-2 text-xs">Os dados financeiros, custos de fornecedores, taxas de pagamento e margens de lucro são visíveis apenas para o perfil de administrador pleno.</p>
          </section>
        ) : (() => {
          const finSummary = calculateFinancialSummary(summary.orders, periodFilter);
          const periodOrders = summary.orders.filter((o) => isOrderInPeriod(o.created_at, periodFilter));
          const testOrders = periodOrders.filter((o) => o.is_test === true);
          const nonTestOrders = periodOrders.filter((o) => !o.is_test);
          const paidOrders = nonTestOrders.filter(isOrderPaid);
          const pendingOrders = nonTestOrders.filter(isOrderPending);
          const expiredOrders = nonTestOrders.filter(isOrderExpired);

          const displayedOrders =
            financeFilter === "paid"
              ? paidOrders
              : financeFilter === "pending"
              ? pendingOrders
              : financeFilter === "expired"
              ? expiredOrders
              : financeFilter === "test"
              ? testOrders
              : periodOrders;

          return (
            <section className="mt-8">
              {summary.orders.length === 0 ? (
                <EmptyState icon={CircleDollarSign} title="Sem movimentação financeira" description="Vendas e custos registrados serão resumidos aqui." />
              ) : (
                <>
                  {/* Controles de Período e Exportação */}
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-white p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-bold text-muted uppercase tracking-wider">Período:</span>
                      {(
                        [
                          ["today", "Hoje"],
                          ["7days", "Últimos 7 dias"],
                          ["month", "Este mês"],
                          ["black_friday", "Black Friday"],
                          ["all", "Todos"],
                        ] as [FinancePeriod, string][]
                      ).map(([key, label]) => (
                        <button
                          key={key}
                          type="button"
                          onClick={() => setPeriodFilter(key)}
                          className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${
                            periodFilter === key ? "bg-ink text-white" : "border border-border bg-paper text-muted hover:text-ink"
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={downloadCsv}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-paper px-3 py-1.5 text-xs font-bold hover:bg-zinc-200 transition"
                    >
                      <Download className="h-3.5 w-3.5" />
                      Exportar CSV ({periodOrders.length} pedidos)
                    </button>
                  </div>

                  {/* Indicadores Reativos ao Período */}
                  <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
                    <StatCard
                      label="Faturamento líquido"
                      value={money.format(finSummary.netRevenueCents / 100)}
                      detail={
                        finSummary.refundedCents > 0
                          ? `Bruto: ${money.format(finSummary.revenueCents / 100)} (-${money.format(finSummary.refundedCents / 100)} estorno)`
                          : `${finSummary.paidOrderCount} pedidos pagos`
                      }
                      icon={CircleDollarSign}
                    />
                    <StatCard
                      label="Fornecedores"
                      value={money.format(finSummary.supplierCostCents / 100)}
                      detail={`${finSummary.supplierCostOrdersCount} pedidos com custo`}
                      icon={BarChart3}
                    />
                    <StatCard
                      label="Taxas Mercado Pago"
                      value={money.format(finSummary.paymentFeeCents / 100)}
                      detail={`${finSummary.paymentFeeOrdersCount} pedidos com taxa`}
                      icon={Percent}
                    />
                    <StatCard
                      label="Frete e outras"
                      value={money.format((finSummary.shippingCostCents + finSummary.otherExpensesCents) / 100)}
                      icon={Truck}
                    />
                    <StatCard
                      label="Lucro estimado"
                      value={money.format(finSummary.estimatedProfitCents / 100)}
                      detail={`Margem: ${finSummary.profitMarginPercent.toFixed(1).replace(".", ",")}%`}
                      icon={CircleDollarSign}
                    />
                  </div>

                  {finSummary.unrecordedCostOrdersCount > 0 && (
                    <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-xs text-amber-900">
                      ℹ️ Existem <strong>{finSummary.unrecordedCostOrdersCount}</strong> pedido(s) pago(s) sem custo de fornecedor informado (exibidos como &quot;—&quot;). O lucro acima considera apenas os custos cadastrados e não presume 100% de lucro.
                    </div>
                  )}

                  {/* Abas de status */}
                  <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h2 className="text-lg font-black">Pedidos do período selecionado</h2>
                      <p className="text-xs text-muted">Exibição padrão focada em pedidos aprovados. Testes são mantidos isolados dos indicadores.</p>
                    </div>
                    <div className="inline-flex flex-wrap rounded-xl border border-border bg-paper p-1 text-xs">
                      <button
                        type="button"
                        onClick={() => setFinanceFilter("paid")}
                        className={`rounded-lg px-3 py-1.5 font-bold transition-colors ${
                          financeFilter === "paid" ? "bg-white text-foreground shadow-sm" : "text-muted hover:text-foreground"
                        }`}
                      >
                        Pagos ({paidOrders.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setFinanceFilter("pending")}
                        className={`rounded-lg px-3 py-1.5 font-bold transition-colors ${
                          financeFilter === "pending" ? "bg-white text-foreground shadow-sm" : "text-muted hover:text-foreground"
                        }`}
                      >
                        Aguardando ({pendingOrders.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setFinanceFilter("expired")}
                        className={`rounded-lg px-3 py-1.5 font-bold transition-colors ${
                          financeFilter === "expired" ? "bg-white text-foreground shadow-sm" : "text-muted hover:text-foreground"
                        }`}
                      >
                        Expirados ({expiredOrders.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setFinanceFilter("test")}
                        className={`rounded-lg px-3 py-1.5 font-bold transition-colors ${
                          financeFilter === "test" ? "bg-white text-foreground shadow-sm" : "text-muted hover:text-foreground"
                        }`}
                      >
                        Testes ({testOrders.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setFinanceFilter("all")}
                        className={`rounded-lg px-3 py-1.5 font-bold transition-colors ${
                          financeFilter === "all" ? "bg-white text-foreground shadow-sm" : "text-muted hover:text-foreground"
                        }`}
                      >
                        Todos ({periodOrders.length})
                      </button>
                    </div>
                  </div>

                  {displayedOrders.length === 0 ? (
                    <div className="mt-4 rounded-xl border border-border bg-white p-8 text-center text-xs text-muted">
                      Nenhum pedido encontrado nesta aba para o período selecionado.
                    </div>
                  ) : (
                    <div className="mt-3 overflow-x-auto rounded-xl border border-border bg-white">
                      <table className="w-full min-w-[950px] text-left text-xs">
                        <thead className="bg-paper text-[10px] uppercase text-muted">
                          <tr>
                            {[
                              "Pedido",
                              "Data",
                              "Status",
                              "Fornecedor",
                              "Venda líquida",
                              "Taxa MP",
                              "Custo fornecedor",
                              "Frete/Outros",
                              "Lucro estimado",
                              "Tipo",
                            ].map((heading) => (
                              <th key={heading} className="px-4 py-3">{heading}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {displayedOrders.map((order) => {
                            const paid = isOrderPaid(order);
                            const expired = isOrderExpired(order);
                            const total = Math.max(0, Number(order.total_cents || 0));
                            const refunded = Math.max(0, Number(order.refunded_cents || 0));
                            const net = paid ? Math.max(0, total - refunded) : 0;
                            const hasCost = order.supplier_cost_cents !== null && order.supplier_cost_cents !== undefined;
                            const hasFee = order.payment_fee_cents !== null && order.payment_fee_cents !== undefined;
                            const cost = hasCost ? Number(order.supplier_cost_cents) : 0;
                            const fee = hasFee ? Number(order.payment_fee_cents) : 0;
                            const shippingAndOther = Number(order.shipping_cost_cents || 0) + Number(order.other_expenses_cents || 0);

                            const profit = paid && hasCost ? net - cost - fee - shippingAndOther : null;
                            const statusLabel = paid ? (refunded > 0 ? "Reembolsado parcial" : "Aprovado") : expired ? "Expirado (>48h)" : "Aguardando";
                            const statusClass = paid
                              ? "text-emerald-700 bg-emerald-50 border-emerald-200"
                              : expired
                              ? "text-slate-600 bg-slate-100 border-slate-200"
                              : "text-amber-700 bg-amber-50 border-amber-200";

                            return (
                              <tr key={order.id} className={order.is_test ? "bg-amber-50/30" : undefined}>
                                <td className="px-4 py-3 font-bold">{order.id.slice(0, 8).toUpperCase()}</td>
                                <td className="px-4 py-3">{date.format(new Date(order.created_at))}</td>
                                <td className="px-4 py-3">
                                  <span className={`inline-block rounded-full border px-2 py-0.5 text-[10px] font-bold ${statusClass}`}>
                                    {statusLabel}
                                  </span>
                                </td>
                                <td className="px-4 py-3">{order.supplier_name ?? "—"}</td>
                                <td className="px-4 py-3">{paid ? money.format(net / 100) : "R$ 0,00"}</td>
                                <td className="px-4 py-3">{hasFee ? money.format(fee / 100) : "—"}</td>
                                <td className="px-4 py-3">{hasCost ? money.format(cost / 100) : "—"}</td>
                                <td className="px-4 py-3">{money.format(shippingAndOther / 100)}</td>
                                <td className="px-4 py-3 font-bold">{profit !== null ? money.format(profit / 100) : "—"}</td>
                                <td className="px-4 py-3">
                                  {order.is_test ? (
                                    <span className="inline-flex items-center gap-1">
                                      <span className="rounded bg-amber-200 px-1.5 py-0.5 text-[9px] font-black text-amber-900">TESTE</span>
                                      <button
                                        type="button"
                                        disabled={togglingTestId === order.id}
                                        onClick={() => void toggleTest(order.id, true)}
                                        className="text-[10px] text-muted underline hover:text-ink disabled:opacity-50"
                                      >
                                        Remover
                                      </button>
                                    </span>
                                  ) : (
                                    <button
                                      type="button"
                                      disabled={togglingTestId === order.id}
                                      onClick={() => void toggleTest(order.id, false)}
                                      className="rounded border border-border bg-paper px-2 py-0.5 text-[10px] font-medium text-muted hover:text-ink hover:bg-zinc-200 disabled:opacity-50"
                                    >
                                      Marcar teste
                                    </button>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                  <p className="mt-2 text-[11px] text-muted">
                    Todos os pedidos do período selecionado são considerados nos indicadores e na exportação do CSV.
                  </p>
                </>
              )}
            </section>
          );
        })()
      )}

      {authorized && summary && !loading && !error && current === "suppliers" && (
        <section className="mt-8">
          <p className="text-sm text-muted">Fornecedores encontrados nos produtos e nos pedidos. Os dados são internos e não aparecem na vitrine.</p>
          {summary.suppliers.length === 0 ? <div className="mt-4"><EmptyState icon={PackageOpen} title="Nenhum fornecedor cadastrado" description="Adicione o fornecedor padrão em um produto ou nos detalhes do pedido para acompanhar sua operação." /></div> : (
            <div className="mt-4 overflow-x-auto rounded-xl border border-border bg-white">
              <table className="w-full min-w-[680px] text-left text-xs">
                <thead className="bg-paper text-[10px] uppercase text-muted"><tr>{["Fornecedor", "Produtos", "Pedidos", "Custos de fornecedor registrados"].map((heading) => <th key={heading} className="px-4 py-3">{heading}</th>)}</tr></thead>
                <tbody className="divide-y divide-border">{summary.suppliers.map((supplier) => <tr key={supplier.name}><td className="px-4 py-3 font-bold">{supplier.name}</td><td className="px-4 py-3">{supplier.products}</td><td className="px-4 py-3">{supplier.orders}</td><td className="px-4 py-3">{isPartner ? "—" : money.format(supplier.supplierSpendCents / 100)}</td></tr>)}</tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {authorized && summary && !loading && !error && current === "settings" && (
        isPartner ? (
          <section className="mt-8 rounded-xl border border-border bg-white p-8 text-center text-sm text-muted">
            <ShieldAlert className="mx-auto h-8 w-8 text-amber-600 mb-2" />
            <h2 className="text-base font-bold text-ink">Acesso restrito ao perfil de Administrador</h2>
            <p className="mt-2 text-xs">A visualização de variáveis de ambiente e conexões de pagamento é restrita ao administrador pleno.</p>
          </section>
        ) : (
          <section className="mt-8 max-w-2xl rounded-xl border border-border bg-white p-5">
            <h2 className="text-lg font-black">Presença das variáveis de ambiente</h2>
            <p className="mt-1 text-xs leading-5 text-muted">Este painel verifica somente se há valores configurados no servidor; não testa credenciais nem chama os provedores.</p>
            <ul className="mt-4 divide-y divide-border">{Object.entries(configLabels).map(([key, label]) => <li key={key} className="flex items-center justify-between gap-4 py-3 text-sm"><span>{label}</span><span className={summary.configuration[key] ? "font-bold text-green-700" : "font-bold text-red-700"}>{summary.configuration[key] ? "Configurado" : "Pendente"}</span></li>)}</ul>
            <p className="mt-4 text-xs leading-5 text-muted">As chaves permanecem no servidor e nunca são exibidas. Após configurar ou alterar variáveis, reinicie/reimplante a aplicação.</p>
          </section>
        )
      )}
    </main>
  );
}
