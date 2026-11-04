import { timingSafeEqual } from "node:crypto";

export type AdminAuthFailure = {
  status: 401 | 503;
  message: string;
};

export const ADMIN_PRIVATE_HEADERS = {
  "Cache-Control": "no-store",
  "X-Robots-Tag": "noindex, nofollow",
} as const;

export function getAdminAuthFailure(request: Request): AdminAuthFailure | null {
  const expected = process.env.ADMIN_ORDERS_TOKEN?.trim();
  if (!expected) {
    return {
      status: 503,
      message: "Acesso administrativo indisponível: ADMIN_ORDERS_TOKEN não está configurado no servidor.",
    };
  }

  const provided = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim() ?? "";
  const expectedBytes = Buffer.from(expected);
  const providedBytes = Buffer.from(provided);
  if (providedBytes.length !== expectedBytes.length || !timingSafeEqual(providedBytes, expectedBytes)) {
    return {
      status: 401,
      message: "Senha administrativa incorreta. Confira se foi informada a mesma ADMIN_ORDERS_TOKEN configurada no servidor.",
    };
  }
  return null;
}
