import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Administração",
  robots: { index: false, follow: false, noarchive: true },
};

export default function AdminPage() {
  redirect("/admin/pedidos");
}
