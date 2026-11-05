import test from "node:test";
import assert from "node:assert/strict";
import { isOrderPaid, isOrderExpired, isOrderPending } from "../lib/order-status";

test("isOrderPaid reconhece status e mercado_pago_status aprovados", () => {
  assert.equal(isOrderPaid({ status: "pago", created_at: new Date().toISOString() }), true);
  assert.equal(isOrderPaid({ status: "approved", created_at: new Date().toISOString() }), true);
  assert.equal(isOrderPaid({ status: "enviado", created_at: new Date().toISOString() }), true);
  assert.equal(isOrderPaid({ status: "pending", mercado_pago_status: "approved", created_at: new Date().toISOString() }), true);

  assert.equal(isOrderPaid({ status: "pending", mercado_pago_status: "pending", created_at: new Date().toISOString() }), false);
  assert.equal(isOrderPaid({ status: "cancelled", created_at: new Date().toISOString() }), false);
});

test("isOrderExpired detecta pedidos pendentes há mais de 48 horas", () => {
  const now = new Date("2026-11-05T12:00:00Z").getTime();
  const recentCreatedAt = new Date("2026-11-04T12:00:00Z").toISOString(); // 24h atrás
  const expiredCreatedAt = new Date("2026-11-03T11:00:00Z").toISOString(); // 49h atrás

  assert.equal(isOrderExpired({ status: "pending", created_at: recentCreatedAt }, now), false);
  assert.equal(isOrderExpired({ status: "pending", created_at: expiredCreatedAt }, now), true);

  // Pedidos explicitamente cancelados ou expirados contam como expirados/abandonados
  assert.equal(isOrderExpired({ status: "cancelled", created_at: recentCreatedAt }, now), true);
  assert.equal(isOrderExpired({ status: "pending", operational_status: "cancelado", created_at: recentCreatedAt }, now), true);
  assert.equal(isOrderExpired({ status: "pending", operational_status: "expirado", created_at: recentCreatedAt }, now), true);

  // Pedido aprovado nunca é expirado
  assert.equal(isOrderExpired({ status: "pago", created_at: expiredCreatedAt }, now), false);
  assert.equal(isOrderExpired({ status: "pending", mercado_pago_status: "approved", created_at: expiredCreatedAt }, now), false);
});

test("isOrderPending detecta pedidos pendentes dentro do prazo de 48 horas", () => {
  const now = new Date("2026-11-05T12:00:00Z").getTime();
  const recentCreatedAt = new Date("2026-11-04T12:00:00Z").toISOString(); // 24h atrás
  const expiredCreatedAt = new Date("2026-11-03T11:00:00Z").toISOString(); // 49h atrás

  assert.equal(isOrderPending({ status: "pending", created_at: recentCreatedAt }, now), true);
  assert.equal(isOrderPending({ status: "pending", created_at: expiredCreatedAt }, now), false);
  assert.equal(isOrderPending({ status: "pago", created_at: recentCreatedAt }, now), false);
  assert.equal(isOrderPending({ status: "cancelled", created_at: recentCreatedAt }, now), false);
});

