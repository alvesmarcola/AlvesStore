import { NextResponse } from "next/server";
import { InvalidOrderError, shippingQuoteRequestSchema, validateOrderLines } from "@/lib/payment/order";
import { getShippingQuotes, ShippingConfigurationError, ShippingProviderError } from "@/lib/server/correios";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json({ error: "A solicitação de frete não contém JSON válido." }, { status: 400 });
  }

  const parsed = shippingQuoteRequestSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json({
      error: "Informe os produtos e um CEP válido.",
      details: parsed.error.issues.map((issue) => ({ field: issue.path.join("."), message: issue.message })),
    }, { status: 400 });
  }

  try {
    const lines = validateOrderLines(parsed.data.items);
    const quotes = await getShippingQuotes(lines, parsed.data.cep);
    return NextResponse.json({ quotes });
  } catch (error) {
    if (error instanceof InvalidOrderError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (error instanceof ShippingConfigurationError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    if (error instanceof ShippingProviderError) {
      console.error("Falha na cotação dos Correios:", error.message);
      return NextResponse.json({ error: "Não foi possível cotar o frete nos Correios agora. Tente novamente." }, { status: 502 });
    }
    console.error("Falha inesperada na cotação dos Correios.");
    return NextResponse.json({ error: "O serviço de frete está temporariamente indisponível." }, { status: 500 });
  }
}
