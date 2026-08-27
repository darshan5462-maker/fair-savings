"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";

export default function Home() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) return router.replace("/login");
    router.replace(user.role === "ADMIN" ? "/admin" : "/member");
  }, [user, loading, router]);

  return (
    <div className="flex h-screen items-center justify-center bg-mesh-light dark:bg-mesh-dark">
      <div className="h-10 w-10 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
    </div>
  );
}
