import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Finalizar compra",
  description: "Checkout demonstrativo seguro da alves store.",
  robots: { index: false, follow: false },
};

export default function CheckoutLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
