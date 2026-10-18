import { createHash, randomUUID } from "node:crypto";
import { after, NextResponse } from "next/server";
import { InvalidOrderError, paymentRequestSchema, validateOrderLinesFromCatalog, calculateOrderTotals, calculateOrderFingerprint } from "@/lib/payment/order";
import { createMercadoPagoPreference, getSiteUrl, MercadoPagoApiError, PaymentConfigurationError, validateMercadoPagoAccessToken } from "@/lib/server/mercado-pago";
import { SupabaseOrdersConfigurationError, describeSupabaseError, getSupabaseOrdersClient } from "@/lib/server/supabase-orders";
import { buildPreferenceItems } from "@/lib/payment/preference-items";

export const runtime = "nodejs";
const requestWindows = new Map<string, { count: number; startedAt: number }>();
const RATE_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT = 15;

function isRateLimited(request: Request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const now = Date.now();
  const current = requestWindows.get(ip);
  if (!current || now - current.startedAt >= RATE_WINDOW_MS) {
    requestWindows.set(ip, { count: 1, startedAt: now });
    return false;
  }
  current.count += 1;
  if (requestWindows.size > 2000) for (const [key, window] of requestWindows) if (now - window.startedAt >= RATE_WINDOW_MS) requestWindows.delete(key);
  return current.count > RATE_LIMIT;
}

function jsonPrice(cents: number) {
  return Number((cents / 100).toFixed(2));
}

