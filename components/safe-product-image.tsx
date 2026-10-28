"use client";

import Image, { type ImageProps } from "next/image";
import { useState } from "react";

type SafeProductImageProps = ImageProps & { fallbackSrc?: string };

function isYupooSource(source: string) {
  try {
    return /(?:^|\.)yupoo\.com$/i.test(new URL(source, "https://alves-store.invalid").hostname);
  } catch {
    return false;
  }
}

export function SafeProductImage({ src, onError, fallbackSrc = "/product-placeholder.svg", ...props }: SafeProductImageProps) {
  const sourceKey = typeof src === "string" ? src : "src" in src ? src.src : src.default.src;
  const isYupooImage = typeof src === "string" && isYupooSource(src);
  const [failedSource, setFailedSource] = useState<string | null>(null);
  const failed = failedSource === sourceKey;
  // Fotos do Yupoo passam pelo servidor da loja, porque o Yupoo bloqueia o carregamento direto.
  const displaySrc = isYupooImage && typeof src === "string" ? `/api/yupoo-image?u=${encodeURIComponent(src)}` : src;

  return <Image
    {...props}
    src={failed ? fallbackSrc : displaySrc}
    unoptimized={failed ? false : props.unoptimized ?? isYupooImage}
    alt={props.alt}
    placeholder={props.placeholder}
    blurDataURL={props.blurDataURL}
    onError={(event) => {
      onError?.(event);
      if (sourceKey !== fallbackSrc) setFailedSource(sourceKey);
    }}
  />;
}
