import type { Metadata } from "next";
import { PaymentEnvironmentProvider } from "./payment-env-context";

export const metadata: Metadata = {
  title: "Finalizar compra",
  description: "Finalize seu pedido com pagamento seguro pelo Mercado Pago.",
  robots: { index: false, follow: false },
};

export default function CheckoutLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <PaymentEnvironmentProvider isTest={process.env.PAYMENT_ENVIRONMENT === "test"}>{children}</PaymentEnvironmentProvider>;
}
