import { createHash, randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { InvalidOrderError, paymentRequestSchema, validateOrderLinesFromCatalog, calculateOrderTotals, calculateOrderFingerprint } from "@/lib/payment/order";
import { createMercadoPagoPreference, getCheckoutUrl, getPaymentEnvironment, getSiteUrl, MercadoPagoApiError, PaymentConfigurationError, validateMercadoPagoAccessToken } from "@/lib/server/mercado-pago";
import { SupabaseOrdersConfigurationError, describeSupabaseError, getSupabaseOrdersClient } from "@/lib/server/supabase-orders";
import { buildPreferenceItems } from "@/lib/payment/preference-items";
import { SITE_NAME } from "@/lib/site";

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
    const customizationIssue = parsed.error.issues.find((issue) => issue.path.includes("customization"));
    return NextResponse.json({
      error: customizationIssue?.message ?? "Confira os dados do pedido e tente novamente.",
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
    const siteUrl = getSiteUrl(request.url);
    if (getPaymentEnvironment() === "production" && siteUrl !== "https://importsalves.com.br") {
      throw new PaymentConfigurationError("Em produção, SITE_URL deve ser https://importsalves.com.br.", ["SITE_URL"]);
    }
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
      uniformVariation: line.uniformVariation ?? null,
      customization: line.customization ?? null,
      patches: line.patchOptions.map((patch, index) => ({
        id: patch.id,
        name: patch.name,
        image: patch.image ?? null,
        position: line.patches?.[index]?.position,
        priceCents: patch.priceCents,
      })),
    }));

    const prepared = await supabase.rpc("prepare_store_order", {
      p_id: randomUUID(),
      p_idempotency_key: requestData.idempotencyKey,
      p_request_hash: requestHash,
      p_item_lines: savedLines,
      p_customer: requestData.customer,
      p_shipping: { label: shippingLabel, priceCents: finalShippingCents },
      p_shirt_quantity: totals.quantity,
      p_shirts_cents: totals.shirtsCents,
      p_customization_cents: totals.customizationCents,
      p_patches_cents: totals.patchesCents,
      p_shipping_cents: finalShippingCents,
      p_total_cents: totalCents,
    });
    if (prepared.error) throw prepared.error;
    const order = Array.isArray(prepared.data) ? prepared.data[0] : null;
    if (!order?.order_id) throw new Error("Supabase não retornou o pedido gravado.");
    const orderId = String(order.order_id);
    if (String(order.saved_request_hash).trim() !== requestHash) {
      return NextResponse.json({
        error: "Os dados do pedido mudaram. Envie novamente para iniciar uma nova tentativa.",
        code: "IDEMPOTENCY_CONFLICT",
      }, { status: 409, headers: { "Cache-Control": "no-store" } });
    }
    if (!["pending", "rejected", "cancelled"].includes(String(order.order_status))) {
      return NextResponse.json({
        error: "Este pedido já foi processado. Consulte o status antes de iniciar outro pagamento.",
        code: "ORDER_ALREADY_PROCESSED",
      }, { status: 409, headers: { "Cache-Control": "no-store" } });
    }
    if (order.checkout_url) return NextResponse.json({ checkoutUrl: order.checkout_url }, { headers: { "Cache-Control": "no-store" } });

    const savedTotals = await supabase.from("store_orders")
      .update({
        promo: totals.promoCode,
        valor_desconto: totals.promoDiscountCents / 100,
        shirts_cents: totals.shirtsCents,
        customization_cents: totals.customizationCents,
        patches_cents: totals.patchesCents,
        shipping_cents: totals.shippingCents,
        total_cents: totals.totalCents,
        updated_at: new Date().toISOString(),
      })
      .eq("id", orderId)
      .select("id")
      .maybeSingle();
    if (savedTotals.error || !savedTotals.data) {
      throw savedTotals.error ?? new Error("Não foi possível salvar os valores recalculados do pedido.");
    }

    stage = "mercado-pago";
    const preference = await createMercadoPagoPreference({
      items: buildPreferenceItems(orderId, lines, totals),
      ...(finalShippingCents > 0 ? {
        shipments: { mode: "not_specified", cost: jsonPrice(finalShippingCents) },
      } : {}),
      external_reference: orderId,
      metadata: { store_order_id: orderId },
      back_urls: {
        success: `${siteUrl}/pedido/retorno?order_id=${orderId}&return=approved`,
        pending: `${siteUrl}/pedido/retorno?order_id=${orderId}&return=pending`,
        failure: `${siteUrl}/pedido/retorno?order_id=${orderId}&return=rejected`,
      },
      ...(siteUrl.startsWith("https://") ? { auto_return: "approved" } : {}),
      payment_methods: { installments: 12 },
      ...(siteUrl.startsWith("https://") ? { notification_url: `${siteUrl}/api/mercado-pago/webhook` } : {}),
      statement_descriptor: SITE_NAME,
    }, requestData.idempotencyKey);

    const checkoutUrl = getCheckoutUrl(preference);
    if (!preference.id || !checkoutUrl) {
      throw new Error("O Mercado Pago não retornou um link seguro do Checkout Pro.");
    }

    const savedPreference = await supabase.from("store_orders")
      .update({ preference_id: preference.id, checkout_url: checkoutUrl, updated_at: new Date().toISOString() })
      .eq("id", orderId)
      .select("id")
      .maybeSingle();
    if (savedPreference.error || !savedPreference.data) {
      throw savedPreference.error ?? new Error("Não foi possível vincular a preferência ao pedido.");
    }

    return NextResponse.json({ checkoutUrl }, { headers: { "Cache-Control": "no-store" } });
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
        console.error("Mercado Pago recusou a preferência:", {
          status: error.status,
        });
        return NextResponse.json({
          error: "O Mercado Pago não conseguiu gerar o link de pagamento. Tente novamente.",
          code: "MERCADO_PAGO_PREFERENCE_FAILED",
        }, { status: 502, headers: { "Cache-Control": "no-store" } });
      }
      console.error("Falha de comunicação com o Mercado Pago.");
      return NextResponse.json({
        error: "O Mercado Pago não conseguiu gerar o link de pagamento. Tente novamente.",
        code: "MERCADO_PAGO_PREFERENCE_FAILED",
      }, { status: 502, headers: { "Cache-Control": "no-store" } });
    }
    if (stage === "supabase") {
      const databaseError = describeSupabaseError(error);
      console.error("Falha ao gravar/atualizar pedido em store_orders:", databaseError);
      return NextResponse.json({
        error: "Não foi possível registrar seu pedido agora. Tente novamente.",
        code: "SUPABASE_ORDER_WRITE_FAILED",
      }, { status: 503, headers: { "Cache-Control": "no-store" } });
    }
    return publicError("Não foi possível validar o pedido agora. Tente novamente.", 503);
  }
}
