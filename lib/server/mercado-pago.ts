import { MercadoPagoConfig, Payment, Preference } from "mercadopago";

export class PaymentConfigurationError extends Error {
  constructor(message: string, readonly missing: string[] = []) { super(message); }
}

function getAccessToken() {
  return process.env.MERCADO_PAGO_ACCESS_TOKEN?.trim()
    || process.env.MERCADOPAGO_ACCESS_TOKEN?.trim()
    || process.env.MP_ACCESS_TOKEN?.trim()
    || process.env.MP_TOKEN?.trim();
}

function getClient() {
  const accessToken = getAccessToken();
  if (!accessToken) {
    throw new PaymentConfigurationError(
      "Credencial ausente: MERCADO_PAGO_ACCESS_TOKEN (ou MP_ACCESS_TOKEN).",
      ["MERCADO_PAGO_ACCESS_TOKEN", "MP_ACCESS_TOKEN"],
    );
  }
  return new MercadoPagoConfig({ accessToken, options: { timeout: 10_000 } });
}

export function isProductionPaymentEnvironment() {
  const explicit = process.env.PAYMENT_ENVIRONMENT?.trim().toLowerCase();
  if (explicit === "production" || explicit === "prod") return true;
  if (explicit === "test" || explicit === "sandbox") return false;
  return getAccessToken()?.startsWith("APP_USR-") ?? false;
}

export function getPreferenceClient() {
  return new Preference(getClient());
}

export function getPaymentClient() {
  return new Payment(getClient());
}

export function getSiteUrl() {
  const rawUrl = process.env.SITE_URL?.trim() || process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (!rawUrl) {
    throw new PaymentConfigurationError(
      "Credencial ausente: SITE_URL (ou NEXT_PUBLIC_SITE_URL) para URLs de retorno.",
      ["SITE_URL"],
    );
  }

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
