import { timingSafeEqual } from "node:crypto";

export function isAuthorizedAdmin(request: Request) {
  const expected = process.env.ADMIN_ORDERS_TOKEN;
  const provided = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!expected || provided.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(provided), Buffer.from(expected));
}
