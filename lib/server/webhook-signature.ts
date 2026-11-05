import { createHmac, timingSafeEqual } from "node:crypto";

export function isValidMercadoPagoSignature({
  secret,
  signature,
  requestId,
  dataId,
}: {
  secret: string;
  signature: string | null;
  requestId: string | null;
  dataId: string;
}) {
  if (!signature || !requestId || !secret) return false;
  const parts = Object.fromEntries(signature.split(",").flatMap((part) => {
    const separator = part.indexOf("=");
    return separator > 0 ? [[part.slice(0, separator).trim(), part.slice(separator + 1).trim()]] : [];
  }));
  if (!parts.ts || !parts.v1 || !/^[a-f\d]{64}$/i.test(parts.v1)) return false;

  const received = Buffer.from(parts.v1, "hex");

  const verify = (id: string) => {
    const manifest = `id:${id.toLowerCase()};request-id:${requestId};ts:${parts.ts};`;
    const expected = createHmac("sha256", secret).update(manifest).digest();
    return expected.length === received.length && timingSafeEqual(expected, received);
  };

  if (dataId && verify(dataId)) return true;
  if (verify("")) return true;
  return false;
}

export function normalizedPaymentStatus(status: string | undefined) {
  switch (status) {
    case "approved": return "approved";
    case "pending":
    case "in_process":
    case "authorized": return "pending";
    case "rejected": return "rejected";
    case "cancelled": return "cancelled";
    case "refunded":
    case "charged_back": return "refunded";
    default: return undefined;
  }
}
