import { createHash, randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { InvalidOrderError, paymentRequestSchema, validateOrderLinesFromCatalog, calculateOrderTotals, calculateOrderFingerprint } from "@/lib/payment/order";
import { getDatabasePool } from "@/lib/server/database";
import { getPreferenceClient, getSiteUrl, PaymentConfigurationError, isProductionPaymentEnvironment } from "@/lib/server/mercado-pago";
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

export async function POST(request: Request) {
  if (isRateLimited(request)) return NextResponse.json({ error: "Muitas tentativas. Aguarde alguns minutos e tente novamente." }, { status: 429 });
  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json({ error: "A solicitação de pagamento não contém JSON válido." }, { status: 400 });
  }

  const parsed = paymentRequestSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json({
      error: "Confira os dados do pedido e tente novamente.",
      details: parsed.error.issues.map((issue) => ({ field: issue.path.join("."), message: issue.message })),
    }, { status: 400 });
  }

  const requestData = parsed.data;
  if (request.headers.get("idempotency-key") !== requestData.idempotencyKey) {
    return NextResponse.json({ error: "A chave de segurança do pedido é inválida." }, { status: 400 });
  }
  let lines;
  try {
    lines = await validateOrderLinesFromCatalog(requestData.items);
  } catch (error) {
    if (error instanceof InvalidOrderError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }

  const totals = calculateOrderTotals(lines);
  const requestHash = createHash("sha256").update(calculateOrderFingerprint(requestData)).digest("hex");
  const pool = (() => {
    try {
      return getDatabasePool();
    } catch {
      console.error("Configuração do banco de pedidos ausente.");
      return undefined;
    }
  })();
  if (!pool) return NextResponse.json({ error: "O serviço de pedidos ainda não está configurado." }, { status: 503 });

  try {
    const previous = await pool.query<{
      request_hash: string;
      checkout_url: string | null;
      status: string;
    }>(
      "SELECT request_hash, checkout_url, status FROM store_orders WHERE idempotency_key = $1",
      [requestData.idempotencyKey],
    );
    const existing = previous.rows[0];
    if (existing) {
      if (existing.request_hash.trim() !== requestHash) {
        return NextResponse.json({ error: "Esta chave de pedido já foi usada com dados diferentes. Recarregue o checkout." }, { status: 409 });
      }
      if (existing.checkout_url) return NextResponse.json({ checkoutUrl: existing.checkout_url, reused: true });
      return NextResponse.json({ error: "O pedido está sendo preparado. Aguarde alguns segundos e tente novamente." }, { status: 409 });
    }

    const finalShippingCents = totals.shippingCents;
    const totalCents = totals.totalCents;
    const shippingLabel = finalShippingCents === 0 ? "Frete grátis" : "Frete fixo";
    const siteUrl = getSiteUrl();
    const transaction = await pool.connect();
    try {
      await transaction.query("BEGIN");
      await transaction.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [requestData.idempotencyKey]);
      const locked = await transaction.query<{
        id: string;
        request_hash: string;
        checkout_url: string | null;
      }>(
        "SELECT id, request_hash, checkout_url FROM store_orders WHERE idempotency_key = $1 FOR UPDATE",
        [requestData.idempotencyKey],
      );

      if (locked.rows[0]) {
        const row = locked.rows[0];
        if (row.request_hash.trim() !== requestHash) {
          await transaction.query("ROLLBACK");
          return NextResponse.json({ error: "Esta chave de pedido já foi usada com dados diferentes. Recarregue o checkout." }, { status: 409 });
        }
        if (row.checkout_url) {
          await transaction.query("COMMIT");
          return NextResponse.json({ checkoutUrl: row.checkout_url, reused: true });
        }
      }

      const orderId = locked.rows[0]?.id ?? randomUUID();
      if (!locked.rows[0]) {
        const shippingDetails = { label: shippingLabel, priceCents: finalShippingCents };
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
            image: patch.image,
            position: line.patches?.[index]?.position,
            priceCents: patch.priceCents,
          })),
        }));
        await transaction.query(
          `INSERT INTO store_orders
            (id, idempotency_key, request_hash, item_lines, customer, shipping,
             shirt_quantity, shirts_cents, customization_cents, patches_cents, shipping_cents, total_cents)
           VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, $6::jsonb, $7, $8, $9, $10, $11, $12)`,
          [
            orderId,
            requestData.idempotencyKey,
            requestHash,
            JSON.stringify(savedLines),
            JSON.stringify(requestData.customer),
            JSON.stringify(shippingDetails),
            totals.quantity,
            totals.shirtsCents,
            totals.customizationCents,
            totals.patchesCents,
            finalShippingCents,
            totalCents,
          ],
        );
      }

      const [firstName, ...surnameParts] = requestData.customer.fullName.trim().split(/\s+/);
      const preference = await getPreferenceClient().create({
        body: {
          items: buildPreferenceItems(orderId, lines, totals),
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
          external_reference: orderId,
          metadata: { store_order_id: orderId },
          payer: {
            name: firstName,
            surname: surnameParts.join(" ") || firstName,
            email: requestData.customer.email,
          },
          back_urls: {
            success: `${siteUrl}/pedido/retorno?order_id=${orderId}&return=approved`,
            pending: `${siteUrl}/pedido/retorno?order_id=${orderId}&return=pending`,
            failure: `${siteUrl}/pedido/retorno?order_id=${orderId}&return=rejected`,
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

      await transaction.query(
        "UPDATE store_orders SET preference_id = $1, checkout_url = $2, updated_at = NOW() WHERE id = $3",
        [preference.id, checkoutUrl, orderId],
      );
      await transaction.query("COMMIT");
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
        } catch (error) { console.error("Falha no e-mail de pedido recebido:", error instanceof Error ? error.message : "erro desconhecido"); }
      }
      return NextResponse.json({ checkoutUrl, orderId });
    } catch (error) {
      await transaction.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      transaction.release();
    }
  } catch (error) {
    if (error instanceof PaymentConfigurationError) {
      console.error("Configuração do Mercado Pago incompleta:", error.message);
      return NextResponse.json({ error: "O checkout ainda não está configurado no servidor." }, { status: 503 });
    }
    console.error("Falha ao preparar o Checkout Pro:", error instanceof Error ? error.message : "erro desconhecido");
    return NextResponse.json({ error: "Não foi possível preparar o pagamento. Nenhuma cobrança foi iniciada." }, { status: 502 });
  }
}
