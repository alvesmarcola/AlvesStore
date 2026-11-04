"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";

export type AdminSection = "overview" | "orders" | "products" | "suppliers" | "finance" | "reviews" | "settings";

export function AdminNavigation({ current }: { current: AdminSection }) {
  const activeLink = useRef<HTMLAnchorElement>(null);
  useEffect(() => {
    if (window.innerWidth <= 768) activeLink.current?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [current]);

  const links = [
    { href: "/admin", label: "Visão geral", key: "overview" as const },
    { href: "/admin/pedidos", label: "Pedidos", key: "orders" as const },
    { href: "/admin/produtos", label: "Produtos e estoque", key: "products" as const },
    { href: "/admin/fornecedores", label: "Fornecedores", key: "suppliers" as const },
    { href: "/admin/financeiro", label: "Financeiro", key: "finance" as const },
    { href: "/admin/avaliacoes", label: "Avaliações", key: "reviews" as const },
    { href: "/admin/configuracoes", label: "Configurações", key: "settings" as const },
  ];
  return (
    <nav aria-label="Administração da loja" className="mb-6 -mx-5 overflow-x-auto px-5 sm:mx-0 sm:px-0">
      <div className="flex w-max min-w-full gap-2 pb-2">
      {links.map((link) => (
        <Link
          key={link.key}
          href={link.href}
          aria-current={current === link.key ? "page" : undefined}
          ref={current === link.key ? activeLink : undefined}
          className={`min-h-11 whitespace-nowrap rounded-lg border px-4 py-2 text-xs font-bold transition ${current === link.key ? "border-ink bg-ink text-white" : "border-border bg-white hover:bg-paper"}`}
        >
          {link.label}
        </Link>
      ))}
      </div>
    </nav>
  );
}
