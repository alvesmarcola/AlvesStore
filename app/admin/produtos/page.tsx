import type { Metadata } from "next";
import AdminProducts from "./products-client";

export const metadata: Metadata = {
  title: "Produtos e estoque",
  robots: { index: false, follow: false, noarchive: true },
};

export default function ProductsPage() {
  return <AdminProducts />;
}
