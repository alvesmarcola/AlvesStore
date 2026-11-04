import type { Metadata } from "next";
import { SITE_NAME } from "@/lib/site";

export const metadata: Metadata = {
  title: "Rastrear pedido",
  description: `Consulte o status e o código de rastreio do seu pedido na ${SITE_NAME}.`,
};

export default function TrackingLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
