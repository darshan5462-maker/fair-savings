"use client";

import { useEffect, useState } from "react";
import {
  WalletIcon,
  CalendarIcon,
  CreditCardIcon,
  ExclamationTriangleIcon,
  ArrowDownTrayIcon,
  UsersIcon,
} from "@heroicons/react/24/outline";
import { Navbar } from "@/components/Navbar";
import { StatCard } from "@/components/StatCard";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/i18n/LanguageContext";
import { api } from "@/lib/api";

interface Savings {
  totalPaid: number;
  weeksCompleted: number;
  weeksRemaining: number;
  currentBalance: number;
}

interface ChildMember {
  id: string;
  name: string;
  username: string;
  savingsCycleWeeks: number;
  savings?: Savings;
  loans: { id: string; remainingAmount: number }[];
  penalties: { id: string; amount: number }[];
}

interface MemberData {
  id: string;
  name: string;
  village?: string;
  weeklyAmount: number;
  savingsCycleWeeks: number;
  savings?: Savings;
  loans: { id: string; remainingAmount: number }[];
  penalties: { id: string; amount: number }[];
  payerRelations?: { child: ChildMember }[];
}

interface ScheduleRow {
  weekNumber: number;
  dueDate: string;
  status: string;
  amountDue: number;
}

export default function MemberDashboard() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [data, setData] = useState<MemberData | null>(null);
  const [schedule, setSchedule] = useState<ScheduleRow[]>([]);

  useEffect(() => {
    if (!user) return;
    api.get(`/dashboard/member/${user.id}`).then((res) => setData(res.data.data));
    api.get(`/collections/schedule/${user.id}`, { params: { weeks: 4 } }).then((res) => setSchedule(res.data.data));
  }, [user]);

  const isFamilyPayer = (data?.payerRelations?.length ?? 0) > 0;
  const children = data?.payerRelations?.map((r) => r.child) ?? [];

  // Individual (non-payer) numbers
  const progress = data?.savings ? Math.min(100, Math.round((data.savings.weeksCompleted / data.savingsCycleWeeks) * 100)) : 0;
  const loanBalance = data?.loans.reduce((s, l) => s + Number(l.remainingAmount), 0) ?? 0;
  const fine = data?.penalties.reduce((s, p) => s + Number(p.amount), 0) ?? 0;
  const upcoming = schedule.filter((s) => s.status !== "PAID").slice(0, 4);

  // Family (payer) rollup numbers - combined across all linked children
  const familyTotalSavings = children.reduce((s, c) => s + Number(c.savings?.totalPaid ?? 0), 0);
  const familyLoanBalance = children.reduce((s, c) => s + c.loans.reduce((ls, l) => ls + Number(l.remainingAmount), 0), 0);
  const familyFine = children.reduce((s, c) => s + c.penalties.reduce((fs, p) => fs + Number(p.amount), 0), 0);

  return (
    <>
      <Navbar title={`${t("dashboard")} — ${data?.name ?? ""}`} />
      <main className="space-y-6 p-6">
        {isFamilyPayer ? (
          <>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <StatCard label="Family Savings" value={`₹${familyTotalSavings}`} icon={WalletIcon} tone="success" />
              <StatCard label="Family Members" value={children.length} icon={UsersIcon} tone="brand" delay={0.05} />
              <StatCard label="Family Loan Balance" value={`₹${familyLoanBalance}`} icon={CreditCardIcon} tone="brand" delay={0.1} />
              <StatCard label="Family Fines" value={`₹${familyFine}`} icon={ExclamationTriangleIcon} tone="danger" delay={0.15} />
            </div>

            <div className="glass-card p-6">
              <h3 className="mb-4 font-display font-semibold">Family Members</h3>
              <div className="space-y-4">
                {children.map((child) => {
                  const childProgress = child.savings
                    ? Math.min(100, Math.round((child.savings.weeksCompleted / child.savingsCycleWeeks) * 100))
                    : 0;
                  const childLoanBalance = child.loans.reduce((s, l) => s + Number(l.remainingAmount), 0);
                  const childFine = child.penalties.reduce((s, p) => s + Number(p.amount), 0);
                  return (
                    <div key={child.id} className="rounded-xl border border-ink-900/10 p-4 dark:border-white/10">
                      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <div className="font-medium">{child.name}</div>
                          <div className="font-mono text-xs text-ink-500">{child.username}</div>
                        </div>
                        <div className="flex gap-4 text-sm">
                          <div>
                            <span className="text-ink-500">Saved: </span>
                            <span className="font-semibold">₹{child.savings?.totalPaid ?? 0}</span>
                          </div>
                          {childLoanBalance > 0 && (
                            <div>
                              <span className="text-ink-500">Loan: </span>
                              <span className="font-semibold">₹{childLoanBalance}</span>
                            </div>
                          )}
                          {childFine > 0 && (
                            <div>
                              <span className="text-danger">Fine: </span>
                              <span className="font-semibold text-danger">₹{childFine}</span>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-ink-900/5 dark:bg-white/10">
                        <div className="h-full rounded-full bg-brand-gradient transition-all duration-700" style={{ width: `${childProgress}%` }} />
                      </div>
                      <p className="mt-1 text-xs text-ink-500">
                        {child.savings?.weeksCompleted ?? 0} / {child.savingsCycleWeeks} weeks · {childProgress}% complete
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        ) : (
          <>
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

            {upcoming.length > 0 && (
              <div className="glass-card p-6">
                <h3 className="mb-3 font-display font-semibold">Upcoming Collection Dates</h3>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {upcoming.map((row) => (
                    <div key={row.weekNumber} className="rounded-xl border border-ink-900/10 p-3 text-center dark:border-white/10">
                      <div className="text-xs text-ink-500">Week {row.weekNumber}</div>
                      <div className="mt-1 font-display font-semibold">
                        {new Date(row.dueDate).toLocaleDateString(undefined, { day: "numeric", month: "short" })}
                      </div>
                      <div className="mt-1 text-xs text-ink-500">₹{row.amountDue}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

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
