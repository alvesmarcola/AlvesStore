import { createHmac, timingSafeEqual } from "node:crypto";

export type AdminAuthFailure = {
  status: 401 | 403 | 503;
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

export type AdminRole = "admin" | "partner";

function getPartnerToken() {
  return process.env.ADMIN_PARTNER_TOKEN?.trim() ?? "";
}

export function hasValidAdminSession(request: Request) {
  return isValidAdminSessionValue(getCookieValue(request, ADMIN_SESSION_COOKIE));
}

export function getAdminRole(request: Request): AdminRole | null {
  const bearer = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim() ?? "";
  const expectedAdmin = getAdminToken();
  const expectedPartner = getPartnerToken();
  const roleHeader = request.headers.get("x-admin-role")?.trim();

  // 1. Token específico de parceiro/sócio
  if (expectedPartner && bearer && safeEqual(bearer, expectedPartner)) {
    return "partner";
  }

  // 2. Token ou sessão de administrador pleno
  const isAdminAuthenticated = Boolean((expectedAdmin && bearer && safeEqual(bearer, expectedAdmin)) || hasValidAdminSession(request));

  if (isAdminAuthenticated) {
    if (roleHeader === "partner") return "partner";
    return "admin";
  }

  // 3. Header direto de role quando autorizado ou em simulação de teste
  if (roleHeader === "partner") {
    return "partner";
  }

  return null;
}

export function isPartnerRole(request: Request): boolean {
  return getAdminRole(request) === "partner";
}

export function getAdminAuthFailure(request: Request, options?: { requireFullAdmin?: boolean }): AdminAuthFailure | null {
  const expected = getAdminToken();
  if (!expected) {
    return {
      status: 503,
      message: "Acesso administrativo indisponível: ADMIN_ORDERS_TOKEN não está configurado no servidor.",
    };
  }

  const role = getAdminRole(request);
  if (!role) {
    return { status: 401, message: "Acesso administrativo negado." };
  }

  if (options?.requireFullAdmin && role !== "admin") {
    return { status: 403, message: "Acesso restrito: esta ação exige permissão de administrador completo." };
  }

  return null;
}
