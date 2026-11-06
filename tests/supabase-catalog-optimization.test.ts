import test from "node:test";
import assert from "node:assert/strict";
import { validateOrderLinesFromCatalog, InvalidOrderError } from "@/lib/payment/order";
import {
  findBundledProduct,
  fetchDirectOrderProducts,
  fetchSupabaseProducts,
  getSupabaseProductBySlug,
  LIST_PRODUCT_COLUMNS,
  DETAIL_PRODUCT_COLUMNS,
} from "@/lib/server/supabase-catalog";

// Garante configuração mock para o ambiente de testes
process.env.NEXT_PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://test.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "mock-anon-key";

test("1. findBundledProduct resolve produtos de futebol e F1 em memória sem requisições de rede", () => {
  const flamengo = findBundledProduct("retro-campeonato-brasileiro-flamengo-1987");
  assert.ok(flamengo, "Produto bundled do Flamengo deve ser encontrado");
  assert.equal(flamengo.clube, "Flamengo");

  const f1 = findBundledProduct("camisa-polo-scuderia-ferrari-f1-2026");
  assert.ok(f1, "Produto bundled da Ferrari F1 deve ser encontrado");
  assert.equal(f1.liga, "f1");

  const inexistente = findBundledProduct("produto-que-nao-existe-bundled");
  assert.equal(inexistente, undefined);
});