function publicError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  if (isRateLimited(request)) return publicError("Muitas tentativas. Aguarde alguns minutos e tente novamente.", 429);

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return publicError("A solicitação de pagamento não contém JSON válido.", 400);
  }

  const parsed = paymentRequestSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json({
      error: "Confira os dados do pedido e tente novamente.",
      details: parsed.error.issues.map((issue) => ({ field: issue.path.join("."), message: issue.message })),
    }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }

  const requestData = parsed.data;
  if (request.headers.get("idempotency-key") !== requestData.idempotencyKey) {
    return publicError("A chave de segurança do pedido é inválida.", 400);
  }

  let stage: "validation" | "supabase" | "mercado-pago" = "validation";
  try {
    const lines = await validateOrderLinesFromCatalog(requestData.items);
    const totals = calculateOrderTotals(lines);
    const requestHash = createHash("sha256").update(calculateOrderFingerprint(requestData)).digest("hex");
    const siteUrl = getSiteUrl();
    validateMercadoPagoAccessToken();
    const supabase = getSupabaseOrdersClient();
    stage = "supabase";

    const finalShippingCents = totals.shippingCents;
    const totalCents = totals.totalCents;
    const shippingLabel = finalShippingCents === 0 ? "Frete grátis" : "Frete fixo";
    const savedLines = lines.map(({ product, ...line }) => ({
      productId: product.id,
      slug: product.slug,
      title: product.nome,
      size: line.size,
      quantity: line.quantity,
      customization: line.customization ?? null,
      patches: line.patchOptions.map((patch, index) => ({
        id: patch.id,
        name: patch.name,
        image: patch.image ?? null,
        position: line.patches?.[index]?.position,
        priceCents: patch.priceCents,
      })),
    }));

    const inserted = await supabase.from("store_orders").upsert({
      id: randomUUID(),
      idempotency_key: requestData.idempotencyKey,
      request_hash: requestHash,
      item_lines: savedLines,
      customer: requestData.customer,
      shipping: { label: shippingLabel, priceCents: finalShippingCents },
      shirt_quantity: totals.quantity,
      shirts_cents: totals.shirtsCents,
      customization_cents: totals.customizationCents,
      patches_cents: totals.patchesCents,
      shipping_cents: finalShippingCents,
      total_cents: totalCents,
    }, { onConflict: "idempotency_key", ignoreDuplicates: true })
      .select("id, request_hash, checkout_url, status")
      .maybeSingle();
    if (inserted.error) throw inserted.error;

    let order = inserted.data;
    if (!order) {
      const existing = await supabase.from("store_orders")
        .select("id, request_hash, checkout_url, status")
        .eq("idempotency_key", requestData.idempotencyKey)
        .maybeSingle();
      if (existing.error) throw existing.error;
      order = existing.data;
    }
    if (!order?.id) throw new Error("Supabase não retornou o pedido gravado.");
    if (String(order.request_hash).trim() !== requestHash) {
      return publicError("Esta chave de pedido já foi usada com dados diferentes. Recarregue o checkout.", 409);
    }
    if (order.checkout_url) return NextResponse.json({ checkoutUrl: order.checkout_url, reused: true }, { headers: { "Cache-Control": "no-store" } });

    stage = "mercado-pago";
    const preference = await createMercadoPagoPreference({
      items: buildPreferenceItems(order.id, lines, totals),
      ...(finalShippingCents > 0 ? {
        shipments: { mode: "not_specified", cost: jsonPrice(finalShippingCents) },
      } : {}),
      external_reference: String(order.id),
      metadata: { store_order_id: String(order.id) },
      back_urls: {
        success: `${siteUrl}/pedido/retorno?order_id=${order.id}&return=approved`,
        pending: `${siteUrl}/pedido/retorno?order_id=${order.id}&return=pending`,
        failure: `${siteUrl}/pedido/retorno?order_id=${order.id}&return=rejected`,
      },
      ...(siteUrl.startsWith("https://") ? { auto_return: "approved" } : {}),
      notification_url: `${siteUrl}/api/mercado-pago/webhook?source_news=webhooks`,
      statement_descriptor: "ALVES STORE",
    }, requestData.idempotencyKey);

    const checkoutUrl = preference.init_point || preference.sandbox_init_point;
    if (!preference.id || !checkoutUrl || !checkoutUrl.startsWith("https://")) {
      throw new Error("O Mercado Pago não retornou um link seguro do Checkout Pro.");
    }

    after(async () => {
      try {
        const savedPreference = await supabase.from("store_orders")
        .update({ preference_id: preference.id, checkout_url: checkoutUrl, updated_at: new Date().toISOString() })
        .eq("id", order.id)
        .select("id")
        .maybeSingle();
        if (savedPreference.error || !savedPreference.data) {
          console.error("Preferência criada, mas não foi possível persistir preference_id/checkout_url:", savedPreference.error ?? "pedido não encontrado");
        }
      } catch (error) {
        console.error("Preferência criada, mas a persistência em store_orders falhou:", error instanceof Error ? error.message : "erro desconhecido");
      }
    });
    const emailKey = process.env.RESEND_API_KEY;
    const emailFrom = process.env.ORDER_EMAIL_FROM;
    if (emailKey && emailFrom) {
      const itemSummary = lines.map((line) => `${line.product.nome} · tamanho ${line.size} · ${line.quantity} un.${line.customization ? ` · personalizado ${line.customization.name} ${line.customization.number}` : ""}${line.patchOptions.length ? ` · patches: ${line.patchOptions.map((patch) => patch.name).join(", ")}` : ""}`).join("\n");
      try {
        const emailResponse = await fetch("https://api.resend.com/emails", {
          method: "POST", headers: { authorization: `Bearer ${emailKey}`, "content-type": "application/json" },
          body: JSON.stringify({ from: emailFrom, to: [requestData.customer.email], subject: "Pedido recebido — Alves Store", text: `Olá, ${requestData.customer.fullName}! Recebemos seu pedido. O pagamento ainda precisa ser concluído no Mercado Pago.\n\n${itemSummary}\nFrete: ${shippingLabel} (${jsonPrice(finalShippingCents).toFixed(2).replace(".", ",")})\nTotal: ${jsonPrice(totalCents).toFixed(2).replace(".", ",")}\n\nAcompanhe o pedido em ${siteUrl}/rastreio` }),
          signal: AbortSignal.timeout(5_000),
        });
        if (!emailResponse.ok) console.error("E-mail de pedido recebido não enviado:", emailResponse.status);
      } catch (error) {
        console.error("Falha no e-mail de pedido recebido:", error instanceof Error ? error.message : "erro desconhecido");
      }
    }

    return NextResponse.json({ checkoutUrl, orderId: order.id }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof InvalidOrderError) return publicError(error.message, 400);
    if (error instanceof PaymentConfigurationError || error instanceof SupabaseOrdersConfigurationError) {
      console.error("Checkout configuration incomplete:", error.message);
      return NextResponse.json({
        error: error.message,
        code: "CHECKOUT_CONFIGURATION",
        missing: error instanceof PaymentConfigurationError ? error.missing : undefined,
        stage,
      }, { status: 503, headers: { "Cache-Control": "no-store" } });
    }
    console.error(`Falha no checkout (${stage}):`, error instanceof Error ? error.message : "erro desconhecido");
    if (stage === "mercado-pago") {
      if (error instanceof MercadoPagoApiError) {
        const providerReason = error.message || error.providerCause || error.rawText || "Resposta sem detalhes.";
        const message = `O Mercado Pago não conseguiu gerar o link de pagamento (HTTP ${error.status}: ${providerReason}).`;
        console.error("Mercado Pago recusou a preferência:", {
          status: error.status,
          message: error.message,
          cause: error.providerCause,
          response: error.rawText,
        });
        return NextResponse.json({
          error: message,
          code: "MERCADO_PAGO_PREFERENCE_FAILED",
          httpStatus: error.status,
          mpErrorMessage: error.message,
          mpErrorCause: error.providerCause,
          rawText: error.rawText,
        }, { status: 502, headers: { "Cache-Control": "no-store" } });
      }
      const reason = error instanceof Error ? error.message : "Erro de comunicação desconhecido.";
      return NextResponse.json({
        error: "O Mercado Pago não conseguiu gerar o link de pagamento (falha de comunicação: " + reason + ").",
        code: "MERCADO_PAGO_PREFERENCE_FAILED",
      }, { status: 502, headers: { "Cache-Control": "no-store" } });
    }
    if (stage === "supabase") {
      const databaseError = describeSupabaseError(error);
      console.error("Falha ao gravar/atualizar pedido em store_orders:", databaseError);
      return NextResponse.json({
        error: databaseError.message,
        code: "SUPABASE_ORDER_WRITE_FAILED",
        details: databaseError.details,
        hint: databaseError.hint,
        databaseCode: databaseError.code,
      }, { status: 503, headers: { "Cache-Control": "no-store" } });
    }
    return publicError("Não foi possível validar o pedido agora. Tente novamente.", 503);
  }
}
