import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sua sacola",
  description: "Confira as camisas da sua sacola e os valores de frete fixo por quantidade.",
};

export default function CartLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
