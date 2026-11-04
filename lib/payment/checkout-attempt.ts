const STORAGE_KEY = "imports-alves:checkout-attempt";

type KeyStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export async function fingerprintCheckoutAttempt(value: unknown) {
  const items = Array.isArray(value) ? value : [];
  const safeItems = items.map((item) => {
    if (typeof item !== "object" || item === null || Array.isArray(item)) return null;
    const line = item as Record<string, unknown>;
    const patches = Array.isArray(line.patches)
      ? line.patches.map((patch) => {
        if (typeof patch !== "object" || patch === null || Array.isArray(patch)) return null;
        const option = patch as Record<string, unknown>;
        return { id: option.id, position: option.position };
      })
      : [];
    return {
      productId: line.productId,
      size: line.size,
      quantity: line.quantity,
      patches,
    };
  });
  const data = new TextEncoder().encode(JSON.stringify(safeItems));
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function getCheckoutAttemptKey(
  storage?: KeyStorage,
  createKey: () => string = () => crypto.randomUUID(),
) {
  if (storage) {
    try {
      const saved = storage.getItem(STORAGE_KEY);
      if (saved && /^[0-9a-f-]{36}$/i.test(saved)) return saved;

      const key = createKey();
      storage.setItem(STORAGE_KEY, key);
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
