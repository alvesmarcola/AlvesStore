import { normalizedPaymentStatus } from "@/lib/server/webhook-signature";
import type { PaymentEnvironment } from "@/lib/server/mercado-pago";

const ORDER_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type MercadoPagoPaymentFields = {
  id?: string | number;
  status?: string;
  currency_id?: string;
  live_mode?: boolean;
  external_reference?: string;
  transaction_amount?: number;
  payment_method_id?: string | null;
  payment_type_id?: string | null;
};

export function validateMercadoPagoPayment(
  paymentId: string,
  payment: MercadoPagoPaymentFields,
  environment: PaymentEnvironment,
) {
  const resolvedPaymentId = payment.id === undefined ? "" : String(payment.id);
  const amount = payment.transaction_amount;
  const orderId = payment.external_reference ?? "";
  const status = normalizedPaymentStatus(payment.status);

  if (!/^\d{1,30}$/.test(paymentId) || resolvedPaymentId !== paymentId
    || payment.live_mode !== (environment === "production")
    || payment.currency_id !== "BRL"
    || !ORDER_ID_PATTERN.test(orderId)
    || !status
    || typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0) {
    return undefined;
  }

  return {
    paymentId,
    orderId,
    status,
    providerStatus: payment.status ?? status,
    amountCents: Math.round(amount * 100),
    currency: payment.currency_id,
    liveMode: payment.live_mode,
    paymentMethodId: payment.payment_method_id ?? null,
    paymentTypeId: payment.payment_type_id ?? null,
  };
}
