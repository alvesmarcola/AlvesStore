import assert from "node:assert/strict";
import { describe, it } from "node:test";
import React from "react";
import ReactDOMServer from "react-dom/server";
import { CustomerReviews } from "@/components/customer-reviews";
import type { Avaliacao } from "@/lib/types";

describe("Exibição de Avaliações em components/customer-reviews.tsx", () => {
  it("renderiza o card de avaliação quando há exatamente 1 avaliação aprovada retornada pela API", () => {
    // Resposta exata de GET /api/reviews?page=0 com 1 avaliação aprovada e com foto
    const apiResponse = {
      reviews: [
        {
          id: "11111111-2222-3333-4444-555555555555",
          created_at: "2026-11-08T14:00:00.000Z",
          nome: "Marcos Oliveira",
          cidade: "Belo Horizonte / MG",
          produto: "Camisa Real Madrid 24/25",
          nota: 5,
          comentario: "Camisa sensacional, acabamento perfeito e entrega antes do prazo!",
          imagem_path: "a1b2c3d4-e5f6-7890-abcd-ef1234567890.webp",
          imagem_url: "/api/reviews/image?path=a1b2c3d4-e5f6-7890-abcd-ef1234567890.webp",
          status: "approved" as const,
        },
      ],
      total: 1,
      average: 5,
      hasMore: false,
    };

    const html = ReactDOMServer.renderToString(
      React.createElement(CustomerReviews, { initialReviews: apiResponse } as any)
    );

    // 1. Confirma que o título e cabeçalho da seção de depoimentos estão presentes
    assert.ok(
      html.includes("O que dizem nossos clientes"),
      "Título da seção 'O que dizem nossos clientes' deve ser exibido"
    );

    // 2. Confirma que a nota média e o resumo de 1 avaliação aparecem
    assert.ok(
      html.includes("5.0"),
      "Média 5.0 deve ser exibida no selo de resumo"
    );
    assert.ok(
      html.includes("1 avaliação real"),
      "Deve indicar '1 avaliação real'"
    );

    // 3. Confirma que os dados do cliente aparecem no card
    assert.ok(
      html.includes("Marcos Oliveira"),
      "Nome do cliente deve aparecer no card"
    );
    assert.ok(
      html.includes("Belo Horizonte / MG"),
      "Cidade do cliente deve aparecer no card"
    );

    // 4. Confirma a nota e o comentário
    assert.ok(
      html.includes("5 de 5 estrelas"),
      "Avaliação de 5 estrelas deve estar presente no card"
    );
    assert.ok(
      html.includes("Camisa sensacional, acabamento perfeito e entrega antes do prazo!"),
      "Comentário da avaliação deve estar visível"
    );

    // 5. Confirma a miniatura da foto e o botão de ampliação
    assert.ok(
      html.includes("/api/reviews/image?path=a1b2c3d4-e5f6-7890-abcd-ef1234567890.webp"),
      "Miniatura da imagem deve ter a URL correta apontando para o endpoint da foto"
    );
    assert.ok(
      html.includes('aria-label="Ampliar foto enviada por Marcos Oliveira"'),
      "Botão de ampliação deve ter aria-label acessível com o nome do cliente"
    );
    assert.ok(
      html.includes("Compra verificada"),
      "Badge de compra verificada deve estar presente"
    );
  });

  it("renderiza o card normalmente mesmo quando a avaliação não possui foto enviada", () => {
    const noPhotoResponse = {
      reviews: [
        {
          id: "22222222-3333-4444-5555-666666666666",
          created_at: "2026-11-08T15:00:00.000Z",
          nome: "Juliana Santos",
          cidade: "Florianópolis / SC",
          produto: "Camisa Brasil",
          nota: 5,
          comentario: "Tecido excelente, recomendo a todos!",
          imagem_path: null,
          imagem_url: null,
          status: "approved" as const,
        },
      ],
      total: 1,
      average: 5,
      hasMore: false,
    };

    const html = ReactDOMServer.renderToString(
      React.createElement(CustomerReviews, { initialReviews: noPhotoResponse } as any)
    );

    assert.ok(html.includes("Juliana Santos"), "Nome da cliente deve aparecer");
    assert.ok(html.includes("Tecido excelente, recomendo a todos!"), "Comentário deve aparecer");
    assert.ok(!html.includes('aria-label="Ampliar foto'), "Não deve renderizar botão de foto quando imagem_url for nula");
  });

  it("renderiza a sessão de avaliar acima da lista de avaliações", () => {
    const apiResponse = {
      reviews: [
        {
          id: "rev-order-test",
          created_at: "2026-11-08T14:00:00.000Z",
          nome: "Guilherme Santos",
          cidade: "Brasília / DF",
          produto: "Camisa F1",
          nota: 5,
          comentario: "Excelente acabamento!",
          status: "approved" as const,
        },
      ],
      total: 1,
      average: 5,
      hasMore: false,
    };

    const html = ReactDOMServer.renderToString(
      React.createElement(CustomerReviews, { initialReviews: apiResponse } as any)
    );

    const formPos = html.indexOf('id="avaliacao-form-section"');
    const reviewsTitlePos = html.indexOf('id="reviews-title"');

    assert.ok(formPos !== -1, "Formulário de avaliação deve estar presente");
    assert.ok(reviewsTitlePos !== -1, "Título das avaliações deve estar presente");
    assert.ok(
      formPos < reviewsTitlePos,
      "A sessão de avaliar deve estar posicionada acima da sessão de avaliações"
    );
  });

  it("renderiza o formulário e o estado de sem avaliações quando o total é 0", () => {
    const emptyResponse = {
      reviews: [] as Avaliacao[],
      total: 0,
      average: 0,
      hasMore: false,
    };

    const html = ReactDOMServer.renderToString(
      React.createElement(CustomerReviews, { initialReviews: emptyResponse } as any)
    );

    assert.ok(
      html.includes("Deixe sua avaliação"),
      "Deve exibir o formulário de avaliação no topo"
    );
    assert.ok(
      html.includes("Ainda não há avaliações aprovadas"),
      "Deve exibir mensagem informando que ainda não há avaliações aprovadas abaixo do formulário"
    );
  });

  it("renderiza múltiplos cards quando há mais de uma avaliação (ex: 2 avaliações)", () => {
    const twoReviewsResponse = {
      reviews: [
        {
          id: "rev-1",
          created_at: "2026-11-08T10:00:00.000Z",
          nome: "Lucas Souza",
          cidade: "São Paulo / SP",
          produto: "Camisa Barcelona",
          nota: 5,
          comentario: "Excelente camisa!",
          status: "approved" as const,
        },
        {
          id: "rev-2",
          created_at: "2026-11-08T11:00:00.000Z",
          nome: "Ana Paula",
          cidade: "Porto Alegre / RS",
          produto: "Camisa Grêmio",
          nota: 4,
          comentario: "Muito confortável e bonita.",
          status: "approved" as const,
        },
      ],
      total: 2,
      average: 4.5,
      hasMore: false,
    };

    const html = ReactDOMServer.renderToString(
      React.createElement(CustomerReviews, { initialReviews: twoReviewsResponse } as any)
    );

    assert.ok(html.includes("Lucas Souza"), "Primeiro cliente deve estar presente");
    assert.ok(html.includes("Ana Paula"), "Segundo cliente deve estar presente");
    assert.ok(html.includes("2 avaliações reais"), "Deve indicar '2 avaliações reais'");
  });
});
