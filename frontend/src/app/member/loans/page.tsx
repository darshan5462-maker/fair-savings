"use client";

import { useEffect, useState } from "react";
import { ChevronDownIcon, ChevronUpIcon, UserIcon, ClockIcon } from "@heroicons/react/24/outline";
import { Navbar } from "@/components/Navbar";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/i18n/LanguageContext";
import { api } from "@/lib/api";

interface LoanPayment {
  id: string;
  weekNumber: number;
  emiDue: number;
  amountPaid: number;
  status: string;
  paymentDate: string | null;
  dueDate: string;
}

interface Loan {
  id: string;
  borrowerType: "SELF" | "OUTSIDE";
  principalAmount: number;
  interestRate: number;
  weeklyEmi: number;
  durationWeeks: number;
  paidAmount: number;
  remainingAmount: number;
  remainingWeeks: number;
  status: string;
  issueDate: string;
  borrower?: { name: string; username: string; phone?: string } | null;
  payments: LoanPayment[];
}

const statusColor: Record<string, string> = {
  PAID: "bg-success/10 text-success",
  PENDING: "bg-warning/10 text-warning",
  MISSED: "bg-danger/10 text-danger",
  PARTIAL: "bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300",
  ACTIVE: "bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300",
  COMPLETED: "bg-success/10 text-success",
  RENEWED: "bg-warning/10 text-warning",
  DEFAULTED: "bg-danger/10 text-danger",
};

export default function MemberLoansPage() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [loans, setLoans] = useState<Loan[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    api.get(`/loans/member/${user.id}`).then((res) => setLoans(res.data.data));
  }, [user]);

  const selfLoans = loans.filter((l) => l.borrowerType !== "OUTSIDE");
  const givenLoans = loans.filter((l) => l.borrowerType === "OUTSIDE");

  function renderLoanCard(l: Loan, isGiven = false) {
    const isOpen = expanded === l.id;
    const total = Number(l.principalAmount) * (1 + (l.interestRate || 0) / 100);
    const progress = Math.min(100, Math.round((Number(l.paidAmount) / (total || Number(l.principalAmount))) * 100));

    return (
      <div key={l.id} className="glass-card p-5">
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {isGiven && <UserIcon className="h-4 w-4 text-brand-600 dark:text-brand-400" />}
            <span className="font-display text-lg font-bold">
              {isGiven ? l.borrower?.name || "Outside Borrower" : `₹${l.principalAmount}`}
            </span>
            {isGiven && l.borrower?.username && (
              <span className="font-mono text-xs text-ink-500">({l.borrower.username})</span>
            )}
          </div>
          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusColor[l.status]}`}>
            {l.status}
          </span>
        </div>

        {isGiven && (
          <div className="mb-2 text-sm font-semibold text-ink-900 dark:text-white">
            Principal: ₹{l.principalAmount}
          </div>
        )}

        <div className="space-y-1 text-xs text-ink-500 dark:text-ink-300">
          <div>Issued: {new Date(l.issueDate).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}</div>
          <div>Interest: {l.interestRate}% · Weekly EMI: ₹{l.weeklyEmi}</div>
        </div>

        <div className="mt-3 mb-1 h-2 w-full overflow-hidden rounded-full bg-ink-900/5 dark:bg-white/10">
          <div className="h-full rounded-full bg-brand-gradient transition-all duration-700" style={{ width: `${progress}%` }} />
        </div>
        <div className="mb-3 flex justify-between text-xs text-ink-500">
          <span>Paid: ₹{l.paidAmount}</span>
          <span>Remaining: ₹{l.remainingAmount}</span>
        </div>

        <button
          onClick={() => setExpanded(isOpen ? null : l.id)}
          className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-ink-900/10 py-2 text-xs font-semibold text-ink-600 hover:bg-ink-900/5 dark:border-white/10 dark:text-ink-300 dark:hover:bg-white/5"
        >
          <ClockIcon className="h-3.5 w-3.5" />
          {isOpen ? "Hide" : "View"} Schedule & Due Dates
          {isOpen ? <ChevronUpIcon className="h-3.5 w-3.5" /> : <ChevronDownIcon className="h-3.5 w-3.5" />}
        </button>

        {isOpen && (
          <div className="mt-3 max-h-72 space-y-1.5 overflow-y-auto pr-1">
            {(!l.payments || l.payments.length === 0) && (
              <p className="py-2 text-center text-xs text-ink-500">No installments found</p>
            )}
            {l.payments?.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between rounded-lg border border-ink-900/10 px-3 py-2 text-xs dark:border-white/10"
              >
                <div>
                  <div className="font-semibold">Week {p.weekNumber}</div>
                  <div className="text-ink-500">
                    {p.status === "PAID" || p.status === "PARTIAL"
                      ? p.paymentDate && `Paid ${new Date(p.paymentDate).toLocaleDateString(undefined, { day: "numeric", month: "short" })}`
                      : p.dueDate && `Due ${new Date(p.dueDate).toLocaleDateString(undefined, { day: "numeric", month: "short" })}`}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`rounded-full px-2 py-0.5 font-semibold ${statusColor[p.status]}`}>{p.status}</span>
                  <span className="font-medium tabular-nums">₹{p.amountPaid || p.emiDue}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <>
      <Navbar title={t("loans")} />
      <main className="space-y-8 p-6">
        <section>
          <h2 className="mb-3 font-display text-lg font-bold">My Loans</h2>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {selfLoans.length === 0 && <p className="text-sm text-ink-500">{t("noDataFound")}</p>}
            {selfLoans.map((l) => renderLoanCard(l, false))}
          </div>
        </section>

        {givenLoans.length > 0 && (
          <section>
            <h2 className="mb-1 font-display text-lg font-bold">Loans Given to Outside Borrowers</h2>
            <p className="mb-3 text-xs text-ink-500">
              Loans given by you to outside borrowers. All installments and due dates are tracked below.
            </p>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {givenLoans.map((l) => renderLoanCard(l, true))}
            </div>
          </section>
        )}
      </main>
    </>
  );
}
