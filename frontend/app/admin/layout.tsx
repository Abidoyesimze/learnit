import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AdminProvider } from "@/components/admin/AdminProvider";
import { AdminFrame } from "@/components/admin/AdminFrame";

export const metadata: Metadata = { title: "Admin", robots: { index: false, follow: false } };

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <AdminProvider>
      <AdminFrame>{children}</AdminFrame>
    </AdminProvider>
  );
}
