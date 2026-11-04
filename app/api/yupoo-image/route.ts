import { NextResponse } from "next/server";

export const runtime = "nodejs";

const MAX_BYTES = 8 * 1024 * 1024;
const CACHE_CONTROL = "public, max-age=86400, s-maxage=2592000, stale-while-revalidate=604800";

function isAllowedYupooUrl(value: string | null): URL | null {
  if (!value) return null;
  try {
    const url = new URL(value.startsWith("//") ? `https:${value}` : value);
    const host = url.hostname.toLocaleLowerCase("en-US");
    const isYupoo = host === "yupoo.com" || host.endsWith(".yupoo.com");
    if (!isYupoo) return null;
    if (url.protocol === "http:") url.protocol = "https:";
    if (url.protocol !== "https:" || url.username || url.password) return null;
    return url;
  } catch {
    return null;
  }
}

// O Yupoo bloqueia imagens carregadas direto pelo navegador de outro site (hotlink).
// Esta rota busca a imagem no servidor, enviando o Referer que o Yupoo espera,
// e a entrega com cache longo. Só aceita endereços do próprio Yupoo.
export async function GET(request: Request) {
  const target = isAllowedYupooUrl(new URL(request.url).searchParams.get("u"));
  if (!target) return NextResponse.json({ error: "Imagem inválida." }, { status: 400 });

  try {
    let current = target;
    let upstream: Response | null = null;
    for (let hop = 0; hop < 3; hop += 1) {
      upstream = await fetch(current, {
        redirect: "manual",
        signal: AbortSignal.timeout(10_000),
        headers: {
          Referer: "https://photo.yupoo.com/",
          "User-Agent": "Mozilla/5.0 (compatible; ImportsAlvesImageProxy/1.0)",
          Accept: "image/avif,image/webp,image/*,*/*;q=0.8",
        },
      });
      if (upstream.status >= 300 && upstream.status < 400) {
        const next = isAllowedYupooUrl(upstream.headers.get("location") ? new URL(upstream.headers.get("location")!, current).toString() : null);
        if (!next) return NextResponse.json({ error: "Redirecionamento não permitido." }, { status: 502 });
        current = next;
        continue;
      }
      break;
    }
    if (!upstream || !upstream.ok) return NextResponse.json({ error: "Imagem indisponível." }, { status: 502 });

    const contentType = upstream.headers.get("content-type") ?? "";
    if (!contentType.toLocaleLowerCase("en-US").startsWith("image/")) {
      return NextResponse.json({ error: "Resposta não é uma imagem." }, { status: 502 });
    }
    const contentLength = Number(upstream.headers.get("content-length"));
    if (Number.isFinite(contentLength) && contentLength > MAX_BYTES) {
      return NextResponse.json({ error: "Imagem fora do tamanho permitido." }, { status: 502 });
    }
    const reader = upstream.body?.getReader();
    if (!reader) return NextResponse.json({ error: "Imagem indisponível." }, { status: 502 });

    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BYTES) {
        await reader.cancel();
        return NextResponse.json({ error: "Imagem fora do tamanho permitido." }, { status: 502 });
      }
      chunks.push(value);
    }
    if (size === 0) return NextResponse.json({ error: "Imagem indisponível." }, { status: 502 });
    const body = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      body.set(chunk, offset);
      offset += chunk.byteLength;
    }

    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": CACHE_CONTROL,
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    console.error("Falha ao buscar imagem remota do Yupoo.");
    return NextResponse.json({ error: "Falha ao carregar a imagem." }, { status: 502 });
  }
}
