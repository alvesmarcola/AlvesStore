import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Rastrear pedido",
  description: "Consulte o status e o código de rastreio do seu pedido na Alves Store.",
};

export default function TrackingLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
