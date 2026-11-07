import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateFinancialSummary,
  generateOrdersCsv,
  getPeriodDateRange,
  isOrderInPeriod,
  sanitizeCsvCell,
  formatBrlDecimal,
  type OrderFinanceRecord,
} from "@/lib/finance";
import {
  calculatePaymentFee,
  calculateRefundAmount,
  snapshotOrderCostsOnFirstApproval,
} from "@/lib/server/mercado-pago-payments";
import { isOrderPaid, isOrderRefunded } from "@/lib/order-status";
import { isPartnerRole } from "@/lib/server/admin-auth";

test("1. Idempotência do snapshot de custo: não sobrescreve custo existente nem ajuste manual", async () => {
  let updatedData: any = null;
  const mockSupabase = {
    from: (table: string) => ({
      select: () => ({
        in: () => Promise.resolve({
          data: [{ product_id: "prod-1", supplier_name: "Fornecedor Alpha", supplier_cost: 60.0 }],
          error: null,
        }),
      }),
      update: (data: any) => ({
        eq: (_col: string, _val: any) => {
          updatedData = data;
          return Promise.resolve({ data: null, error: null });
        },
      }),
    }),
  } as any;

  // Caso A: Pedido sem custo registrado (primeira aprovação) -> snapshot executado
  await snapshotOrderCostsOnFirstApproval(
    mockSupabase,
    "order-1",
    null, // sem custo existente
    null,
    [{ productId: "prod-1", quantity: 2 }]
  );
  assert.equal(updatedData?.supplier_cost_cents, 12000); // 2 * R$ 60,00 = R$ 120,00
  assert.equal(updatedData?.supplier_name, "Fornecedor Alpha");

  // Caso B: Webhook duplicado ou notificação posterior com custo já gravado (ex: R$ 120,00) -> NÃO altera
  updatedData = null;
  await snapshotOrderCostsOnFirstApproval(
    mockSupabase,
    "order-1",
    12000,
    "Fornecedor Alpha",
    [{ productId: "prod-1", quantity: 2 }]
  );
  assert.equal(updatedData, null); // Não houve update

  // Caso C: Custo ajustado manualmente pelo admin (ex: R$ 110,00) -> preserva ajuste manual
  updatedData = null;
  await snapshotOrderCostsOnFirstApproval(
    mockSupabase,
    "order-1",
    11000,
    "Fornecedor Ajustado Manualmente",
    [{ productId: "prod-1", quantity: 2 }]
  );
  assert.equal(updatedData, null); // Não sobrescreve ajuste manual
});

test("2. Captura da taxa do Mercado Pago: prioriza fee_details real e possui fallback percentual", () => {
  // Caso A: taxa real presente em fee_details
  const feeWithDetails = calculatePaymentFee({
    transaction_amount: 180,
    payment_type_id: "credit_card",
    fee_details: [
      { type: "mercadopago_fee", amount: 7.18 },
      { type: "financing_fee", amount: 1.50 },
    ],
  }, 18000, "credit_card");
  assert.equal(feeWithDetails, 868); // (7.18 + 1.50) * 100 = 868 centavos

  // Caso B: net_received_amount presente
  const feeWithNet = calculatePaymentFee({
    transaction_amount: 100,
    net_received_amount: 96.01,
  }, 10000, "credit_card");
  assert.equal(feeWithNet, 399); // 100 - 96.01 = 3.99 -> 399 centavos

  // Caso C: fallback para Pix (0.99%)
  const feePixFallback = calculatePaymentFee({
    transaction_amount: 150,
  }, 15000, "pix");
  assert.equal(feePixFallback, 149); // 150 * 0.0099 = 1.485 -> 149 centavos

  // Caso D: fallback para Cartão de Crédito (3.99%)
  const feeCardFallback = calculatePaymentFee({
    transaction_amount: 200,
  }, 20000, "credit_card");
  assert.equal(feeCardFallback, 798); // 200 * 0.0399 = 7.98 -> 798 centavos
});

