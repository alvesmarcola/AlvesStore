import { createHmac, timingSafeEqual } from "node:crypto";

export type AdminAuthFailure = {
  status: 401 | 503;
  message: string;
};

export const ADMIN_PRIVATE_HEADERS = {
  "Cache-Control": "no-store",
  "X-Robots-Tag": "noindex, nofollow",
} as const;

export const ADMIN_SESSION_COOKIE = "imports_alves_admin_session";
export const ADMIN_SESSION_MAX_AGE_SECONDS = 8 * 60 * 60;

function getAdminToken() {
  return process.env.ADMIN_ORDERS_TOKEN?.trim() ?? "";
}

function safeEqual(left: string, right: string) {
  const leftBytes = Buffer.from(left);
  const rightBytes = Buffer.from(right);
  return leftBytes.length === rightBytes.length && timingSafeEqual(leftBytes, rightBytes);
}

export function isValidAdminToken(value: string) {
  const expected = getAdminToken();
  return Boolean(expected && safeEqual(value.trim(), expected));
}

function signatureForExpiry(token: string, expiresAt: number) {
  const key = createHmac("sha256", token)
    .update(`imports-alves-admin-session:${expiresAt}`)
    .digest();
  return createHmac("sha256", key).update(`v1:${expiresAt}`).digest("hex");
}

export function createAdminSessionValue(now = Date.now()) {
  const token = getAdminToken();
  if (!token) throw new Error("ADMIN_ORDERS_TOKEN não está configurado.");
  const expiresAt = Math.floor(now / 1000) + ADMIN_SESSION_MAX_AGE_SECONDS;
  return `${expiresAt}.${signatureForExpiry(token, expiresAt)}`;
}

export function isValidAdminSessionValue(value: string, now = Date.now()) {
  const token = getAdminToken();
  if (!token) return false;
  const match = /^(\d{10})\.([a-f\d]{64})$/i.exec(value);
  if (!match) return false;
  const expiresAt = Number(match[1]);
  if (!Number.isSafeInteger(expiresAt) || expiresAt <= Math.floor(now / 1000)) return false;
  return safeEqual(match[2], signatureForExpiry(token, expiresAt));
}

function getCookieValue(request: Request, name: string) {
  const cookie = request.headers.get("cookie") ?? "";
  for (const part of cookie.split(";")) {
    const separator = part.indexOf("=");
    if (separator < 0 || part.slice(0, separator).trim() !== name) continue;
    return part.slice(separator + 1).trim();
  }
  return "";
}

export function hasValidAdminSession(request: Request) {
  return isValidAdminSessionValue(getCookieValue(request, ADMIN_SESSION_COOKIE));
}

export function getAdminAuthFailure(request: Request): AdminAuthFailure | null {
  const expected = getAdminToken();
  if (!expected) {
    return {
      status: 503,
      message: "Acesso administrativo indisponível: ADMIN_ORDERS_TOKEN não está configurado no servidor.",
    };
  }

  const bearer = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim() ?? "";
  if (bearer && safeEqual(bearer, expected)) return null;
  if (hasValidAdminSession(request)) return null;

  return { status: 401, message: "Acesso administrativo negado." };
}
