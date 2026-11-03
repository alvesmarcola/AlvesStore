export type CustomizationDetails = {
  name?: string | null;
  number?: string | null;
};

export const CUSTOMIZATION_NAME_MAX_LENGTH = 12;

export function sanitizeCustomizationName(value: string) {
  return value
    .replace(/<\s*(script|style)\b[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function filterCustomizationNumber(value: string) {
  return value.replace(/\D/g, "").slice(0, 3);
}

export function formatCustomization(customization?: CustomizationDetails | null) {
  if (!customization) return "";
  const name = sanitizeCustomizationName(customization.name ?? "");
  const number = customization.number?.trim() ?? "";
  const details = [
    name ? `Nome: ${name}` : "",
    number ? `Número: ${number}` : "",
  ].filter(Boolean);
  return details.join(" · ");
}

export function getCustomizationError(active: boolean, customization?: CustomizationDetails | null) {
  return active && !formatCustomization(customization)
    ? "Informe o nome, o número ou os dois."
    : "";
}
