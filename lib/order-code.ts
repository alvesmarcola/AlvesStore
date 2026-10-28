/** Código curto do pedido (8 caracteres), usado no rastreio e mostrado ao cliente. */
export const ORDER_CODE_LENGTH = 8;

const UUID_SEGMENTS = [8, 4, 4, 4, 12];

export function orderCode(orderId: string) {
  return orderId.slice(0, ORDER_CODE_LENGTH).toUpperCase();
}

/**
 * Normaliza o que o cliente digitou para o prefixo usado na busca do pedido.
 * Aceita o código curto (com ou sem hífens soltos) e o UUID inteiro (com ou sem hífens).
 */
export function normalizeOrderCodeInput(value: string) {
  const compact = value.replace(/[^a-f0-9]/gi, "").toLowerCase();
  if (compact.length <= ORDER_CODE_LENGTH) return compact;
  const parts: string[] = [];
  let offset = 0;
  for (const size of UUID_SEGMENTS) {
    if (offset >= compact.length) break;
    parts.push(compact.slice(offset, offset + size));
    offset += size;
  }
  return parts.join("-");
}

export function isCompleteOrderCode(value: string) {
  return normalizeOrderCodeInput(value).replaceAll("-", "").length >= ORDER_CODE_LENGTH;
}
