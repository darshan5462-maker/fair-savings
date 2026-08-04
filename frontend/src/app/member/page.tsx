"use client";

import { useEffect, useState } from "react";
import { WalletIcon, CalendarIcon, CreditCardIcon, ExclamationTriangleIcon, ArrowDownTrayIcon } from "@heroicons/react/24/outline";
import { Navbar } from "@/components/Navbar";
import { StatCard } from "@/components/StatCard";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/i18n/LanguageContext";
import { api } from "@/lib/api";

interface MemberData {
  id: string;
  name: string;
  village?: string;
  weeklyAmount: number;
  savingsCycleWeeks: number;
  savings?: { totalPaid: number; weeksCompleted: number; weeksRemaining: number; currentBalance: number };
  loans: { id: string; remainingAmount: number }[];
  penalties: { id: string; amount: number }[];
}

export default function MemberDashboard() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [data, setData] = useState<MemberData | null>(null);

  useEffect(() => {
    if (!user) return;
    api.get(`/dashboard/member/${user.id}`).then((res) => setData(res.data.data));
  }, [user]);

  const progress = data?.savings ? Math.min(100, Math.round((data.savings.weeksCompleted / data.savingsCycleWeeks) * 100)) : 0;
  const loanBalance = data?.loans.reduce((s, l) => s + Number(l.remainingAmount), 0) ?? 0;
  const fine = data?.penalties.reduce((s, p) => s + Number(p.amount), 0) ?? 0;

  return (
    <>
      <Navbar title={`${t("dashboard")} — ${data?.name ?? ""}`} />
      <main className="space-y-6 p-6">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <StatCard label={t("totalSavings")} value={`₹${data?.savings?.totalPaid ?? 0}`} icon={WalletIcon} tone="success" />
          <StatCard label={t("remainingWeeks")} value={data?.savings?.weeksRemaining ?? 0} icon={CalendarIcon} tone="brand" delay={0.05} />
          <StatCard label={t("loanBalance")} value={`₹${loanBalance}`} icon={CreditCardIcon} tone="brand" delay={0.1} />
          <StatCard label={t("fine")} value={`₹${fine}`} icon={ExclamationTriangleIcon} tone="danger" delay={0.15} />
        </div>

        <div className="glass-card p-6">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="font-display font-semibold">{t("weeklySavings")} Progress</h3>
            <span className="text-sm text-ink-500">
              {data?.savings?.weeksCompleted ?? 0} / {data?.savingsCycleWeeks ?? 52} weeks
            </span>
          </div>
          <div className="h-3 w-full overflow-hidden rounded-full bg-ink-900/5 dark:bg-white/10">
            <div className="h-full rounded-full bg-brand-gradient transition-all duration-700" style={{ width: `${progress}%` }} />
          </div>
          <p className="mt-2 text-xs text-ink-500">{progress}% complete</p>
        </div>

        <div className="flex justify-end">
          {user && (
            <a
              href={`${process.env.NEXT_PUBLIC_API_URL}/reports/member/${user.id}/statement.pdf`}
              target="_blank"
              rel="noreferrer"
              className="btn-secondary"
            >
              <ArrowDownTrayIcon className="h-4 w-4" /> {t("downloadStatement")}
            </a>
          )}
        </div>
      </main>
    </>
  );
}
