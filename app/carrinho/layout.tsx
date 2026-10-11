import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sua sacola",
  description: "Confira as camisas da sua sacola, aplique um cupom e simule o frete.",
};

export default function CartLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
