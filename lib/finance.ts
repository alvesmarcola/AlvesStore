import { isOrderExpired, isOrderPaid, isOrderPending, type OrderLike } from "@/lib/order-status";

export type FinancePeriod = "today" | "7days" | "month" | "black_friday" | "all";

export type OrderFinanceRecord = OrderLike & {
  id: string;
  created_at: string;
  total_cents: number;
  status: string;
  mercado_pago_status?: string | null;
  operational_status?: string | null;
  supplier_name?: string | null;
  supplier_status?: string | null;
  supplier_cost_cents?: number | null;
  shipping_cost_cents?: number | null;
  other_expenses_cents?: number | null;
  payment_fee_cents?: number | null;
  refunded_cents?: number | null;
  is_test?: boolean | null;
  customer?: Record<string, unknown> | null;
  item_lines?: unknown[] | null;
};

// Black Friday: 01/11/2026 00:00:00 até 01/12/2026 23:59:59 em America/Sao_Paulo (UTC-3)
export const BLACK_FRIDAY_START_ISO = "2026-11-01T00:00:00.000-03:00";
export const BLACK_FRIDAY_END_ISO = "2026-12-01T23:59:59.999-03:00";

/**
 * Obtém partes de data (ano, mês, dia) no fuso America/Sao_Paulo
 */
function getSaoPauloDateParts(date: Date) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const parts = formatter.formatToParts(date);
  const partMap: Record<string, string> = {};
  for (const p of parts) partMap[p.type] = p.value;
  return {
    year: partMap.year ?? "2026",
    month: partMap.month ?? "11",
    day: partMap.day ?? "01",
  };
}

export function getPeriodDateRange(period: FinancePeriod, now = new Date()): { start: Date | null; end: Date | null } {
  if (period === "all") return { start: null, end: null };

  if (period === "black_friday") {
    return {
      start: new Date(BLACK_FRIDAY_START_ISO),
      end: new Date(BLACK_FRIDAY_END_ISO),
    };
  }

  const { year, month, day } = getSaoPauloDateParts(now);

  if (period === "today") {
    return {
      start: new Date(`${year}-${month}-${day}T00:00:00.000-03:00`),
      end: new Date(`${year}-${month}-${day}T23:59:59.999-03:00`),
    };
  }

  if (period === "month") {
    return {
      start: new Date(`${year}-${month}-01T00:00:00.000-03:00`),
      end: new Date(now.getTime()),
    };
  }

  if (period === "7days") {
    const todayStart = new Date(`${year}-${month}-${day}T00:00:00.000-03:00`).getTime();
    return {
      start: new Date(todayStart - 6 * 24 * 60 * 60 * 1000),
      end: new Date(now.getTime()),
    };
  }

  return { start: null, end: null };
}

export function isOrderInPeriod(orderCreatedAt: string, period: FinancePeriod, now = new Date()): boolean {
  if (period === "all") return true;
  const time = new Date(orderCreatedAt).getTime();
  if (!Number.isFinite(time)) return false;

  const { start, end } = getPeriodDateRange(period, now);
  if (start && time < start.getTime()) return false;
  if (end && time > end.getTime()) return false;
  return true;
}

export type FinancialSummary = {
  orderCount: number;
  paidOrderCount: number;
  pendingOrderCount: number;
  expiredOrderCount: number;
  testOrderCount: number;
  revenueCents: number;
  refundedCents: number;
  netRevenueCents: number;
  supplierCostCents: number;
  supplierCostOrdersCount: number;
  unrecordedCostOrdersCount: number;
  shippingCostCents: number;
  otherExpensesCents: number;
  paymentFeeCents: number;
  paymentFeeOrdersCount: number;
  estimatedProfitCents: number;
  profitMarginPercent: number;
};

