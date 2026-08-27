"use client";

import { useEffect, useState } from "react";
import { ChevronDownIcon, ChevronUpIcon, UserIcon } from "@heroicons/react/24/outline";
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
  principalAmount: number;
  interestRate: number;
  weeklyEmi: number;
  paidAmount: number;
  remainingAmount: number;
  remainingWeeks: number;
  status: string;
  issueDate: string;
  payments: LoanPayment[];
}

interface GivenLoanPayment {
  id: string;
  amount: number;
  paymentDate: string;
}

interface GivenLoan {
  id: string;
  borrowerType: "SELF" | "OUTSIDE";
  principalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  status: "ACTIVE" | "COMPLETED";
  issueDate: string;
  borrower?: { name: string; username: string } | null;
  payments: GivenLoanPayment[];
}

const statusColor: Record<string, string> = {
  PAID: "bg-success/10 text-success",
  PENDING: "bg-warning/10 text-warning",
  MISSED: "bg-danger/10 text-danger",
  PARTIAL: "bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300",
  ACTIVE: "bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300",
  COMPLETED: "bg-success/10 text-success",
};

export default function MemberLoansPage() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [loans, setLoans] = useState<Loan[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);

  const [givenLoans, setGivenLoans] = useState<GivenLoan[]>([]);
  const [givenExpanded, setGivenExpanded] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    api.get(`/loans/member/${user.id}`).then((res) => setLoans(res.data.data));
    api.get(`/payer-loans/payer/${user.id}`).then((res) => setGivenLoans(res.data.data));
  }, [user]);

  return (
    <>
      <Navbar title={t("loans")} />
      <main className="space-y-8 p-6">
        <section>
          <h2 className="mb-3 font-display text-lg font-bold">My Loans</h2>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {loans.length === 0 && <p className="text-sm text-ink-500">{t("noDataFound")}</p>}
            {loans.map((l) => {
              const isOpen = expanded === l.id;
              return (
                <div key={l.id} className="glass-card p-5">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="font-display text-lg font-bold">₹{l.principalAmount}</span>
                    <span className="rounded-full bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-700 dark:bg-brand-900/40 dark:text-brand-300">
                      {l.status}
                    </span>
                  </div>
                  <div className="space-y-1 text-sm text-ink-500 dark:text-ink-300">
                    <div>Issued: {new Date(l.issueDate).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}</div>
                    <div>Interest: {l.interestRate}%</div>
                    <div>Weekly EMI: ₹{l.weeklyEmi}</div>
                    <div>Paid: ₹{l.paidAmount}</div>
                    <div>Remaining: ₹{l.remainingAmount}</div>
                    <div>Weeks left: {l.remainingWeeks}</div>
                  </div>

                  <button
                    onClick={() => setExpanded(isOpen ? null : l.id)}
                    className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl border border-ink-900/10 py-2 text-xs font-semibold text-ink-500 hover:bg-ink-900/5 dark:border-white/10 dark:hover:bg-white/5"
                  >
                    {isOpen ? "Hide" : "View"} Payment History
                    {isOpen ? <ChevronUpIcon className="h-3.5 w-3.5" /> : <ChevronDownIcon className="h-3.5 w-3.5" />}
                  </button>

                  {isOpen && (
                    <div className="mt-3 max-h-72 space-y-1.5 overflow-y-auto pr-1">
                      {l.payments.map((p) => (
                        <div
                          key={p.id}
                          className="flex items-center justify-between rounded-lg border border-ink-900/10 px-3 py-2 text-xs dark:border-white/10"
                        >
                          <div>
                            <div className="font-medium">Week {p.weekNumber}</div>
                            <div className="text-ink-500">
                              {p.status === "PAID" || p.status === "PARTIAL"
                                ? p.paymentDate && `Paid ${new Date(p.paymentDate).toLocaleDateString(undefined, { day: "numeric", month: "short" })}`
                                : `Due ${new Date(p.dueDate).toLocaleDateString(undefined, { day: "numeric", month: "short" })}`}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`rounded-full px-2 py-0.5 font-semibold ${statusColor[p.status]}`}>{p.status}</span>
                            <span className="tabular-nums">₹{p.amountPaid || p.emiDue}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* Loans You've Given - read-only. Only the admin can create loans or
            record payments here; a payer can only view their own data. */}
        <section>
          <h2 className="mb-1 font-display text-lg font-bold">Loans You've Given</h2>
          <p className="mb-3 text-xs text-ink-500">
            Managed by the admin — you can view these, but adding a loan or recording a payment happens on the admin side.
          </p>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {givenLoans.length === 0 && <p className="text-sm text-ink-500">{t("noDataFound")}</p>}
            {givenLoans.map((l) => {
              const isOpen = givenExpanded === l.id;
              const borrowerName = l.borrowerType === "SELF" ? "Self" : l.borrower?.name ?? "Unknown";
              const progress = Math.min(100, Math.round((Number(l.paidAmount) / Number(l.principalAmount)) * 100));
              return (
                <div key={l.id} className="glass-card p-5">
                  <div className="mb-1 flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <UserIcon className="h-4 w-4 text-ink-500" />
                      <span className="font-medium">{borrowerName}</span>
                    </div>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusColor[l.status]}`}>{l.status}</span>
                  </div>
                  <div className="mb-3 font-display text-lg font-bold">₹{l.principalAmount}</div>

                  <div className="mb-1 h-2 w-full overflow-hidden rounded-full bg-ink-900/5 dark:bg-white/10">
                    <div className="h-full rounded-full bg-brand-gradient transition-all duration-700" style={{ width: `${progress}%` }} />
                  </div>
                  <div className="mb-3 flex justify-between text-sm text-ink-500">
                    <span>Paid ₹{l.paidAmount}</span>
                    <span>Remaining ₹{l.remainingAmount}</span>
                  </div>

                  <button
                    onClick={() => setGivenExpanded(isOpen ? null : l.id)}
                    className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-ink-900/10 py-2 text-xs font-semibold text-ink-500 hover:bg-ink-900/5 dark:border-white/10 dark:hover:bg-white/5"
                  >
                    {isOpen ? "Hide" : "View"} Payment History
                    {isOpen ? <ChevronUpIcon className="h-3.5 w-3.5" /> : <ChevronDownIcon className="h-3.5 w-3.5" />}
                  </button>

                  {isOpen && (
                    <div className="mt-3 max-h-56 space-y-1.5 overflow-y-auto pr-1">
                      {l.payments.length === 0 && <p className="text-xs text-ink-500">No payments yet.</p>}
                      {l.payments.map((p) => (
                        <div key={p.id} className="flex items-center justify-between rounded-lg border border-ink-900/10 px-3 py-1.5 text-xs dark:border-white/10">
                          <span className="text-ink-500">
                            {new Date(p.paymentDate).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}
                          </span>
                          <span className="font-semibold tabular-nums">₹{p.amount}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      </main>
    </>
  );
}
