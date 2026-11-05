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

  if (!/^\d{1,30}$/.test(paymentId) || resolvedPaymentId !== paymentId) {
    console.warn(`[Mercado Pago Validation] ID de pagamento inválido ou divergente: informado='${paymentId}', retornado='${resolvedPaymentId}'`);
    return undefined;
  }
  if (payment.live_mode !== (environment === "production")) {
    console.warn(`[Mercado Pago Validation] Divergência de ambiente: payment.live_mode=${payment.live_mode} enquanto environment=${environment}. Em produção, PAYMENT_ENVIRONMENT deve ser 'production'.`);
    return undefined;
  }
  if (payment.currency_id !== "BRL") {
    console.warn(`[Mercado Pago Validation] Moeda não suportada: ${payment.currency_id}`);
    return undefined;
  }
  if (!ORDER_ID_PATTERN.test(orderId)) {
    console.warn(`[Mercado Pago Validation] external_reference '${orderId}' não é um UUID de pedido válido.`);
    return undefined;
  }
  if (!status) {
    console.warn(`[Mercado Pago Validation] Status do Mercado Pago desconhecido: ${payment.status}`);
    return undefined;
  }
  if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0) {
    console.warn(`[Mercado Pago Validation] Valor da transação inválido: ${amount}`);
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