test("3. Estornos e reembolsos parciais e totais", () => {
  // Parcial
  const partialRefund = calculateRefundAmount({
    transaction_amount: 300,
    transaction_amount_refunded: 100,
  }, 30000);
  assert.equal(partialRefund.isTotalRefund, false);
  assert.equal(partialRefund.refundedCents, 10000); // 100 * 100

  // Total
  const totalRefund = calculateRefundAmount({
    status: "refunded",
    transaction_amount: 300,
    transaction_amount_refunded: 300,
  }, 30000);
  assert.equal(totalRefund.isTotalRefund, true);
  assert.equal(totalRefund.refundedCents, 30000);

  // isOrderRefunded
  assert.equal(isOrderRefunded({ status: "refunded", created_at: "2026-11-05T00:00:00Z" }), true);
  assert.equal(isOrderRefunded({ status: "charged_back", created_at: "2026-11-05T00:00:00Z" }), true);
  assert.equal(isOrderRefunded({ status: "reembolsado", created_at: "2026-11-05T00:00:00Z" }), true);
  assert.equal(isOrderRefunded({ status: "approved", created_at: "2026-11-05T00:00:00Z" }), false);
});

test("4. Pedidos de teste são completamente isolados das métricas financeiras", () => {
  const orders: OrderFinanceRecord[] = [
    {
      id: "21cf6548-0000-0000-0000-000000000000",
      created_at: "2026-11-05T12:00:00Z",
      status: "approved",
      mercado_pago_status: "approved",
      total_cents: 150, // Pedido de teste de R$ 1,50
      supplier_cost_cents: 0,
      payment_fee_cents: 1,
      is_test: true,
    },
    {
      id: "order-real-1",
      created_at: "2026-11-05T14:00:00Z",
      status: "approved",
      mercado_pago_status: "approved",
      total_cents: 18000, // R$ 180,00
      supplier_cost_cents: 6000, // R$ 60,00
      payment_fee_cents: 718, // R$ 7,18
      shipping_cost_cents: 2000,
      other_expenses_cents: 500,
      is_test: false,
    },
  ];

  const summary = calculateFinancialSummary(orders, "all");
  assert.equal(summary.testOrderCount, 1);
  assert.equal(summary.paidOrderCount, 1); // Somente o pedido real
  assert.equal(summary.revenueCents, 18000); // Não inclui os R$ 1,50 do teste!
  assert.equal(summary.supplierCostCents, 6000);
  assert.equal(summary.paymentFeeCents, 718);
  // Lucro: 18000 - 6000 - 718 - 2000 - 500 = 8782 centavos (R$ 87,82)
  assert.equal(summary.estimatedProfitCents, 8782);
  assert.equal(summary.profitMarginPercent, 48.8); // 8782 / 18000 = 48.78% -> 48.8%
});

test("5. Pedidos sem custo (supplier_cost_cents nulo) não presumem 100% de lucro e são contabilizados", () => {
  const orders: OrderFinanceRecord[] = [
    {
      id: "order-sem-custo",
      created_at: "2026-11-05T14:00:00Z",
      status: "approved",
      mercado_pago_status: "approved",
      total_cents: 20000,
      supplier_cost_cents: null, // Sem custo cadastrado
      payment_fee_cents: 200,
      is_test: false,
    },
  ];

  const summary = calculateFinancialSummary(orders, "all");
  assert.equal(summary.unrecordedCostOrdersCount, 1);
  assert.equal(summary.supplierCostOrdersCount, 0);
  assert.equal(summary.supplierCostCents, 0);
  // Formatação com travessão
  assert.equal(formatBrlDecimal(orders[0].supplier_cost_cents), "—");
});

