import { createHash, randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { InvalidOrderError, paymentRequestSchema, validateOrderLinesFromCatalog, calculateOrderTotals, calculateOrderFingerprint } from "@/lib/payment/order";
import { getPreferenceClient, getSiteUrl, PaymentConfigurationError, isProductionPaymentEnvironment } from "@/lib/server/mercado-pago";
import { SupabaseOrdersConfigurationError, getSupabaseOrdersClient } from "@/lib/server/supabase-orders";
import { buildPreferenceItems } from "@/lib/payment/preference-items";
import { storeConfig } from "@/config";

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
    const supabase = getSupabaseOrdersClient();
    stage = "supabase";

    const finalShippingCents = totals.shippingCents;
    const totalCents = totals.totalCents;
    const shippingLabel = finalShippingCents === 0 ? "Frete grátis" : "Frete fixo";
    const siteUrl = getSiteUrl();
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
    if (!order?.order_id) throw new Error("Supabase não retornou o pedido preparado.");
    if (String(order.saved_request_hash).trim() !== requestHash) {
      return publicError("Esta chave de pedido já foi usada com dados diferentes. Recarregue o checkout.", 409);
    }
    if (order.checkout_url) return NextResponse.json({ checkoutUrl: order.checkout_url, reused: true }, { headers: { "Cache-Control": "no-store" } });

    stage = "mercado-pago";
    const [firstName, ...surnameParts] = requestData.customer.fullName.trim().split(/\s+/);
    const preference = await getPreferenceClient().create({
      body: {
        items: buildPreferenceItems(order.order_id, lines, totals),
        ...(finalShippingCents > 0 ? { shipments: {
          mode: "not_specified",
          cost: jsonPrice(finalShippingCents),
          free_shipping: false,
          receiver_address: {
            zip_code: requestData.customer.cep.replace(/\D/g, ""),
            street_name: requestData.customer.street,
            street_number: requestData.customer.number,
            apartment: requestData.customer.complement || undefined,
            city_name: requestData.customer.city,
            state_name: requestData.customer.state.toUpperCase(),
            country_name: "Brasil",
          },
        } } : { shipments: { mode: "not_specified", cost: 0, free_shipping: true } }),
        external_reference: order.order_id,
        metadata: { store_order_id: order.order_id },
        payer: {
          name: firstName,
          surname: surnameParts.join(" ") || firstName,
          email: requestData.customer.email,
        },
        back_urls: {
          success: `${siteUrl}/pedido/retorno?order_id=${order.order_id}&return=approved`,
          pending: `${siteUrl}/pedido/retorno?order_id=${order.order_id}&return=pending`,
          failure: `${siteUrl}/pedido/retorno?order_id=${order.order_id}&return=rejected`,
        },
        auto_return: "approved",
        notification_url: `${siteUrl}/api/mercado-pago/webhook?source_news=webhooks`,
        statement_descriptor: storeConfig.name,
      },
      requestOptions: { idempotencyKey: requestData.idempotencyKey },
    });

    const checkoutUrl = isProductionPaymentEnvironment() ? preference.init_point : preference.sandbox_init_point;
    if (!preference.id || !checkoutUrl || !checkoutUrl.startsWith("https://")) {
      throw new Error("O Mercado Pago não retornou um link seguro do Checkout Pro.");
    }

    stage = "supabase";
    const savedPreference = await supabase.from("store_orders")
      .update({ preference_id: preference.id, checkout_url: checkoutUrl, updated_at: new Date().toISOString() })
      .eq("id", order.order_id)
      .select("id")
      .maybeSingle();
    if (savedPreference.error || !savedPreference.data) throw savedPreference.error ?? new Error("Não foi possível salvar o link de pagamento.");

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

    return NextResponse.json({ checkoutUrl, orderId: order.order_id }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof InvalidOrderError) return publicError(error.message, 400);
    if (error instanceof PaymentConfigurationError || error instanceof SupabaseOrdersConfigurationError) {
      console.error("Configuração do checkout incompleta:", error.message);
      return publicError("Checkout indisponível: configure as credenciais privadas do Supabase e do Mercado Pago no servidor.", 503);
    }
    console.error(`Falha no checkout (${stage}):`, error instanceof Error ? error.message : "erro desconhecido");
    if (stage === "mercado-pago") return publicError("O Mercado Pago não conseguiu gerar o link de pagamento. Tente novamente; o pedido não foi cobrado.", 502);
    if (stage === "supabase") return publicError("O banco de pedidos Supabase está indisponível ou ainda não recebeu a migração store_orders.", 503);
    return publicError("Não foi possível validar o pedido agora. Tente novamente.", 503);
  }
}
