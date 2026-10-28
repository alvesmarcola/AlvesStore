// Limite de tentativas por IP, guardado em memória da instância.
// Em ambiente serverless cada instância conta separado, então é uma barreira contra tentativa
// em massa (adivinhar códigos), não um controle distribuído exato.
const windows = new Map<string, { count: number; startedAt: number }>();

export function clientIp(request: Request) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}

export function isRateLimited(request: Request, bucket: string, limit: number, windowMs: number, now = Date.now()) {
  const key = `${bucket}:${clientIp(request)}`;
  const current = windows.get(key);
  if (!current || now - current.startedAt >= windowMs) {
    windows.set(key, { count: 1, startedAt: now });
    return false;
  }
  current.count += 1;
  if (windows.size > 2000) {
    for (const [storedKey, window] of windows) if (now - window.startedAt >= windowMs) windows.delete(storedKey);
  }
  return current.count > limit;
}
