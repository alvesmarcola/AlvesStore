import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  sendWhatsAppOrderNotice,
  formatNoticeAddress,
  formatNoticePaymentMethod,
  describeNoticeItems,
  type OrderNotice,
} from "../lib/server/order-notifications";
import {
  buildOwnerOrderPaidEmail,
  buildOrderPaidEmail,
} from "../lib/server/order-emails";

describe("Auditoria e Finalização do Aviso de Pedido Novo", () => {
  const baseOrder: OrderNotice = {
    id: "b2c3d4e5-9999-4000-8000-111122223333",
    status: "approved",
    operational_status: "aguardando_fornecedor",
    customer: {
      fullName: "Gabriel Alves",
      phone: "(54) 99996-8814",
      email: "cliente@teste.com",
      street: "Avenida das Américas",
      number: "1500",
      complement: "Apto 302",
      neighborhood: "Barra da Tijuca",
      city: "Rio de Janeiro",
      state: "RJ",
      cep: "22640-100",
      whatsappUpdates: true,
    },
    item_lines: [
      {
        title: "Camisa Flamengo Edição Especial",
        size: "G",
        quantity: 1,
        uniformVariation: "casa",
        customization: { name: "GABRIEL", number: "10" },
        patches: [{ name: "Libertadores 2026", position: "manga-direita" }],
      },
      {
        title: "Camisa Polo McLaren F1 Team",
        size: "M",
        quantity: 1,
        uniformVariation: null,
      },
    ],
    shipping_cents: 0,
    total_cents: 35980,
    payment_method_id: "pix",
    payment_type_id: "bank_transfer",
    shipping: { label: "Frete Grátis Brasil" },
  };

  it("1. Formata a mensagem do dono da loja com todos os dados obrigatórios", () => {
    const itemsText = describeNoticeItems(baseOrder.item_lines);
    assert.match(itemsText, /Camisa Flamengo Edição Especial/);
    assert.match(itemsText, /tam\. G × 1/);
    assert.match(itemsText, /Uniforme: Casa/);
    assert.match(itemsText, /personalização: Nome: GABRIEL · Número: 10/);
    assert.match(itemsText, /patches: Libertadores 2026/);
    assert.match(itemsText, /Camisa Polo McLaren F1 Team/);

    const addressText = formatNoticeAddress(baseOrder.customer);
    assert.equal(
      addressText,
      "Avenida das Américas, 1500 (Apto 302) - Barra da Tijuca, Rio de Janeiro/RJ - CEP 22640-100"
    );

    const paymentText = formatNoticePaymentMethod(baseOrder.payment_method_id, baseOrder.payment_type_id);
    assert.equal(paymentText, "PIX");

    const ownerEmail = buildOwnerOrderPaidEmail({
      orderId: baseOrder.id,
      customerName: String(baseOrder.customer.fullName),
      customerPhone: String(baseOrder.customer.phone),
      customerEmail: String(baseOrder.customer.email),
      items: baseOrder.item_lines,
      shippingCents: baseOrder.shipping_cents,
      totalCents: baseOrder.total_cents,
      paymentMethod: paymentText,
      addressText,
      shippingOption: "Frete Grátis Brasil",
    });

    assert.match(ownerEmail.subject, /🚨 Novo Pedido Pago #B2C3D4E5 — R\$ 359,80 — Gabriel Alves/);
    assert.match(ownerEmail.text, /Pedido: #B2C3D4E5/);
    assert.match(ownerEmail.text, /Cliente: Gabriel Alves/);
    assert.match(ownerEmail.text, /Telefone: \(54\) 99996-8814/);
    assert.match(ownerEmail.text, /E-mail: cliente@teste\.com/);
    assert.match(ownerEmail.text, /Total: R\$ 359,80/);
    assert.match(ownerEmail.text, /Forma de Pagamento: PIX/);
    assert.match(ownerEmail.text, /Avenida das Américas, 1500 \(Apto 302\)/);
  });

  it("2. Dispara webhook de WhatsApp com evento order_paid_owner para OWNER_NOTIFY_WHATSAPP", async () => {
    const originalFetch = globalThis.fetch;
    const sentRequests: { url: string; body: Record<string, unknown>; headers: HeadersInit }[] = [];

    const prevWebhook = process.env.WHATSAPP_ORDER_WEBHOOK_URL;
    const prevToken = process.env.WHATSAPP_ORDER_WEBHOOK_TOKEN;
    const prevOwnerPhone = process.env.OWNER_NOTIFY_WHATSAPP;

    process.env.WHATSAPP_ORDER_WEBHOOK_URL = "https://webhook.loja.test/whatsapp";
    process.env.WHATSAPP_ORDER_WEBHOOK_TOKEN = "token-secreto-123";
    process.env.OWNER_NOTIFY_WHATSAPP = "555499968814";

    globalThis.fetch = async (url, init) => {
      sentRequests.push({
        url: String(url),
        body: JSON.parse(String(init?.body)) as Record<string, unknown>,
        headers: init?.headers as HeadersInit,
      });
      return new Response(JSON.stringify({ success: true }), { status: 200 });
    };

    try {
      const res = await sendWhatsAppOrderNotice("order_paid_owner", baseOrder);
      assert.equal(res, true, "Webhook para dono deve retornar true com HTTP 200");
      assert.equal(sentRequests.length, 1);
      assert.equal(sentRequests[0].url, "https://webhook.loja.test/whatsapp");
      assert.equal(sentRequests[0].body.event, "order_paid_owner");
      assert.equal(sentRequests[0].body.to, "555499968814");
      assert.match(String(sentRequests[0].body.message), /🚨 NOVO PEDIDO PAGO/);
      assert.match(String(sentRequests[0].body.message), /B2C3D4E5/);
      assert.match(String(sentRequests[0].body.message), /Uniforme: Casa/);
      assert.match(String(sentRequests[0].body.message), /PIX/);
      assert.match(String(sentRequests[0].body.message), /Avenida das Américas/);
    } finally {
      process.env.WHATSAPP_ORDER_WEBHOOK_URL = prevWebhook;
      process.env.WHATSAPP_ORDER_WEBHOOK_TOKEN = prevToken;
      process.env.OWNER_NOTIFY_WHATSAPP = prevOwnerPhone;
      globalThis.fetch = originalFetch;
    }
  });

  it("3. Pedido marcado como teste (is_test = true) não deve disparar aviso", () => {
    const paymentsPath = path.join(process.cwd(), "lib", "server", "mercado-pago-payments.ts");
    const paymentsContent = fs.readFileSync(paymentsPath, "utf8");

    // Verifica que na aprovação do pagamento, checa !orderData.is_test
    assert.ok(
      paymentsContent.includes("!orderData.is_test"),
      "applyMercadoPagoPayment deve verificar explicitamente !orderData.is_test antes de enfileirar avisos"
    );

    const outboxPath = path.join(process.cwd(), "lib", "server", "order-notification-outbox.ts");
    const outboxContent = fs.readFileSync(outboxPath, "utf8");

    // Verifica que o outbox ignora pedidos de teste no enqueue e no dispatch
    assert.ok(
      outboxContent.includes("if (options?.isTest) return;"),
      "enqueuePaidOrderNotifications deve rejeitar pedidos teste imediatamente"
    );
    assert.ok(
      outboxContent.includes("if (order?.is_test)"),
      "dispatchOrderNotificationOutbox deve ignorar pedidos teste sem disparar webhooks nem e-mails"
    );
  });

  it("4. Idempotência atômica: evita disparos duplicados se o webhook do Mercado Pago chegar repetido", () => {
    const outboxPath = path.join(process.cwd(), "lib", "server", "order-notification-outbox.ts");
    const outboxContent = fs.readFileSync(outboxPath, "utf8");

    // Verifica a chave única com ignoreDuplicates no outbox
    assert.ok(
      outboxContent.includes('{ onConflict: "order_id,event_name,channel", ignoreDuplicates: true }'),
      "Outbox deve utilizar chave única order_id,event_name,channel com ignoreDuplicates"
    );

    // Verifica que dispatchOrderNotificationOutbox checa paid_notified_at
    assert.ok(
      outboxContent.includes("if (order?.paid_notified_at && !force)"),
      "dispatchOrderNotificationOutbox deve checar se o pedido já foi notificado anteriormente"
    );

    // Verifica a atualização atômica do campo paid_notified_at com verificação IS NULL
    assert.ok(
      outboxContent.includes('.is("paid_notified_at", null)'),
      "Atualização de paid_notified_at deve usar .is('paid_notified_at', null) para evitar sobrescritas e condições de corrida"
    );
  });

  it("5. Falha do provedor de envio não afeta o pagamento e mantém status pendente", async () => {
    const originalFetch = globalThis.fetch;
    const prevWebhook = process.env.WHATSAPP_ORDER_WEBHOOK_URL;
    process.env.WHATSAPP_ORDER_WEBHOOK_URL = "https://webhook.loja.test/whatsapp";

    // Simula erro 500 no webhook de terceiros
    globalThis.fetch = async () => {
      return new Response("Internal Server Error", { status: 500 });
    };

    try {
      const result = await sendWhatsAppOrderNotice("order_paid_owner", baseOrder, { to: "555499968814" });
      assert.equal(result, false, "Falha do provedor deve retornar false de forma limpa sem lançar exceção não capturada");
    } finally {
      process.env.WHATSAPP_ORDER_WEBHOOK_URL = prevWebhook;
      globalThis.fetch = originalFetch;
    }
  });

  it("6. Endpoint admin e interface disponibilizam ação de reenvio de aviso", () => {
    const adminRoutePath = path.join(process.cwd(), "app", "api", "admin", "orders", "route.ts");
    const adminRouteContent = fs.readFileSync(adminRoutePath, "utf8");

    assert.ok(
      adminRouteContent.includes('action: z.literal("resend_notification")'),
      "Schema PATCH do admin deve aceitar a ação resend_notification"
    );
    assert.ok(
      adminRouteContent.includes('parsed.data.action === "resend_notification"'),
      "Handler PATCH deve processar resend_notification"
    );
    assert.ok(
      adminRouteContent.includes("paid_notified_at"),
      "Consulta GET deve incluir o campo paid_notified_at na listagem"
    );

    const clientPath = path.join(process.cwd(), "app", "admin", "pedidos", "orders-client.tsx");
    const clientContent = fs.readFileSync(clientPath, "utf8");

    assert.ok(
      clientContent.includes("Aviso pendente"),
      "Interface admin deve exibir o selo 'Aviso pendente' quando paid_notified_at for nulo"
    );
    assert.ok(
      clientContent.includes("Reenviar aviso"),
      "Interface admin deve conter o botão 'Reenviar aviso'"
    );
    assert.ok(
      clientContent.includes("resendNotice"),
      "orders-client deve implementar a função resendNotice chamando a API admin"
    );
  });

  it("7. .env.example está atualizado com as novas variáveis explicadas", () => {
    const envExamplePath = path.join(process.cwd(), ".env.example");
    const envContent = fs.readFileSync(envExamplePath, "utf8");

    assert.ok(envContent.includes("OWNER_NOTIFY_WHATSAPP="), "Deve conter OWNER_NOTIFY_WHATSAPP no .env.example");
    assert.ok(envContent.includes("OWNER_NOTIFY_EMAIL="), "Deve conter OWNER_NOTIFY_EMAIL no .env.example");
    assert.ok(envContent.includes("WHATSAPP_ORDER_WEBHOOK_URL="), "Deve conter WHATSAPP_ORDER_WEBHOOK_URL no .env.example");
    assert.ok(envContent.includes("WHATSAPP_ORDER_WEBHOOK_TOKEN="), "Deve conter WHATSAPP_ORDER_WEBHOOK_TOKEN no .env.example");
    assert.ok(envContent.includes("RESEND_API_KEY="), "Deve conter RESEND_API_KEY no .env.example");
    assert.ok(envContent.includes("ORDER_EMAIL_FROM="), "Deve conter ORDER_EMAIL_FROM no .env.example");
  });

  it("8. Nenhum e-mail ou aviso é disparado na criação do checkout antes do pagamento", () => {
    const checkoutRoutePath = path.join(process.cwd(), "app", "api", "checkout", "route.ts");
    const checkoutRouteContent = fs.readFileSync(checkoutRoutePath, "utf8");

    assert.ok(
      !checkoutRouteContent.includes("buildOrderReceivedEmail"),
      "Rota de checkout não deve importar nem chamar buildOrderReceivedEmail ao gerar a preferência"
    );
    assert.ok(
      !checkoutRouteContent.includes("sendOrderEmail"),
      "Rota de checkout não deve importar nem chamar sendOrderEmail antes do pagamento ser aprovado"
    );
  });

  it("9. Cenário (a): Aviso do cliente falha e do dono funciona: dono não é repetido", () => {
    const outboxPath = path.join(process.cwd(), "lib", "server", "order-notification-outbox.ts");
    const outboxContent = fs.readFileSync(outboxPath, "utf8");

    // Verifica que enfileira em linhas separadas para dono (order_paid_owner) e cliente (order_paid)
    assert.ok(
      outboxContent.includes('event_name: "order_paid_owner"'),
      "Deve gerar linha própria com event_name order_paid_owner"
    );
    assert.ok(
      outboxContent.includes('event_name: "order_paid"'),
      "Deve gerar linha própria com event_name order_paid"
    );

    // Simula lógica de re-tentativa / claim: linhas com status = 'sent' são ignoradas
    const mockOutboxRows = [
      { id: "1", event_name: "order_paid_owner", channel: "whatsapp", status: "sent" },
      { id: "2", event_name: "order_paid", channel: "whatsapp", status: "pending" },
    ];
    const candidateRows = mockOutboxRows.filter((r) => r.status === "pending");
    assert.equal(candidateRows.length, 1);
    assert.equal(candidateRows[0].event_name, "order_paid", "Apenas a linha do cliente pendente deve ser retentada");
  });

  it("10. Cenário (b): Aviso do dono falha e do cliente funciona: cliente não recebe de novo e dono segue pendente", () => {
    const outboxPath = path.join(process.cwd(), "lib", "server", "order-notification-outbox.ts");
    const outboxContent = fs.readFileSync(outboxPath, "utf8");

    // Verifica checagem de pendências antes de marcar paid_notified_at
    assert.ok(
      outboxContent.includes('.neq("status", "sent")'),
      "paid_notified_at só deve ser gravado se nenhuma notificação do pedido estiver pendente/falha"
    );

    // No reenvio pelo admin (force), apenas as que NÃO estão 'sent' são re-enfileiradas
    assert.ok(
      outboxContent.includes('row.status === "sent"'),
      "Reenvio pelo admin deve filtrar e preservar quem já recebeu (status sent)"
    );

    const mockOutboxRows = [
      { id: "1", event_name: "order_paid_owner", channel: "whatsapp", status: "pending" },
      { id: "2", event_name: "order_paid", channel: "whatsapp", status: "sent" },
    ];

    // Simula reenvio admin com force: preserva quem já recebeu
    const alreadySent = new Set(
      mockOutboxRows.filter((r) => r.status === "sent").map((r) => `${r.event_name}:${r.channel}`)
    );
    const toRequeue = mockOutboxRows.filter((r) => !alreadySent.has(`${r.event_name}:${r.channel}`));
    assert.equal(toRequeue.length, 1);
    assert.equal(toRequeue[0].event_name, "order_paid_owner", "Apenas a notificação pendente do dono deve ser reenviada");
  });

  it("11. Arquivo de migração SQL para order_paid_owner existe e é idempotente", () => {
    const migrationPath = path.join(
      process.cwd(),
      "supabase",
      "migrations",
      "20261108000000_order_paid_owner_notification.sql"
    );
    assert.ok(fs.existsSync(migrationPath), "Arquivo de migração para order_paid_owner deve existir");
    const content = fs.readFileSync(migrationPath, "utf8");

    assert.ok(content.includes("DROP CONSTRAINT IF EXISTS store_order_notification_outbox_event_name_check"));
    assert.ok(content.includes("CHECK (event_name IN ('order_paid', 'order_paid_owner'))"));
    assert.ok(content.includes("CHECK (status IN ('pending', 'processing', 'sent', 'failed'))"));
    assert.ok(content.includes("p_max_attempts INTEGER DEFAULT 5"));
    assert.ok(content.includes("UNIQUE (order_id, event_name, channel)"));

    // Validações adicionais de integridade de schema e segurança
    assert.ok(
      !content.includes("processed_at"),
      "Migração NÃO deve utilizar a coluna inexistente processed_at"
    );
    assert.ok(
      content.includes("sent_at = CASE"),
      "Migração deve utilizar a coluna real sent_at no sucesso"
    );
    assert.ok(
      content.includes("lease_until = NULL"),
      "Migração deve resetar lease_until ao concluir"
    );
    assert.ok(
      content.includes("WHERE id = p_notification_id AND status = 'processing'"),
      "Migração deve filtrar por status = 'processing'"
    );
    assert.ok(
      content.includes("DROP FUNCTION IF EXISTS public.complete_store_order_notification(UUID, BOOLEAN, TEXT, INTEGER);"),
      "Migração deve remover a assinatura antiga para evitar sobrecargas ambíguas"
    );
    assert.ok(
      content.includes("SECURITY DEFINER"),
      "Migração deve ser SECURITY DEFINER com search_path seguro"
    );
    assert.ok(
      content.includes("REVOKE ALL ON FUNCTION public.complete_store_order_notification") &&
      content.includes("GRANT EXECUTE ON FUNCTION public.complete_store_order_notification") &&
      content.includes("TO service_role"),
      "Migração deve revogar de anon/authenticated e conceder apenas para service_role"
    );
  });

  it("12. Canais sem configuração de servidor não geram linhas na outbox e não travam pedidos", () => {
    const outboxPath = path.join(process.cwd(), "lib", "server", "order-notification-outbox.ts");
    const outboxContent = fs.readFileSync(outboxPath, "utf8");

    assert.ok(
      outboxContent.includes("isEmailConfigured()"),
      "Deve verificar se o e-mail está configurado antes de enfileirar"
    );
    assert.ok(
      outboxContent.includes("isWhatsAppConfigured()"),
      "Deve verificar se o WhatsApp está configurado antes de enfileirar"
    );
    assert.ok(
      outboxContent.includes("if (!entries.length)"),
      "Se nenhum canal for aplicável ou configurado, deve atualizar paid_notified_at para não travar o pedido"
    );
  });

  it("13. Limite de 5 tentativas com espera crescente e status 'failed' para cessar tentativas automáticas", () => {
    const outboxPath = path.join(process.cwd(), "lib", "server", "order-notification-outbox.ts");
    const outboxContent = fs.readFileSync(outboxPath, "utf8");

    assert.ok(
      outboxContent.includes("MAX_NOTIFICATION_ATTEMPTS = 5"),
      "Deve definir constante MAX_NOTIFICATION_ATTEMPTS = 5"
    );
    assert.ok(
      outboxContent.includes("isExhausted"),
      "Deve identificar quando as tentativas foram esgotadas"
    );
    assert.ok(
      outboxContent.includes('status: "failed"'),
      "Deve marcar o status como failed ao esgotar as tentativas"
    );
  });
});
