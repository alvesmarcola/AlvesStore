const STORAGE_KEY = "imports-alves:checkout-attempt";

type KeyStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export async function fingerprintCheckoutAttempt(value: unknown) {
  const data = new TextEncoder().encode(JSON.stringify(value));
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function getCheckoutAttemptKey(
  fingerprint: string,
  storage?: KeyStorage,
  createKey: () => string = () => crypto.randomUUID(),
) {
  if (storage) {
    try {
      const saved = storage.getItem(STORAGE_KEY);
      if (saved) {
        const attempt: unknown = JSON.parse(saved);
        if (typeof attempt === "object" && attempt !== null
          && "fingerprint" in attempt && attempt.fingerprint === fingerprint
          && "key" in attempt && typeof attempt.key === "string"
          && /^[0-9a-f-]{36}$/i.test(attempt.key)) {
          return attempt.key;
        }
      }

      const key = createKey();
      storage.setItem(STORAGE_KEY, JSON.stringify({ fingerprint, key }));
      return key;
    } catch {
      return createKey();
    }
  }
  return createKey();
}

export function clearCheckoutAttempt(storage?: KeyStorage) {
  try {
    (storage ?? window.sessionStorage).removeItem(STORAGE_KEY);
  } catch {
    // Checkout can still be completed if browser storage is unavailable.
  }
}
