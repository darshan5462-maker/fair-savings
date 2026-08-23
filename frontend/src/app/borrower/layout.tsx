"use client";

import { AuthGuard } from "@/components/AuthGuard";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { SunIcon, MoonIcon, ArrowLeftStartOnRectangleIcon } from "@heroicons/react/24/outline";

// Deliberately its own tiny layout, not the full Sidebar used for admin/member.
// A borrower's login exists only to view and pay their own loan - no nav to
// members, savings, other loans, or anything else in the app.
export default function BorrowerLayout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();

  return (
    <AuthGuard role="BORROWER">
      <div className="min-h-screen bg-mesh-light dark:bg-mesh-dark">
        <header className="sticky top-0 z-10 flex items-center justify-between border-b border-ink-900/5 bg-surface-light/80 px-6 py-4 backdrop-blur-xl dark:border-white/5 dark:bg-surface-dark/80">
          <div className="flex items-center gap-2 font-display text-lg font-bold">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-gradient text-white">₹</span>
            Fair Savings
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-ink-500 sm:inline">{user?.name}</span>
            <button
              onClick={toggleTheme}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-ink-900/10 dark:border-white/10"
            >
              {theme === "light" ? <MoonIcon className="h-4 w-4" /> : <SunIcon className="h-4 w-4" />}
            </button>
            <button
              onClick={logout}
              className="flex items-center gap-1.5 rounded-full border border-danger/20 px-3 py-1.5 text-sm font-medium text-danger hover:bg-danger/10"
            >
              <ArrowLeftStartOnRectangleIcon className="h-4 w-4" /> Logout
            </button>
          </div>
        </header>
        <main className="mx-auto max-w-2xl p-6">{children}</main>
      </div>
    </AuthGuard>
  );
}
