"use client";

import { AuthGuard } from "@/components/AuthGuard";
import { Sidebar } from "@/components/Sidebar";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard role="ADMIN">
      <div className="flex min-h-screen bg-mesh-light dark:bg-mesh-dark">
        <Sidebar variant="admin" />
        <div className="flex-1">{children}</div>
      </div>
    </AuthGuard>
  );
}
