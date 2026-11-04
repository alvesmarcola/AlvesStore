import type { Metadata } from "next";
import { AdminFrame } from "./admin-frame";
import { SITE_NAME } from "@/lib/site";

export const metadata: Metadata = {
  title: { absolute: `${SITE_NAME} · Administração` },
  robots: { index: false, follow: false, noarchive: true },
};

export default function AdminLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <AdminFrame>{children}</AdminFrame>;
}
