"use client";

import { AuthGuard } from "@/components/AuthGuard";
import { Sidebar } from "@/components/Sidebar";
import { MobileNavProvider } from "@/contexts/MobileNavContext";

export default function MemberLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard role="MEMBER">
      <MobileNavProvider>
        <div className="flex min-h-screen bg-mesh-light dark:bg-mesh-dark">
          <Sidebar variant="member" />
          <div className="min-w-0 flex-1">{children}</div>
        </div>
      </MobileNavProvider>
    </AuthGuard>
  );
}
