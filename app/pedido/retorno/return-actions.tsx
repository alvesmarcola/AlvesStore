"use client";

import { useEffect } from "react";
import { useCart } from "@/store/cart";
import { clearCheckoutAttempt } from "@/lib/payment/checkout-attempt";

export function OrderReturnActions() {
  const clearCart = useCart((state) => state.clearCart);
  useEffect(() => {
    clearCart();
    clearCheckoutAttempt();
  }, [clearCart]);
  return null;
}

export function RefreshStatusButton() {
  return <button type="button" onClick={() => window.location.reload()} className="mt-5 text-xs font-bold underline">Atualizar status</button>;
}
