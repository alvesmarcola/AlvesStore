import type { Metadata } from "next";
import AdminSummaryClient from "./admin-summary-client";

export const metadata: Metadata = {
  title: "Administração",
  robots: { index: false, follow: false, noarchive: true },
};

export default function AdminPage() {
  return <AdminSummaryClient current="overview" />;
}
