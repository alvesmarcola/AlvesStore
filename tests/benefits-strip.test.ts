import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import path from "node:path";

test("Cards de benefícios possuem layout responsivo, quebra de linha e largura flexível sem corte", () => {
  const pageContent = fs.readFileSync(path.join(process.cwd(), "app/page.tsx"), "utf-8");

  // Verifica se a seção de benefícios existe
  assert.ok(pageContent.includes("benefits-strip"), "Seção benefits-strip deve estar presente");

  // Verifica a distribuição responsiva de colunas (1 col mobile, 2 col tablet, 4 col desktop)
  assert.ok(
    pageContent.includes("grid-cols-1") && pageContent.includes("lg:grid-cols-4"),
    "Grid deve ser adaptativo (1 coluna em telas menores, 4 em desktop)"
  );

  // Verifica que não usa mais o layout engessado antigo (grid-cols-2 forçado com sm:grid-cols-4)
  assert.ok(
    !pageContent.includes("grid-cols-2 gap-4 px-5 py-7 sm:grid-cols-4"),
    "Não deve manter os cards espremidos com grid-cols-2 fixo e sm:grid-cols-4"
  );

  // Verifica propriedades contra corte de texto
  assert.ok(pageContent.includes("min-w-0"), "Deve incluir min-w-0 para permitir redução correta de container");
  assert.ok(pageContent.includes("break-words"), "Deve incluir break-words para quebra automática de palavras");
  assert.ok(pageContent.includes("whitespace-normal"), "Deve garantir whitespace-normal para quebra automática");

  // Verifica se os 4 benefícios originais estão preservados
  assert.ok(pageContent.includes("Frete facilitado"), "Card 'Frete facilitado' deve existir");
  assert.ok(pageContent.includes("Pagamento seguro"), "Card 'Pagamento seguro' deve existir");
  assert.ok(pageContent.includes("Envio rastreado"), "Card 'Envio rastreado' deve existir");
  assert.ok(pageContent.includes("Personalização"), "Card 'Personalização' deve existir");
});

