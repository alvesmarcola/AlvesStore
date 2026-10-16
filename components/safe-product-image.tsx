"use client";

import Image, { type ImageProps } from "next/image";
import { useState } from "react";

type SafeProductImageProps = ImageProps;

function isYupooSource(source: string) {
  try {
    return /(?:^|\.)yupoo\.com$/i.test(new URL(source, "https://alves-store.invalid").hostname);
  } catch {
    return false;
  }
}

export function SafeProductImage({ src, onError, ...props }: SafeProductImageProps) {
  const sourceKey = typeof src === "string" ? src : "src" in src ? src.src : src.default.src;
  const isYupooImage = typeof src === "string" && isYupooSource(src);
  const [failedSource, setFailedSource] = useState<string | null>(null);
  const failed = failedSource === sourceKey;

  return <Image
    {...props}
    src={failed ? "/product-placeholder.svg" : src}
    unoptimized={failed ? false : props.unoptimized ?? isYupooImage}
    alt={props.alt}
    placeholder={failed ? "empty" : props.placeholder}
    blurDataURL={failed ? undefined : props.blurDataURL}
    onError={(event) => {
      onError?.(event);
      setFailedSource(sourceKey);
    }}
  />;
}
