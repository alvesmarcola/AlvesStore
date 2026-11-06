import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("verificar-banco-remoto.ts usa apenas GET/HEAD (sem escrita remota)", () => {
  const source = readFileSync("scripts/consulta/verificar-banco-remoto.ts", "utf8");
  // Nenhum metodo HTTP de escrita pode aparecer.
  assert.doesNotMatch(source, /\b(POST|PUT|PATCH|DELETE)\b/);
  // Nenhuma chamada de mutacao do Supabase client.
  assert.doesNotMatch(source, /\.insert\(|\.update\(|\.delete\(|\.upsert\(/);
  // A unica chamada fetch deve ser GET.
  assert.match(source, /method:\s*"GET"/);
});
