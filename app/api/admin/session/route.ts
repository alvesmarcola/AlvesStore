import { NextResponse } from "next/server";
import {
  ADMIN_PRIVATE_HEADERS,
  ADMIN_SESSION_COOKIE,
  ADMIN_SESSION_MAX_AGE_SECONDS,
  createAdminSessionValue,
  hasValidAdminSession,
  isValidAdminToken,
} from "@/lib/server/admin-auth";

export const runtime = "nodejs";

const WINDOW_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const loginAttempts = new Map<string, { startedAt: number; count: number }>();

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status, headers: ADMIN_PRIVATE_HEADERS });
}

function getClientIp(request: Request) {
  return request.headers.get("x-real-ip")?.trim()
    || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || "unknown";
}

function rateLimited(request: Request) {
  const now = Date.now();
  for (const [ip, entry] of loginAttempts) {
    if (now - entry.startedAt >= WINDOW_MS) loginAttempts.delete(ip);
  }
  if (loginAttempts.size > 2000) {
    const oldest = [...loginAttempts.entries()].sort((a, b) => a[1].startedAt - b[1].startedAt);
    for (const [ip] of oldest.slice(0, loginAttempts.size - 2000)) loginAttempts.delete(ip);
  }

  const ip = getClientIp(request);
  const current = loginAttempts.get(ip);
  if (!current || now - current.startedAt >= WINDOW_MS) {
    loginAttempts.set(ip, { startedAt: now, count: 1 });
    return false;
  }
  current.count += 1;
  return current.count > MAX_ATTEMPTS;
}

function cookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict" as const,
    path: "/",
    maxAge: ADMIN_SESSION_MAX_AGE_SECONDS,
  };
}

export function GET(request: Request) {
  if (!process.env.ADMIN_ORDERS_TOKEN?.trim()) {
    return jsonError("Acesso administrativo indisponível.", 503);
  }
  if (!hasValidAdminSession(request)) return jsonError("Sessão administrativa inválida ou expirada.", 401);
  return NextResponse.json({ authenticated: true }, { headers: ADMIN_PRIVATE_HEADERS });
}

export async function POST(request: Request) {
  if (!process.env.ADMIN_ORDERS_TOKEN?.trim()) {
    return jsonError("Acesso administrativo indisponível.", 503);
  }
  if (rateLimited(request)) return jsonError("Não foi possível autenticar. Aguarde e tente novamente.", 429);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("Não foi possível autenticar.", 401);
  }
  const token = typeof body === "object" && body !== null && "token" in body
    && typeof body.token === "string" && body.token.length <= 1024
    ? body.token
    : "";
  if (!isValidAdminToken(token)) return jsonError("Não foi possível autenticar.", 401);

  loginAttempts.delete(getClientIp(request));
  const response = NextResponse.json({ authenticated: true }, { headers: ADMIN_PRIVATE_HEADERS });
  response.cookies.set(ADMIN_SESSION_COOKIE, createAdminSessionValue(), cookieOptions());
  return response;
}

export function DELETE() {
  const response = NextResponse.json({ signedOut: true }, { headers: ADMIN_PRIVATE_HEADERS });
  response.cookies.set(ADMIN_SESSION_COOKIE, "", {
    ...cookieOptions(),
    maxAge: 0,
    expires: new Date(0),
  });
  return response;
}
