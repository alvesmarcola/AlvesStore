import { randomUUID } from "node:crypto";
import type { VerifiedOrderLine } from "@/lib/payment/order";

const correiosApi = "https://api.correios.com.br";
const freeShippingQuantity = 3;

export class ShippingConfigurationError extends Error {}
export class ShippingProviderError extends Error {}

type CorreiosService = { code: string; label: string };
type PackageSpec = { weightKg: number; lengthCm: number; widthCm: number; heightCm: number };
export type ShippingQuote = { serviceCode: string; label: string; priceCents: number };
type Fetcher = typeof fetch;

function readServiceConfiguration(): { services: CorreiosService[]; packages: Record<string, PackageSpec> } {
  const serviceJson = process.env.CORREIOS_SERVICES_JSON;
  const packageJson = process.env.CORREIOS_PACKAGE_SPECS_JSON;
  if (!serviceJson || !packageJson) {
    throw new ShippingConfigurationError("Configure os serviços e as dimensões reais dos pacotes dos Correios.");
  }

  let services: CorreiosService[];
  let packages: Record<string, PackageSpec>;
  try {
    services = JSON.parse(serviceJson) as CorreiosService[];
    packages = JSON.parse(packageJson) as Record<string, PackageSpec>;
  } catch {
    throw new ShippingConfigurationError("A configuração dos serviços ou pacotes dos Correios não é um JSON válido.");
  }

  if (!Array.isArray(services) || services.length === 0 || services.length > 10
    || services.some((service) => !service || !/^[A-Za-z0-9]{1,12}$/.test(service.code)
      || typeof service.label !== "string" || !service.label.trim() || service.label.length > 40)
    || new Set(services.map((service) => service.code)).size !== services.length) {
    throw new ShippingConfigurationError("Configure ao menos um serviço válido dos Correios.");
  }

  for (const quantity of [1, 2]) {
    const spec = packages[String(quantity)];
    if (!spec || ![spec.weightKg, spec.lengthCm, spec.widthCm, spec.heightCm].every(
      (value) => typeof value === "number" && Number.isFinite(value) && value > 0,
    )) {
      throw new ShippingConfigurationError(`Configure peso e dimensões reais para o pacote de ${quantity} camisa(s).`);
    }
  }

  return { services, packages };
}

function requiredEnvironment(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new ShippingConfigurationError(`Configure ${name} na Vercel.`);
  return value;
}

async function readJsonResponse(response: Response) {
  if (!response.ok) {
    throw new ShippingProviderError(`Os Correios responderam com HTTP ${response.status}.`);
  }
  try {
    return await response.json() as unknown;
  } catch {
    throw new ShippingProviderError("A resposta dos Correios não pôde ser interpretada.");
  }
}

async function callCorreios(fetcher: Fetcher, url: string, init: RequestInit) {
  try {
    return await fetcher(url, init);
  } catch {
    throw new ShippingProviderError("Não foi possível conectar à API dos Correios.");
  }
}

async function getCorreiosToken(fetcher: Fetcher) {
  const username = requiredEnvironment("CORREIOS_API_USERNAME");
  const accessCode = requiredEnvironment("CORREIOS_API_ACCESS_CODE");
  const postingCard = requiredEnvironment("CORREIOS_POSTING_CARD");
  const response = await callCorreios(fetcher, `${correiosApi}/token/v1/autentica/cartaopostagem`, {
    method: "POST",
    headers: {
      authorization: `Basic ${Buffer.from(`${username}:${accessCode}`).toString("base64")}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ numero: postingCard }),
    signal: AbortSignal.timeout(8_000),
  });
  const data = await readJsonResponse(response);
  if (!data || typeof data !== "object" || !("token" in data) || typeof data.token !== "string" || !data.token) {
    throw new ShippingProviderError("A autenticação dos Correios não retornou um token válido.");
  }
  return data.token;
}

function parsePriceCents(value: unknown) {
  if (typeof value !== "string" && typeof value !== "number") return undefined;
  const amount = Number(String(value).replace(",", "."));
  if (!Number.isFinite(amount) || amount < 0) return undefined;
  return Math.round(amount * 100);
}

export async function getShippingQuotes(
  lines: VerifiedOrderLine[],
  destinationCep: string,
  fetcher: Fetcher = fetch,
): Promise<ShippingQuote[]> {
  const quantity = lines.reduce((sum, line) => sum + line.quantity, 0);
  if (quantity >= freeShippingQuantity) return [];

  const originCep = requiredEnvironment("CORREIOS_ORIGIN_CEP").replace(/\D/g, "");
  if (!/^\d{8}$/.test(originCep)) throw new ShippingConfigurationError("CORREIOS_ORIGIN_CEP deve conter 8 dígitos.");
  const { services, packages } = readServiceConfiguration();
  const packageSpec = packages[String(quantity)];
  const token = await getCorreiosToken(fetcher);
  const params = services.map((service, index) => ({
    coProduto: service.code,
    nuRequisicao: index + 1,
    cepOrigem: originCep,
    cepDestino: destinationCep,
    psObjeto: String(packageSpec.weightKg),
    tpObjeto: "2",
    comprimento: packageSpec.lengthCm,
    largura: packageSpec.widthCm,
    altura: packageSpec.heightCm,
    servicosAdicionais: [],
    vlDeclarado: "0",
  }));

  const response = await callCorreios(fetcher, `${correiosApi}/preco/v1/nacional`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({ idLote: randomUUID(), parametrosProduto: params }),
    signal: AbortSignal.timeout(8_000),
  });
  const result = await readJsonResponse(response);
  if (!Array.isArray(result)) throw new ShippingProviderError("Os Correios não retornaram uma lista de cotações.");

  const quotes = result.flatMap((entry): ShippingQuote[] => {
    if (!entry || typeof entry !== "object" || !("coProduto" in entry) || typeof entry.coProduto !== "string") return [];
    const service = services.find((candidate) => candidate.code === entry.coProduto);
    const priceCents = "pcFinal" in entry ? parsePriceCents(entry.pcFinal) : undefined;
    return service && priceCents !== undefined ? [{ serviceCode: service.code, label: service.label, priceCents }] : [];
  });

  if (!quotes.length) throw new ShippingProviderError("Os Correios não retornaram nenhum preço para os serviços configurados.");
  return quotes.sort((a, b) => a.priceCents - b.priceCents);
}
