export type OrderLike = {
  status: string;
  created_at: string;
  mercado_pago_status?: string | null;
  operational_status?: string | null;
};

const FORTY_EIGHT_HOURS_MS = 48 * 60 * 60 * 1000;

export function isOrderPaid(order: OrderLike): boolean {
  return ["pago", "enviado", "approved"].includes(order.status) || order.mercado_pago_status === "approved";
}

export function isOrderExpired(order: OrderLike, now = Date.now()): boolean {
  if (isOrderPaid(order)) return false;
  if (order.status === "cancelled" || order.operational_status === "cancelado" || order.operational_status === "expirado") {
    return true;
  }
  if (order.status !== "pending") return false;
  const createdAtMs = new Date(order.created_at).getTime();
  if (!Number.isFinite(createdAtMs)) return false;
  return now - createdAtMs > FORTY_EIGHT_HOURS_MS;
}

export function isOrderPending(order: OrderLike, now = Date.now()): boolean {
  return order.status === "pending" && !isOrderPaid(order) && !isOrderExpired(order, now);
}

