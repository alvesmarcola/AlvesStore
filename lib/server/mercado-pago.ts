import { MercadoPagoConfig, Payment } from "mercadopago";

const DEFAULT_SITE_URL = "https://importsalves.com.br";

export class PaymentConfigurationError extends Error {
  constructor(message: string, readonly missing: string[] = []) {
    super(message);
    this.name = "PaymentConfigurationError";
  }
}

export type PaymentEnvironment = "test" | "production";

export class MercadoPagoApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly rawText: string,
    readonly providerCause?: string,
  ) {
    super(message);
    this.name = "MercadoPagoApiError";
  }
}

export type MercadoPagoPreference = {
  id?: string;
  init_point?: string;
};

function cleanEnvValue(value: string | undefined) {
  return value?.trim().replace(/^["']|["']$/g, "") ?? "";
}

function readAccessToken() {
  return cleanEnvValue(process.env.MERCADO_PAGO_ACCESS_TOKEN)
    || cleanEnvValue(process.env.MERCADOPAGO_ACCESS_TOKEN)
    || cleanEnvValue(process.env.MP_ACCESS_TOKEN)
    || cleanEnvValue(process.env.MP_TOKEN);
}

function getAccessToken() {
  const token = readAccessToken();
  if (!token) {
    throw new PaymentConfigurationError(
      "Credencial ausente: MERCADO_PAGO_ACCESS_TOKEN (ou MP_ACCESS_TOKEN).",
      ["MERCADO_PAGO_ACCESS_TOKEN", "MP_ACCESS_TOKEN"],
    );
  }
  if (token.startsWith("sk_")) {
    throw new PaymentConfigurationError(
      "O token configurado parece ser do Stripe (prefixo lido: sk_****); informe um Access Token do Mercado Pago.",
    );
  }
  if (token.startsWith("APP_USR-") && token.length < 50) {
    throw new PaymentConfigurationError(
      "O valor APP_USR- configurado é curto demais para um Access Token (prefixo lido: APP_USR-****; tamanho: "
        + token.length + "). Confira se foi copiada uma Public Key por engano.",
    );
  }
  return token;
}

export function validateMercadoPagoAccessToken() {
  getPaymentEnvironment();
  getAccessToken();
}

export function getPaymentEnvironment(): PaymentEnvironment {
  const environment = cleanEnvValue(process.env.PAYMENT_ENVIRONMENT);
  if (environment !== "test" && environment !== "production") {
    throw new PaymentConfigurationError(
      "PAYMENT_ENVIRONMENT é obrigatório e deve ser exatamente 'test' ou 'production'.",
      ["PAYMENT_ENVIRONMENT"],
    );
  }
  return environment;
}

export function getCheckoutUrl(preference: MercadoPagoPreference) {
  if (!preference.init_point) return undefined;
  try {
    const url = new URL(preference.init_point);
    const host = url.hostname.toLowerCase();
    const trustedHost = host === "mercadopago.com.br"
      || host.endsWith(".mercadopago.com.br")
      || host === "mercadopago.com"
      || host.endsWith(".mercadopago.com");
    return url.protocol === "https:" && !url.username && !url.password && !url.port && trustedHost
      ? url.toString()
      : undefined;
  } catch {
    return undefined;
  }
}

function firstString(value: unknown): string | undefined {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (Array.isArray(value)) {
    for (const item of value) {
      if (typeof item === "string" && item.trim()) return item.trim();
      if (typeof item === "object" && item !== null) {
        const record = item as Record<string, unknown>;
        const candidate = record.description ?? record.message ?? record.code;
        if (typeof candidate === "string" && candidate.trim()) return candidate.trim();
      }
    }
  }
  if (typeof value === "object" && value !== null) {
    const record = value as Record<string, unknown>;
    const candidate = record.description ?? record.message ?? record.code;
    if (typeof candidate === "string" && candidate.trim()) return candidate.trim();
  }
  return undefined;
}

export async function createMercadoPagoPreference(
  body: Record<string, unknown>,
  idempotencyKey: string,
): Promise<MercadoPagoPreference> {
  const token = getAccessToken();
  let response: Response;
  try {
    response = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: {
        authorization: "Bearer " + token,
        "content-type": "application/json",
        "x-idempotency-key": idempotencyKey,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10_000),
      cache: "no-store",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha de conexão desconhecida.";
    throw new Error("Falha de conexão com o Mercado Pago: " + message, { cause: error });
  }

  const rawText = await response.text();
  let payload: Record<string, unknown> = {};
  try {
    const parsed: unknown = JSON.parse(rawText);
    if (typeof parsed === "object" && parsed !== null) payload = parsed as Record<string, unknown>;
  } catch {
    // Preserva o corpo textual para diagnóstico de respostas não JSON.
  }

  if (!response.ok) {
    const providerMessage = firstString(payload.message)
      || firstString(payload.cause)
      || firstString(payload.error);
    throw new MercadoPagoApiError(
      response.status,
      providerMessage || rawText.slice(0, 1500) || response.statusText || "Resposta sem detalhes.",
      rawText.slice(0, 4000),
      firstString(payload.cause),
    );
  }

  return payload as MercadoPagoPreference;
}

export function isProductionPaymentEnvironment() {
  return getPaymentEnvironment() === "production";
}

export function getPaymentClient() {
  getPaymentEnvironment();
  return new Payment(new MercadoPagoConfig({
    accessToken: getAccessToken(),
    options: { timeout: 10_000 },
  }));
}

export function resolveSiteUrl(configured: string | undefined, requestUrl: string | undefined, development: boolean) {
  const value = cleanEnvValue(configured);
  if (value) {
    let url: URL;
    try {
      url = new URL(value);
    } catch {
      throw new PaymentConfigurationError("SITE_URL deve ser uma URL válida.");
    }

    const loopback = ["localhost", "127.0.0.1", "::1"].includes(url.hostname.toLowerCase());
    if (url.username || url.password || (url.protocol !== "https:" && !(development && loopback && url.protocol === "http:"))) {
      throw new PaymentConfigurationError("SITE_URL deve usar HTTPS; HTTP só é permitido para localhost em desenvolvimento.");
    }
    return url.origin;
  }

  if (development && requestUrl) {
    try {
      const requestOrigin = new URL(requestUrl);
      if (["localhost", "127.0.0.1", "::1"].includes(requestOrigin.hostname.toLowerCase())
        && (requestOrigin.protocol === "http:" || requestOrigin.protocol === "https:")) {
        return requestOrigin.origin;
      }
    } catch {
      throw new PaymentConfigurationError("Não foi possível determinar a URL local do checkout.");
    }
  }

  return development ? "http://localhost:3000" : DEFAULT_SITE_URL;
}

export function getSiteUrl(requestUrl?: string) {
  const configured = cleanEnvValue(process.env.SITE_URL)
    || cleanEnvValue(process.env.NEXT_PUBLIC_SITE_URL);
  return resolveSiteUrl(configured, requestUrl, process.env.NODE_ENV === "development");
}
