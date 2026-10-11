import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Rastrear pedido",
  description: "Consulte a atualização mockada do seu pedido na alves store.",
};

export default function TrackingLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
