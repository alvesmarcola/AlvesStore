import { MercadoPagoConfig, Payment, Preference } from "mercadopago";

export class PaymentConfigurationError extends Error {}

function getClient() {
  if (process.env.PAYMENT_ENVIRONMENT !== "test") {
    throw new PaymentConfigurationError("O backend aceita somente PAYMENT_ENVIRONMENT=test até a loja aprovar a ativação de produção.");
  }
  const accessToken = process.env.MERCADO_PAGO_ACCESS_TOKEN;
  if (!accessToken?.startsWith("TEST-")) {
    throw new PaymentConfigurationError("Configure um Access Token de teste do Mercado Pago (prefixo TEST-).");
  }
  return new MercadoPagoConfig({ accessToken, options: { timeout: 10_000 } });
}

export function getPreferenceClient() {
  return new Preference(getClient());
}

export function getPaymentClient() {
  return new Payment(getClient());
}

export function getSiteUrl() {
  const rawUrl = process.env.SITE_URL?.trim();
  if (!rawUrl) throw new PaymentConfigurationError("Configure SITE_URL para gerar as URLs de retorno do checkout.");

  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new PaymentConfigurationError("SITE_URL deve ser uma URL absoluta válida.");
  }

  if (parsed.protocol !== "https:" && !(process.env.NODE_ENV !== "production" && parsed.hostname === "localhost")) {
    throw new PaymentConfigurationError("SITE_URL deve usar HTTPS fora do desenvolvimento local.");
  }
  if (parsed.pathname !== "/" || parsed.search || parsed.hash) {
    throw new PaymentConfigurationError("SITE_URL deve conter somente a origem, sem caminho ou parâmetros.");
  }
  return parsed.origin;
}
