import { MercadoPagoConfig, Payment } from "mercadopago";

const DEFAULT_SITE_URL = "https://alves-store-green.vercel.app";

export class PaymentConfigurationError extends Error {
  constructor(message: string, readonly missing: string[] = []) {
    super(message);
    this.name = "PaymentConfigurationError";
  }
}

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
  sandbox_init_point?: string;
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
  getAccessToken();
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
  const explicit = cleanEnvValue(process.env.PAYMENT_ENVIRONMENT).toLowerCase();
  if (explicit === "production" || explicit === "prod") return true;
  if (explicit === "test" || explicit === "sandbox") return false;
  return readAccessToken().startsWith("APP_USR-");
}

export function getPaymentClient() {
  return new Payment(new MercadoPagoConfig({
    accessToken: getAccessToken(),
    options: { timeout: 10_000 },
  }));
}

export function getSiteUrl() {
  const configured = cleanEnvValue(process.env.SITE_URL)
    || cleanEnvValue(process.env.NEXT_PUBLIC_SITE_URL);
  if (!configured) return DEFAULT_SITE_URL;

  let candidate = configured.replace(/\/+$/, "");
  if (/^http:\/\//i.test(candidate)) candidate = candidate.replace(/^http:\/\//i, "https://");
  else if (!/^https:\/\//i.test(candidate)) candidate = "https://" + candidate;

  try {
    const parsed = new URL(candidate);
    if (parsed.protocol === "https:" && parsed.hostname) return parsed.origin;
  } catch {
    // Usa o domínio fixo seguro abaixo quando a variável não formar uma origem HTTPS.
  }
  return DEFAULT_SITE_URL;
}
