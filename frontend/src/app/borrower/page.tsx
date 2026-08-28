"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { CheckCircleIcon, ClockIcon } from "@heroicons/react/24/outline";
import { useAuth } from "@/contexts/AuthContext";
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
  durationWeeks: number;
  paidAmount: number;
  remainingAmount: number;
  remainingWeeks: number;
  status: "ACTIVE" | "COMPLETED" | "RENEWED" | "DEFAULTED";
  issueDate: string;
  member: { name: string; username: string; phone?: string };
  payments: LoanPayment[];
}

const statusColor: Record<string, string> = {
  PAID: "bg-success/10 text-success",
  PENDING: "bg-warning/10 text-warning",
  MISSED: "bg-danger/10 text-danger",
  PARTIAL: "bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300",
  ACTIVE: "bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300",
  COMPLETED: "bg-success/10 text-success",
};

export default function BorrowerDashboard() {
  const { user } = useAuth();
  const [loans, setLoans] = useState<Loan[]>([]);
  const [loading, setLoading] = useState(true);
  const [payAmount, setPayAmount] = useState<Record<string, number>>({});
  const [submitting, setSubmitting] = useState<string | null>(null);

  function load() {
    setLoading(true);
    api
      .get("/loans/me")
      .then((res) => setLoans(res.data.data))
      .catch(() => {
        // Fallback to payer-loans if any
        api.get("/payer-loans/me").then((res) => {
          const mapped = (res.data.data || []).map((l: any) => ({
            ...l,
            member: l.payer,
            payments: (l.payments || []).map((p: any, idx: number) => ({
              id: p.id,
              weekNumber: idx + 1,
              emiDue: p.amount,
              amountPaid: p.amount,
              status: "PAID",
              paymentDate: p.paymentDate,
              dueDate: p.paymentDate,
            })),
          }));
          setLoans(mapped);
        });
      })
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function handlePay(loanId: string, defaultEmi?: number) {
    const amount = payAmount[loanId] || defaultEmi;
    if (!amount || amount <= 0) return toast.error("Enter an amount");
    setSubmitting(loanId);
    try {
      await api.post(`/loans/${loanId}/pay-emi`, { amount });
      toast.success("Payment recorded successfully");
      setPayAmount((prev) => ({ ...prev, [loanId]: 0 }));
      load();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Payment failed");
    } finally {
      setSubmitting(null);
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="skeleton h-40 rounded-xl2" />
      </div>
    );
  }

  if (loans.length === 0) {
    return (
      <div className="glass-card p-10 text-center text-ink-500">
        No loan found on your account yet.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-xl font-bold">Welcome, {user?.name}</h1>
          <div className="text-xs text-ink-500">Borrower ID: {user?.username}</div>
        </div>
      </div>

      {loans.map((loan) => {
        const total = Number(loan.principalAmount) * (1 + (loan.interestRate || 0) / 100);
        const progress = Math.min(100, Math.round((Number(loan.paidAmount) / (total || Number(loan.principalAmount))) * 100));

        return (
          <div key={loan.id} className="glass-card p-6">
            <div className="mb-2 flex items-center justify-between">
              <div>
                <span className="font-display text-2xl font-bold">₹{loan.principalAmount}</span>
                {loan.interestRate > 0 && (
                  <span className="ml-2 text-xs font-semibold text-ink-500">({loan.interestRate}% interest)</span>
                )}
              </div>
              {loan.status === "COMPLETED" ? (
                <span className="flex items-center gap-1 rounded-full bg-success/10 px-3 py-1 text-xs font-semibold text-success">
                  <CheckCircleIcon className="h-4 w-4" /> Completed
                </span>
              ) : (
                <span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700 dark:bg-brand-900/40 dark:text-brand-300">
                  {loan.status}
                </span>
              )}
            </div>

            <p className="mb-4 text-xs text-ink-500">
              Guaranteed by {loan.member?.name} · Issued{" "}
              {new Date(loan.issueDate).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}
              {loan.weeklyEmi ? ` · Weekly EMI: ₹${loan.weeklyEmi}` : ""}
            </p>

            <div className="mb-1 h-2.5 w-full overflow-hidden rounded-full bg-ink-900/5 dark:bg-white/10">
              <div className="h-full rounded-full bg-brand-gradient transition-all duration-700" style={{ width: `${progress}%` }} />
            </div>
            <div className="mb-5 flex justify-between text-xs font-medium text-ink-500">
              <span>Paid: ₹{loan.paidAmount}</span>
              <span>Remaining: ₹{loan.remainingAmount}</span>
            </div>

            {(loan.status === "ACTIVE" || loan.status === "RENEWED") && (
              <div className="mb-6 flex gap-2 rounded-xl bg-ink-900/5 p-3 dark:bg-white/5">
                <input
                  type="number"
                  placeholder={`Amount (EMI ₹${loan.weeklyEmi || loan.remainingAmount})`}
                  className="input-field"
                  value={payAmount[loan.id] || ""}
                  onChange={(e) => setPayAmount((prev) => ({ ...prev, [loan.id]: Number(e.target.value) }))}
                />
                <button
                  onClick={() => handlePay(loan.id, loan.weeklyEmi)}
                  disabled={submitting === loan.id}
                  className="btn-primary shrink-0 text-xs"
                >
                  {submitting === loan.id ? "Processing..." : `Pay ₹${payAmount[loan.id] || loan.weeklyEmi || "EMI"}`}
                </button>
              </div>
            )}

            <div className="mb-3 flex items-center justify-between">
              <h3 className="flex items-center gap-1.5 text-sm font-semibold">
                <ClockIcon className="h-4 w-4 text-ink-500" />
                EMI Schedule & Due Dates
              </h3>
            </div>

            <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
              {(!loan.payments || loan.payments.length === 0) && (
                <p className="text-xs text-ink-500">No installments recorded yet.</p>
              )}
              {loan.payments?.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between rounded-xl border border-ink-900/10 px-3.5 py-2.5 text-xs dark:border-white/10"
                >
                  <div>
                    <div className="font-semibold text-ink-900 dark:text-white">Week {p.weekNumber}</div>
                    <div className="text-ink-500">
                      {p.status === "PAID" || p.status === "PARTIAL"
                        ? p.paymentDate &&
                          `Paid ${new Date(p.paymentDate).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}`
                        : p.dueDate &&
                          `Due ${new Date(p.dueDate).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}`}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`rounded-full px-2.5 py-0.5 font-semibold ${statusColor[p.status]}`}>{p.status}</span>
                    <span className="w-16 text-right font-medium tabular-nums">₹{p.amountPaid || p.emiDue}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