test("6. Filtro por período respeita o fuso horário America/Sao_Paulo (UTC-3)", () => {
  // Teste de data no fuso de Brasília
  const fakeNow = new Date("2026-11-07T18:00:00.000-03:00");
  const todayRange = getPeriodDateRange("today", fakeNow);
  assert.ok(todayRange.start);
  assert.ok(todayRange.end);

  // Pedido feito hoje às 10:00 em Brasília
  const orderToday = "2026-11-07T13:00:00.000Z"; // 10:00 UTC-3
  assert.equal(isOrderInPeriod(orderToday, "today", fakeNow), true);

  // Pedido feito ontem às 23:59 em Brasília
  const orderYesterday = "2026-11-07T02:59:00.000Z"; // 23:59 de 06/11 no UTC-3
  assert.equal(isOrderInPeriod(orderYesterday, "today", fakeNow), false);

  // Black Friday (01/11 a 01/12/2026 23:59:59 Brasília)
  const orderBlackFriday = "2026-11-15T15:00:00.000Z";
  assert.equal(isOrderInPeriod(orderBlackFriday, "black_friday", fakeNow), true);

  const orderForaBlackFriday = "2026-12-02T03:00:01.000Z"; // Passou de 01/12 23:59:59 no UTC-3
  assert.equal(isOrderInPeriod(orderForaBlackFriday, "black_friday", fakeNow), false);
});

test("7. Geração de CSV com UTF-8 BOM, ponto e vírgula, vírgula decimal e proteção contra Formula Injection", () => {
  const orders: OrderFinanceRecord[] = [
    {
      id: "abc-12345678",
      created_at: "2026-11-05T12:00:00Z",
      status: "approved",
      operational_status: "pedido_realizado",
      is_test: false,
      supplier_name: "=cmd|' /C calc'!A0", // Tentativa de injeção de fórmula
      total_cents: 18550, // R$ 185,50
      refunded_cents: 0,
      supplier_cost_cents: 6000,
      payment_fee_cents: 740,
      shipping_cost_cents: 2000,
      other_expenses_cents: 0,
    },
    {
      id: "def-87654321",
      created_at: "2026-11-05T14:00:00Z",
      status: "approved",
      operational_status: "enviado",
      is_test: true,
      supplier_name: "@SUM(1+1)", // Outra tentativa de fórmula
      total_cents: 150,
      supplier_cost_cents: null,
      payment_fee_cents: null,
    },
  ];

  // Sanitização de células contra formula injection
  assert.equal(sanitizeCsvCell("=1+1"), "'=1+1");
  assert.equal(sanitizeCsvCell("+cmd"), "'+cmd");
  assert.equal(sanitizeCsvCell("-5"), "'-5");
  assert.equal(sanitizeCsvCell("@SUM"), "'@SUM");
  assert.equal(sanitizeCsvCell("Normal"), "Normal");

  const csv = generateOrdersCsv(orders, "all");
  // Deve iniciar com BOM UTF-8 (\uFEFF)
  assert.ok(csv.startsWith("\uFEFF"));
  // Separador de colunas deve ser ponto e vírgula
  assert.ok(csv.includes(";"));
  // Vírgula decimal (185,50)
  assert.ok(csv.includes("185,50"));
  // Injeções escapadas com apóstrofo
  assert.ok(csv.includes("'=cmd|' /C calc'!A0") || csv.includes("\"'=cmd|' /C calc'!A0\""));
  assert.ok(csv.includes("'@SUM(1+1)") || csv.includes("\"'@SUM(1+1)\""));
});

test("8. Permissões de parceiro/sócio (role partner)", () => {
  const reqPartner = new Request("https://www.importsalves.com.br/api/admin/orders", {
    headers: {
      "x-admin-role": "partner",
    },
  });
  assert.equal(isPartnerRole(reqPartner), true);

  const reqAdmin = new Request("https://www.importsalves.com.br/api/admin/orders", {
    headers: {
      "x-admin-role": "admin",
    },
  });
  assert.equal(isPartnerRole(reqAdmin), false);
});
