"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { clsx } from "clsx";
import { motion, AnimatePresence } from "framer-motion";
import {
  Squares2X2Icon,
  UsersIcon,
  BanknotesIcon,
  CreditCardIcon,
  ExclamationTriangleIcon,
  DocumentChartBarIcon,
  BellIcon,
  QueueListIcon,
  Cog6ToothIcon,
  ArrowLeftStartOnRectangleIcon,
  XMarkIcon,
  GiftIcon,
} from "@heroicons/react/24/outline";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/i18n/LanguageContext";
import { useMobileNav } from "@/contexts/MobileNavContext";

const adminNav = [
  { href: "/admin", icon: Squares2X2Icon, key: "dashboard" as const },
  { href: "/admin/members", icon: UsersIcon, key: "members" as const },
  { href: "/admin/collections", icon: BanknotesIcon, key: "weeklyCollections" as const },
  { href: "/admin/loans", icon: CreditCardIcon, key: "loans" as const },
  { href: "/admin/loan-giving", icon: GiftIcon, key: "loanGiving" as const },
  { href: "/admin/penalties", icon: ExclamationTriangleIcon, key: "penalties" as const },
  { href: "/admin/reports", icon: DocumentChartBarIcon, key: "reports" as const },
  { href: "/admin/notifications", icon: BellIcon, key: "notifications" as const },
  { href: "/admin/transactions", icon: QueueListIcon, key: "transactions" as const },
  { href: "/admin/settings", icon: Cog6ToothIcon, key: "settings" as const },
];

const memberNav = [
  { href: "/member", icon: Squares2X2Icon, key: "dashboard" as const },
  { href: "/member/loans", icon: CreditCardIcon, key: "loans" as const },
  { href: "/member/loan-giving", icon: GiftIcon, key: "loanGiving" as const },
  { href: "/member/notifications", icon: BellIcon, key: "notifications" as const },
];

function SidebarContent({ variant, onNavigate }: { variant: "admin" | "member"; onNavigate?: () => void }) {
  const pathname = usePathname();
  const { logout, user } = useAuth();
  const { t } = useLanguage();
  const items = variant === "admin" ? adminNav : memberNav;

  return (
    <>
      <div className="mb-6 flex items-center gap-2 px-2 font-display text-lg font-bold">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-gradient text-white">₹</span>
        {t("appName")}
      </div>

      <nav className="flex-1 space-y-1">
        {items.map((item) => {
          const active = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={clsx(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                active
                  ? "bg-brand-gradient text-white shadow-glow"
                  : "text-ink-700 hover:bg-ink-900/5 dark:text-ink-300 dark:hover:bg-white/5"
              )}
            >
              <Icon className="h-5 w-5" />
              {t(item.key)}
            </Link>
          );
        })}
      </nav>

      <div className="mt-4 border-t border-ink-900/5 pt-4 dark:border-white/5">
        <div className="mb-2 px-2 text-xs text-ink-500 dark:text-ink-300">
          {user?.name} · {user?.username}
        </div>
        <button
          onClick={logout}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-danger hover:bg-danger/10"
        >
          <ArrowLeftStartOnRectangleIcon className="h-5 w-5" />
          {t("logout")}
        </button>
      </div>
    </>
  );
}

export function Sidebar({ variant }: { variant: "admin" | "member" }) {
  const { isOpen, close } = useMobileNav();

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-ink-900/5 bg-white/60 p-4 backdrop-blur-xl dark:border-white/5 dark:bg-surface-dark-card/60 md:flex">
        <SidebarContent variant={variant} />
      </aside>

      {/* Mobile drawer */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm md:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={close}
          >
            <motion.aside
              onClick={(e) => e.stopPropagation()}
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "tween", duration: 0.25 }}
              className="flex h-full w-72 flex-col bg-surface-light p-4 shadow-2xl dark:bg-surface-dark"
            >
              <button onClick={close} className="mb-2 flex h-9 w-9 items-center justify-center self-end rounded-full hover:bg-ink-900/5 dark:hover:bg-white/10">
                <XMarkIcon className="h-5 w-5" />
              </button>
              <SidebarContent variant={variant} onNavigate={close} />
            </motion.aside>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
