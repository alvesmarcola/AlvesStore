import { readFile, writeFile } from "node:fs/promises";

async function main() {
  const [, , key, ...args] = process.argv;
  if (!key || args.length % 2 !== 0) throw new Error("Uso: npm run catalog:override -- <product-id-ou-slug> --version fan|player|retro|goalkeeper --sleeve short|long --uniform titular|reserva|terceiro|quarto --full-patch true|false --price VALOR --source URL");
  const valid: Record<string, string[]> = {
    version: ["fan", "player", "retro", "goalkeeper", "unknown"],
    sleeve: ["short", "long", "unknown"],
    uniform: ["titular", "reserva", "terceiro", "quarto"],
    "full-patch": ["true", "false"],
  };
  const override: Record<string, string | number | boolean> = {};
  for (let index = 0; index < args.length; index += 2) {
    const field = args[index].replace(/^--/, "");
    const value = args[index + 1];
    if (valid[field] && !valid[field].includes(value)) throw new Error(`Valor inválido para ${field}.`);
    if (!valid[field] && !["price", "source", "verified-by"].includes(field)) throw new Error(`Campo desconhecido: ${field}.`);
    if (field === "price") {
      const parsed = Number(value);
      if (![160, 180, 185, 220].includes(parsed)) throw new Error("Use um dos preços cadastrados: 160, 180, 185 ou 220.");
      override.price = parsed;
    } else if (field === "full-patch") override.fullPatch = value === "true";
    else if (field === "version") override.version = value;
    else if (field === "sleeve") override.sleeve = value;
    else if (field === "uniform") override.uniform = value;
    else if (field === "source") override.source = value;
    else if (field === "verified-by") override.verifiedBy = value;
  }
  if (!override.source || !override["verifiedBy"]) throw new Error("Informe --source e --verified-by para registrar uma classificação manual.");
  const path = "data/product-overrides.json";
  const data = JSON.parse(await readFile(path, "utf8")) as Record<string, unknown>;
  data[key] = { ...(data[key] as object | undefined), ...override };
  await writeFile(path, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  console.log(`Correção registrada para ${key}. Revise e publique o deploy para ativá-la.`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Não foi possível salvar a correção.");
  process.exitCode = 1;
});
