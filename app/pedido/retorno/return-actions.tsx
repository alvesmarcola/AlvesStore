"use client";

import { useEffect } from "react";
import { useCart } from "@/store/cart";

export function OrderReturnActions() {
  const clearCart = useCart((state) => state.clearCart);
  useEffect(() => clearCart(), [clearCart]);
  return null;
}

export function RefreshStatusButton() {
  return <button type="button" onClick={() => window.location.reload()} className="mt-5 text-xs font-bold underline">Atualizar status</button>;
}
