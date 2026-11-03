import Link from "next/link";

export type AdminSection = "overview" | "orders" | "products" | "suppliers" | "finance" | "settings";

export function AdminNavigation({ current }: { current: AdminSection }) {
  const links = [
    { href: "/admin", label: "Visão geral", key: "overview" as const },
    { href: "/admin/pedidos", label: "Pedidos", key: "orders" as const },
    { href: "/admin/produtos", label: "Produtos e estoque", key: "products" as const },
    { href: "/admin/fornecedores", label: "Fornecedores", key: "suppliers" as const },
    { href: "/admin/financeiro", label: "Financeiro", key: "finance" as const },
    { href: "/admin/configuracoes", label: "Configurações", key: "settings" as const },
  ];
  return (
    <nav aria-label="Administração da loja" className="mb-6 flex flex-wrap gap-2">
      {links.map((link) => (
        <Link
          key={link.key}
          href={link.href}
          aria-current={current === link.key ? "page" : undefined}
          className={`rounded-lg border px-4 py-2 text-xs font-bold ${current === link.key ? "border-ink bg-ink text-white" : "border-border hover:bg-paper"}`}
        >
          {link.label}
        </Link>
      ))}
    </nav>
  );
}
