import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sua sacola",
  description: "Confira os produtos, os pacotes e o frete da sua sacola.",
};

export default function CartLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
