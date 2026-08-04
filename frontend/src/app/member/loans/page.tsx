"use client";

import { useEffect, useState } from "react";
import { Navbar } from "@/components/Navbar";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/i18n/LanguageContext";
import { api } from "@/lib/api";

interface Loan {
  id: string;
  principalAmount: number;
  interestRate: number;
  weeklyEmi: number;
  paidAmount: number;
  remainingAmount: number;
  remainingWeeks: number;
  status: string;
}

export default function MemberLoansPage() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [loans, setLoans] = useState<Loan[]>([]);

  useEffect(() => {
    if (!user) return;
    api.get(`/loans/member/${user.id}`).then((res) => setLoans(res.data.data));
  }, [user]);

  return (
    <>
      <Navbar title={t("loans")} />
      <main className="grid grid-cols-1 gap-4 p-6 sm:grid-cols-2">
        {loans.length === 0 && <p className="text-sm text-ink-500">{t("noDataFound")}</p>}
        {loans.map((l) => (
          <div key={l.id} className="glass-card p-5">
            <div className="mb-2 flex items-center justify-between">
              <span className="font-display text-lg font-bold">₹{l.principalAmount}</span>
              <span className="rounded-full bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-700 dark:bg-brand-900/40 dark:text-brand-300">
                {l.status}
              </span>
            </div>
            <div className="space-y-1 text-sm text-ink-500 dark:text-ink-300">
              <div>Interest: {l.interestRate}%</div>
              <div>Weekly EMI: ₹{l.weeklyEmi}</div>
              <div>Paid: ₹{l.paidAmount}</div>
              <div>Remaining: ₹{l.remainingAmount}</div>
              <div>Weeks left: {l.remainingWeeks}</div>
            </div>
          </div>
        ))}
      </main>
    </>
  );
}