test("2. validateOrderLinesFromCatalog com produto bundled resolve sem chamar Supabase", async () => {
  const originalFetch = globalThis.fetch;
  let fetchCalled = false;
  globalThis.fetch = async () => {
    fetchCalled = true;
    throw new Error("Fetch não deveria ter sido chamado para produtos bundled");
  };

  try {
    const verified = await validateOrderLinesFromCatalog([
      {
        productId: "retro-campeonato-brasileiro-flamengo-1987",
        size: "M",
        quantity: 1,
      },
    ]);
    assert.equal(fetchCalled, false, "Nenhum fetch deve ser executado para produto bundled");
    assert.equal(verified.length, 1);
    assert.equal(verified[0].product.clube, "Flamengo");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("3. validateOrderLinesFromCatalog busca produtos não-bundled diretamente com or=(id.in,slug.in) e cache no-store", async () => {
  const originalFetch = globalThis.fetch;
  let requestedUrl = "";
  let requestCache = "";

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    requestedUrl = String(input);
    requestCache = String(init?.cache);
    const mockNbaProduct = {
      id: "regata-celtics-teste-1",
      slug: "regata-celtics-teste-1",
      nome: "Regata Boston Celtics 2024",
      clube: "Boston Celtics",
      clubeSlug: "celtics",
      liga: "nba",
      publico: "masculino",
      tipo: "regata",
      temporada: "2024",
      uniforme: "titular",
      preco: 230,
      tamanhos: ["P", "M", "G", "GG"],
      cor: "Verde",
      imageSeed: "celtics",
      images: [{ src: "https://test.supabase.co/storage/v1/object/public/produtos/celtics.jpg" }],
      oculto: false,
    };
    return new Response(JSON.stringify([mockNbaProduct]), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }) as typeof fetch;

  try {
    const verified = await validateOrderLinesFromCatalog([
      {
        productId: "regata-celtics-teste-1",
        size: "M",
        quantity: 1,
      },
    ]);
    assert.ok(requestedUrl.includes("or=(id.in."), "URL deve conter o filtro or=(id.in.");
    assert.ok(requestedUrl.includes("regata-celtics-teste-1"), "URL deve conter o ID/slug do produto");
    assert.equal(requestCache, "no-store", "A consulta do checkout deve usar cache no-store");
    assert.equal(verified.length, 1);
    assert.equal(verified[0].product.nome, "Regata Boston Celtics 2024");
    assert.equal(verified[0].product.preco, 230);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("4. validateOrderLinesFromCatalog rejeita com erro claro se produto estiver com oculto = true", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => {
    const hiddenProduct = {
      id: "produto-oculto-1",
      slug: "produto-oculto-1",
      nome: "Regata Ocultada para Teste",
      clube: "Lakers",
      clubeSlug: "lakers",
      liga: "nba",
      publico: "masculino",
      tipo: "regata",
      temporada: "2024",
      uniforme: "titular",
      preco: 230,
      tamanhos: ["M"],
      cor: "Amarelo",
      imageSeed: "lakers",
      images: [{ src: "https://test.supabase.co/storage/v1/object/public/produtos/lakers.jpg" }],
      oculto: true,
    };
    return new Response(JSON.stringify([hiddenProduct]), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }) as typeof fetch;

  try {
    await assert.rejects(
      () =>
        validateOrderLinesFromCatalog([
          {
            productId: "produto-oculto-1",
            size: "M",
            quantity: 1,
          },
        ]),
      (err: unknown) => {
        assert.ok(err instanceof InvalidOrderError);
        assert.match(err.message, /não está mais disponível para compra/);
        return true;
      }
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("5. validateOrderLinesFromCatalog rejeita se produto tiver deleted_at", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => {
    const deletedProduct = {
      id: "produto-deletado-1",
      slug: "produto-deletado-1",
      nome: "Regata Deletada Anteriormente",
      clube: "Bulls",
      clubeSlug: "bulls",
      liga: "nba",
      publico: "masculino",
      tipo: "regata",
      temporada: "2024",
      uniforme: "titular",
      preco: 230,
      tamanhos: ["M"],
      cor: "Vermelho",
      imageSeed: "bulls",
      images: [{ src: "https://test.supabase.co/storage/v1/object/public/produtos/bulls.jpg" }],
      deleted_at: "2026-11-05T12:00:00Z",
    };
    return new Response(JSON.stringify([deletedProduct]), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }) as typeof fetch;

  try {
    await assert.rejects(
      () =>
        validateOrderLinesFromCatalog([
          {
            productId: "produto-deletado-1",
            size: "M",
            quantity: 1,
          },
        ]),
      (err: unknown) => {
        assert.ok(err instanceof InvalidOrderError);
        assert.match(err.message, /foi removido e não está mais disponível/);
        return true;
      }
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("6. validateOrderLinesFromCatalog rejeita se produto do Supabase não for encontrado", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => {
    return new Response(JSON.stringify([]), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }) as typeof fetch;

  try {
    await assert.rejects(
      () =>
        validateOrderLinesFromCatalog([
          {
            productId: "nba-regata-inexistente-123",
            size: "M",
            quantity: 1,
          },
        ]),
      (err: unknown) => {
        assert.ok(err instanceof InvalidOrderError);
        assert.match(err.message, /não está mais disponível/);
        return true;
      }
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("7. LIST_PRODUCT_COLUMNS e DETAIL_PRODUCT_COLUMNS incluem tem_variacao_uniforme e oculto", () => {
  assert.ok(LIST_PRODUCT_COLUMNS.includes("tem_variacao_uniforme"));
  assert.ok(LIST_PRODUCT_COLUMNS.includes("oculto"));
  assert.ok(DETAIL_PRODUCT_COLUMNS.includes("tem_variacao_uniforme"));
  assert.ok(DETAIL_PRODUCT_COLUMNS.includes("oculto"));
  assert.ok(DETAIL_PRODUCT_COLUMNS.includes("description"));
  assert.ok(DETAIL_PRODUCT_COLUMNS.includes("brand"));
});

test("8. getSupabaseProductBySlug faz requisição única com DETAIL_PRODUCT_COLUMNS", async () => {
  const originalFetch = globalThis.fetch;
  let callCount = 0;
  let requestedSelect = "";

  globalThis.fetch = (async (input: RequestInfo | URL) => {
    callCount++;
    const url = new URL(String(input));
    requestedSelect = url.searchParams.get("select") ?? "";
    return new Response(
      JSON.stringify([
        {
          id: "slug-teste-1",
          slug: "slug-teste-1",
          nome: "Regata Teste Direta",
          clube: "Celtics",
          clubeSlug: "celtics",
          liga: "nba",
          publico: "masculino",
          tipo: "regata",
          temporada: "2024",
          uniforme: "titular",
          preco: 230,
          tamanhos: ["M"],
          cor: "Verde",
          imageSeed: "celtics",
          images: [{ src: "https://test.supabase.co/storage/v1/object/public/produtos/celtics.jpg" }],
          description: "Descrição completa do produto",
          brand: "Nike",
          tem_variacao_uniforme: false,
          oculto: false,
        },
      ]),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }) as typeof fetch;

  try {
    const prod = await getSupabaseProductBySlug("slug-teste-1");
    assert.equal(callCount, 1, "Deve realizar exatamente 1 chamada HTTP");
    assert.equal(requestedSelect, DETAIL_PRODUCT_COLUMNS);
    assert.ok(prod);
    assert.equal(prod.nome, "Regata Teste Direta");
    assert.equal(prod.description, "Descrição completa do produto");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("9. Paridade de catálogo por liga: confere total de produtos em cada liga", async () => {
  const catalog = await fetchSupabaseProducts();
  assert.ok(catalog.length >= 700, "Catálogo total deve ser >= 700");

  const brasileirao = catalog.filter((p) => p.liga === "brasileirao-serie-a");
  assert.equal(brasileirao.length, 197, "Brasileirão Série A deve conter exatamente 197 produtos");

  const nba = catalog.filter((p) => p.liga === "nba" || p.tipo === "regata");
  assert.ok(nba.length >= 120, "NBA deve conter ao menos 120 regatas");

  const premierLeague = catalog.filter((p) => p.liga === "premier-league");
  assert.ok(premierLeague.length > 0, "Premier League deve ter produtos");

  const laLiga = catalog.filter((p) => p.liga === "la-liga");
  assert.ok(laLiga.length > 0, "La Liga deve ter produtos");

  const f1 = catalog.filter((p) => p.liga === "f1");
  assert.ok(f1.length >= 10, "F1 deve conter ao menos 10 produtos");
});

test("10. fetchSupabaseProducts no build falha com mensagem clara se faltar migração no Supabase (código 42703)", async () => {
  const originalFetch = globalThis.fetch;
  const originalNextPhase = process.env.NEXT_PHASE;
  process.env.NEXT_PHASE = "phase-production-build";

  globalThis.fetch = (async () => {
    return new Response(
      JSON.stringify({
        code: "42703",
        message: "column products.oculto does not exist",
      }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }) as typeof fetch;

  try {
    await assert.rejects(
      () => fetchSupabaseProducts(),
      (err: unknown) => {
        assert.ok(err instanceof Error);
        assert.match(err.message, /migrações 20261105000001, 20261105000002 e 20261105000003/);
        return true;
      }
    );
  } finally {
    globalThis.fetch = originalFetch;
    process.env.NEXT_PHASE = originalNextPhase;
  }
});
