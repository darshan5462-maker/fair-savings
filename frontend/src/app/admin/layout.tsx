"use client";

import { AuthGuard } from "@/components/AuthGuard";
import { Sidebar } from "@/components/Sidebar";
import { MobileNavProvider } from "@/contexts/MobileNavContext";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard role="ADMIN">
      <MobileNavProvider>
        <div className="flex min-h-screen bg-mesh-light dark:bg-mesh-dark">
          <Sidebar variant="admin" />
          <div className="min-w-0 flex-1">{children}</div>
        </div>
      </MobileNavProvider>
    </AuthGuard>
  );
}
