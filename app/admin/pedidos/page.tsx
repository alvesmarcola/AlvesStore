import type { Metadata } from "next";
import AdminOrders from "./orders-client";

export const metadata: Metadata = { title: "Pedidos", robots: { index: false, follow: false, noarchive: true } };
export default function OrdersPage() { return <AdminOrders />; }
