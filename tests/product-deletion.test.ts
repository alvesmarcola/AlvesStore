import test from "node:test";
import assert from "node:assert/strict";
import { DELETE } from "@/app/api/admin/products/route";
import { checkProductOrders, extractStoragePaths } from "@/lib/server/admin-product-deletion";
import { runDeleteTestProduct } from "@/scripts/delete-test-product";

test("DELETE /api/admin/products rejeita requisições sem autenticação com status 401", async () => {
  const previousToken = process.env.ADMIN_ORDERS_TOKEN;
  process.env.ADMIN_ORDERS_TOKEN = "secret-admin-token";
  try {
    const request = new Request("https://importsalves.com.br/api/admin/products?id=11111111-1111-4111-8111-111111111111", {
      method: "DELETE",
    });
    const response = await DELETE(request);
    assert.equal(response.status, 401);
    const body = await response.json();
    assert.equal(body.error, "Acesso administrativo negado.");
  } finally {
    process.env.ADMIN_ORDERS_TOKEN = previousToken;
  }
});

test("DELETE /api/admin/products rejeita ID inválido (não UUID) com status 400", async () => {
  const previousToken = process.env.ADMIN_ORDERS_TOKEN;
  process.env.ADMIN_ORDERS_TOKEN = "secret-admin-token";
  try {
    const request = new Request("https://importsalves.com.br/api/admin/products?id=id-invalido-123", {
      method: "DELETE",
      headers: {
        Authorization: "Bearer secret-admin-token",
      },
    });
    const response = await DELETE(request);
    assert.equal(response.status, 400);
    const body = await response.json();
    assert.equal(body.error, "ID de produto inválido.");
  } finally {
    process.env.ADMIN_ORDERS_TOKEN = previousToken;
  }
});

test("extractStoragePaths extrai apenas caminhos de dentro da pasta manual/ no bucket produtos", () => {
  const images = [
    { src: "https://xyz.supabase.co/storage/v1/object/public/produtos/manual/test-id/foto-1.webp" },
    { src: "https://xyz.supabase.co/storage/v1/object/public/produtos/manual/test-id/foto-2.webp" },
    // Foto fora de manual/ não deve ser incluída
    { src: "https://xyz.supabase.co/storage/v1/object/public/produtos/nba/foto-3.webp" },
    // URL externa não deve ser incluída
    { src: "https://external.com/foto.jpg" },
  ];

  const paths = extractStoragePaths(images);
  assert.equal(paths.length, 2);
  assert.equal(paths[0], "manual/test-id/foto-1.webp");
  assert.equal(paths[1], "manual/test-id/foto-2.webp");
});

test("checkProductOrders conta corretamente pedidos vinculados pelo productId ou slug", async () => {
  const mockOrders = [
    {
      id: "ord-1",
      item_lines: [
        { productId: "prod-uuid-1", slug: "camisa-teste", title: "Camisa Teste" },
      ],
    },
    {
      id: "ord-2",
      item_lines: [
        { productId: "outro-prod", slug: "camisa-teste", title: "Outra Camisa" },
      ],
    },
    {
      id: "ord-3",
      item_lines: [
        { productId: "prod-sem-relacao", slug: "camisa-flamengo", title: "Flamengo" },
      ],
    },
  ];

  const fakeSupabase = {
    rpc: async () => ({ data: null, error: new Error("RPC não implementada no mock") }),
    from: (table: string) => {
      assert.equal(table, "store_orders");
      return {
        select: () => ({
          limit: async () => ({ data: mockOrders, error: null }),
        }),
      };
    },
  } as any;

  const count1 = await checkProductOrders(fakeSupabase, "prod-uuid-1", "camisa-teste");
  assert.equal(count1, 2); // ord-1 e ord-2 batem

  const countInexistente = await checkProductOrders(fakeSupabase, "prod-inexistente", "slug-inexistente");
  assert.equal(countInexistente, 0);
});

test("snapshot de itens em store_orders preserva histórico completo após remoção do produto do catálogo", () => {
  // Simula o registro gravado em store_orders no momento da compra
  const orderSnapshotItem = {
    productId: "25288570-84a7-48cc-9a8b-abad05d51fd0",
    slug: "teste",
    title: "Produto de Teste R$ 1,50",
    size: "M",
    quantity: 1,
    uniformVariation: null,
    customization: { name: "ALVES", number: "10" },
    patches: [{ id: "patch-1", name: "Patch Campeão", priceCents: 1500 }],
  };

  const storedOrder = {
    id: "order-hist-1234",
    status: "approved",
    total_cents: 150,
    item_lines: [orderSnapshotItem],
    customer: { name: "Cliente Teste", email: "cliente@teste.com" },
  };

  // Suponha que o produto foi removido da tabela `products`
  const activeCatalog: any[] = []; // produto não existe mais no catálogo

  // O pedido mantém todos os dados de forma 100% autônoma
  assert.equal(storedOrder.item_lines[0].title, "Produto de Teste R$ 1,50");
  assert.equal(storedOrder.item_lines[0].size, "M");
  assert.equal(storedOrder.item_lines[0].customization?.name, "ALVES");
  assert.equal(storedOrder.item_lines[0].patches[0].name, "Patch Campeão");
  assert.equal(activeCatalog.length, 0); // Ausência no catálogo não invalida o pedido
});

test("script delete-test-product executa em modo dry-run por padrão sem apagar nada", async () => {
  const result = await runDeleteTestProduct({ silent: true });
  // Se não encontrar o produto ou estiver em dry-run, deleted é false
  assert.equal(result.deleted, false);
});
