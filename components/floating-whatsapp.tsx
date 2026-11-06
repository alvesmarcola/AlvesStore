"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { whatsappLink } from "@/lib/whatsapp";
import { SITE_NAME } from "@/lib/site";

export function FloatingWhatsApp() {
  const pathname = usePathname();
  const [whatsappUrl, setWhatsappUrl] = useState(() =>
    whatsappLink(`Olá! Vim pelo site da ${SITE_NAME} e gostaria de tirar uma dúvida sobre os produtos.`)
  );

  const isProductPage = Boolean(pathname?.startsWith("/produto/"));

  useEffect(() => {
    if (typeof window === "undefined") return;

    if (isProductPage) {
      // Na página de produto, recupera o nome do produto do título ou cabeçalho e inclui a URL
      const pageTitle = document.title.split("|")[0].trim() || "Produto";
      const pageUrl = window.location.href;
      setWhatsappUrl(
        whatsappLink(`Olá! Gostei do produto "${pageTitle}" (${pageUrl}) na ${SITE_NAME} e gostaria de tirar uma dúvida.`)
      );
    } else {
      setWhatsappUrl(
        whatsappLink(`Olá! Vim pelo site da ${SITE_NAME} e gostaria de tirar uma dúvida sobre os produtos.`)
      );
    }
  }, [pathname, isProductPage]);

  // Não exibe no admin ou durante o checkout para manter foco total na finalização da compra
  if (pathname?.startsWith("/admin") || pathname?.startsWith("/checkout")) {
    return null;
  }

  return (
    <a
      href={whatsappUrl}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Fale conosco pelo WhatsApp"
      className={`group fixed right-4 z-40 inline-flex items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg transition-transform duration-200 hover:scale-105 hover:bg-[#20bd5a] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#25D366]/40 motion-reduce:transition-none ${
        isProductPage
          ? "bottom-[calc(env(safe-area-inset-bottom,0px)+4.75rem)] sm:bottom-6 sm:right-6 h-11 w-11 sm:h-12 sm:w-12"
          : "bottom-[calc(env(safe-area-inset-bottom,0px)+1.25rem)] sm:bottom-6 sm:right-6 h-11 w-11 sm:h-12 sm:w-12"
      }`}
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 rounded-full bg-[#25D366]/40 motion-safe:animate-[whatsapp-pulse_3s_ease-out_infinite] motion-reduce:animate-none"
      />
      <svg
        aria-hidden="true"
        viewBox="0 0 32 32"
        className="relative h-6 w-6 sm:h-7 sm:w-7 fill-current"
      >
        <path d="M16.02 2.67A13.25 13.25 0 0 0 4.64 22.7L2.8 29.33l6.8-1.78a13.3 13.3 0 0 0 6.4 1.63h.01a13.26 13.26 0 0 0 .01-26.51Zm0 24.27h-.01a11.02 11.02 0 0 1-5.62-1.54l-.4-.24-4.03 1.06 1.08-3.93-.26-.41a11.02 11.02 0 1 1 9.24 5.06Zm6.05-8.26c-.33-.17-1.95-.96-2.25-1.07-.3-.11-.52-.17-.74.17-.22.34-.85 1.07-1.04 1.29-.19.22-.38.25-.71.08-.33-.17-1.39-.51-2.65-1.63-.98-.87-1.64-1.95-1.83-2.28-.19-.33-.02-.51.15-.68.15-.15.33-.38.5-.57.17-.19.22-.33.33-.55.11-.22.05-.41-.03-.57-.08-.17-.74-1.78-1.01-2.43-.27-.64-.54-.55-.74-.56h-.63c-.22 0-.57.08-.87.41-.3.33-1.15 1.13-1.15 2.75s1.18 3.19 1.34 3.41c.17.22 2.32 3.54 5.62 4.97.79.34 1.41.55 1.89.7.79.25 1.51.22 2.08.13.63-.09 1.95-.8 2.22-1.57.28-.77.28-1.43.19-1.57-.08-.14-.3-.22-.63-.39Z" />
      </svg>
      <span className="pointer-events-none absolute right-full mr-3 hidden sm:inline-block whitespace-nowrap rounded-lg bg-[#151515] px-3 py-1.5 text-xs font-semibold text-white opacity-0 shadow-lg transition duration-200 group-hover:translate-x-0 group-hover:opacity-100 group-focus-visible:translate-x-0 group-focus-visible:opacity-100 translate-x-1">
        Dúvidas? Fale no WhatsApp
      </span>
    </a>
  );
}