export function calculateFinancialSummary(orders: OrderFinanceRecord[], period: FinancePeriod = "all", now = new Date()): FinancialSummary {
  const filtered = orders.filter((o) => isOrderInPeriod(o.created_at, period, now));

  let orderCount = 0;
  let paidOrderCount = 0;
  let pendingOrderCount = 0;
  let expiredOrderCount = 0;
  let testOrderCount = 0;
  let grossRevenueCents = 0;
  let refundedCents = 0;
  let supplierCostCents = 0;
  let supplierCostOrdersCount = 0;
  let unrecordedCostOrdersCount = 0;
  let shippingCostCents = 0;
  let otherExpensesCents = 0;
  let paymentFeeCents = 0;
  let paymentFeeOrdersCount = 0;

  for (const order of filtered) {
    if (order.is_test) {
      testOrderCount += 1;
      continue; // Pedidos de teste NÃO entram nos indicadores financeiros
    }

    orderCount += 1;
    const paid = isOrderPaid(order);

    if (paid) {
      paidOrderCount += 1;
      const orderTotal = Math.max(0, Number(order.total_cents || 0));
      const orderRefunded = Math.max(0, Math.min(orderTotal, Number(order.refunded_cents || 0)));
      grossRevenueCents += orderTotal;
      refundedCents += orderRefunded;

      if (order.supplier_cost_cents !== null && order.supplier_cost_cents !== undefined) {
        supplierCostCents += Number(order.supplier_cost_cents);
        supplierCostOrdersCount += 1;
      } else {
        unrecordedCostOrdersCount += 1;
      }

      if (order.payment_fee_cents !== null && order.payment_fee_cents !== undefined) {
        paymentFeeCents += Number(order.payment_fee_cents);
        paymentFeeOrdersCount += 1;
      }

      shippingCostCents += Number(order.shipping_cost_cents || 0);
      otherExpensesCents += Number(order.other_expenses_cents || 0);
    } else if (isOrderExpired(order, now.getTime())) {
      expiredOrderCount += 1;
    } else if (isOrderPending(order, now.getTime())) {
      pendingOrderCount += 1;
    }
  }

  const netRevenueCents = Math.max(0, grossRevenueCents - refundedCents);
  const totalDeductionsCents = supplierCostCents + paymentFeeCents + shippingCostCents + otherExpensesCents;
  const estimatedProfitCents = netRevenueCents - totalDeductionsCents;
  const profitMarginPercent = netRevenueCents > 0 ? (estimatedProfitCents / netRevenueCents) * 100 : 0;

  return {
    orderCount,
    paidOrderCount,
    pendingOrderCount,
    expiredOrderCount,
    testOrderCount,
    revenueCents: grossRevenueCents,
    refundedCents,
    netRevenueCents,
    supplierCostCents,
    supplierCostOrdersCount,
    unrecordedCostOrdersCount,
    shippingCostCents,
    otherExpensesCents,
    paymentFeeCents,
    paymentFeeOrdersCount,
    estimatedProfitCents,
    profitMarginPercent: Math.round(profitMarginPercent * 10) / 10,
  };
}

/**
 * Protege contra injeção de fórmulas no Excel (CSV Formula Injection)
 * Se o valor iniciar com '=', '+', '-', '@', '\t', prefixa com apóstrofo
 */
export function sanitizeCsvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  let str = String(value).trim();
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }
  // Se contiver ponto e vírgula, aspas ou quebra de linha, envolve em aspas duplas
  if (/[;"\n\r]/.test(str)) {
    str = `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function formatBrlDecimal(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return "—";
  return (cents / 100).toFixed(2).replace(".", ",");
}

export function generateOrdersCsv(orders: OrderFinanceRecord[], period: FinancePeriod = "all", now = new Date()): string {
  const filtered = orders.filter((o) => isOrderInPeriod(o.created_at, period, now));
  const headers = [
    "Pedido ID",
    "Data / Hora (UTC)",
    "Status",
    "Status Operacional",
    "Pedido Teste",
    "Fornecedor",
    "Valor Bruto (R$)",
    "Reembolso (R$)",
    "Venda Líquida (R$)",
    "Custo Fornecedor (R$)",
    "Taxa Mercado Pago (R$)",
    "Frete Registrado (R$)",
    "Outras Despesas (R$)",
    "Lucro Estimado (R$)",
    "Margem (%)",
  ];

  const rows = filtered.map((order) => {
    const paid = isOrderPaid(order);
    const total = Math.max(0, Number(order.total_cents || 0));
    const refunded = Math.max(0, Number(order.refunded_cents || 0));
    const net = paid ? Math.max(0, total - refunded) : 0;
    const hasCost = order.supplier_cost_cents !== null && order.supplier_cost_cents !== undefined;
    const cost = hasCost ? Number(order.supplier_cost_cents) : 0;
    const hasFee = order.payment_fee_cents !== null && order.payment_fee_cents !== undefined;
    const fee = hasFee ? Number(order.payment_fee_cents) : 0;
    const shippingCost = Number(order.shipping_cost_cents || 0);
    const otherCost = Number(order.other_expenses_cents || 0);

    let profitCell = "—";
    let marginCell = "—";

    if (paid && hasCost) {
      const profit = net - cost - fee - shippingCost - otherCost;
      profitCell = formatBrlDecimal(profit);
      marginCell = net > 0 ? `${((profit / net) * 100).toFixed(1).replace(".", ",")}%` : "0,0%";
    }

    return [
      sanitizeCsvCell(order.id.slice(0, 8).toUpperCase()),
      sanitizeCsvCell(order.created_at),
      sanitizeCsvCell(order.status),
      sanitizeCsvCell(order.operational_status ?? "aguardando_pagamento"),
      sanitizeCsvCell(order.is_test ? "SIM" : "NÃO"),
      sanitizeCsvCell(order.supplier_name ?? "—"),
      sanitizeCsvCell(paid ? formatBrlDecimal(total) : "0,00"),
      sanitizeCsvCell(formatBrlDecimal(refunded)),
      sanitizeCsvCell(paid ? formatBrlDecimal(net) : "0,00"),
      sanitizeCsvCell(hasCost ? formatBrlDecimal(cost) : "—"),
      sanitizeCsvCell(hasFee ? formatBrlDecimal(fee) : "—"),
      sanitizeCsvCell(formatBrlDecimal(shippingCost)),
      sanitizeCsvCell(formatBrlDecimal(otherCost)),
      sanitizeCsvCell(profitCell),
      sanitizeCsvCell(marginCell),
    ].join(";");
  });

  // UTF-8 BOM (\uFEFF) para garantir abertura correta no Excel brasileiro
  return `\uFEFF${headers.join(";")}\r\n${rows.join("\r\n")}`;
}
