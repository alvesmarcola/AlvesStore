import Link from "next/link";
import { getSupabaseOrdersClient } from "@/lib/server/supabase-orders";
import { orderCode } from "@/lib/order-code";
import { OrderReturnActions, RefreshStatusButton } from "./return-actions";

type OrderStatus = "pending" | "approved" | "rejected" | "cancelled" | "refunded";

const orderStatusText: Record<OrderStatus, { title: string; description: string }> = {
  pending: {
    title: "Pagamento em processamento",
    description: "Ainda não recebemos uma confirmação final. O status será atualizado após a notificação verificada do Mercado Pago.",
  },
  approved: {
    title: "Pagamento confirmado",
    description: "O Mercado Pago confirmou o pagamento deste pedido.",
  },
  rejected: {
    title: "Pagamento não aprovado",
    description: "O Mercado Pago informou que o pagamento não foi aprovado. Você pode voltar à sacola e tentar novamente.",
  },
  cancelled: {
    title: "Pagamento cancelado",
    description: "O pagamento deste pedido foi cancelado. A sacola permanece salva.",
  },
  refunded: {
    title: "Pagamento estornado",
    description: "O Mercado Pago confirmou o estorno ou contestação deste pagamento.",
  },
};

export default async function OrderReturnPage({
  searchParams,
}: {
  searchParams: Promise<{ order_id?: string }>;
}) {
  const { order_id: orderId = "" } = await searchParams;
  let status: OrderStatus | "unknown" | "unavailable" = "unknown";
  if (/^[0-9a-f-]{36}$/i.test(orderId)) {
    try {
      const result = await getSupabaseOrdersClient().from("store_orders").select("status").eq("id", orderId).maybeSingle();
      if (result.error) throw result.error;
      status = (result.data?.status as OrderStatus | undefined) ?? "unknown";
    } catch (error) {
      console.error("Falha ao consultar o pedido após retorno do checkout:", error instanceof Error ? error.message : "erro desconhecido");
      status = "unavailable";
    }
  }

  const details = status !== "unknown" && status !== "unavailable"
    ? orderStatusText[status]
    : undefined;
  return <main className="mx-auto max-w-2xl px-5 py-20 text-center">
    <p className="text-[10px] font-black uppercase tracking-[.2em] text-action">ALVES STORE · Mercado Pago</p>
    <h1 className="mt-3 text-3xl font-black">{details?.title ?? "Consulte o status do pedido"}</h1>
    <p className="mt-3 text-sm leading-6 text-muted">{details?.description ?? (status === "unavailable"
      ? "Não foi possível consultar o banco de pedidos agora. O retorno do navegador não confirma pagamento; atualize a página em instantes."
      : "Não foi possível localizar uma confirmação de pagamento para este pedido.")}</p>
    {details && /^[0-9a-f-]{36}$/i.test(orderId) && <div className="mx-auto mt-5 max-w-sm rounded-lg bg-paper p-4 text-sm">
      <p className="text-xs text-muted">Código do seu pedido</p>
      <p className="mt-1 text-2xl font-black tracking-widest">{orderCode(orderId)}</p>
      <p className="mt-2 text-xs leading-5 text-muted">Guarde este código: ele também foi enviado por e-mail. Use-o em <Link href="/rastreio" className="font-bold text-blue-700 underline">Rastrear pedido</Link>, junto com o e-mail ou CPF da compra.</p>
    </div>}
    {status === "approved" && <OrderReturnActions />}
    <div className="mt-7 flex flex-wrap justify-center gap-3">
      <Link href="/carrinho" className="rounded-lg border border-ink px-5 py-3 text-xs font-black uppercase">Voltar à sacola</Link>
      <Link href="/" className="primary-button px-5 py-3 text-xs font-black uppercase">Voltar à loja</Link>
    </div>
    {status !== "approved" && <RefreshStatusButton />}
  </main>;
}
