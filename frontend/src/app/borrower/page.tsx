"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { CheckCircleIcon } from "@heroicons/react/24/outline";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";

interface Payment {
  id: string;
  amount: number;
  paymentDate: string;
  recordedBy?: string;
}

interface Loan {
  id: string;
  principalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  status: "ACTIVE" | "COMPLETED";
  issueDate: string;
  payer: { name: string; username: string; phone?: string };
  payments: Payment[];
}

export default function BorrowerDashboard() {
  const { user } = useAuth();
  const [loans, setLoans] = useState<Loan[]>([]);
  const [loading, setLoading] = useState(true);
  const [payAmount, setPayAmount] = useState<Record<string, number>>({});
  const [submitting, setSubmitting] = useState<string | null>(null);

  function load() {
    setLoading(true);
    api
      .get("/payer-loans/me")
      .then((res) => setLoans(res.data.data))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function handlePay(loanId: string) {
    const amount = payAmount[loanId];
    if (!amount || amount <= 0) return toast.error("Enter an amount");
    setSubmitting(loanId);
    try {
      await api.post(`/payer-loans/${loanId}/pay`, { amount });
      toast.success("Payment recorded");
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
      <h1 className="font-display text-xl font-bold">Welcome, {user?.name}</h1>

      {loans.map((loan) => {
        const progress = Math.min(100, Math.round((Number(loan.paidAmount) / Number(loan.principalAmount)) * 100));
        return (
          <div key={loan.id} className="glass-card p-6">
            <div className="mb-1 flex items-center justify-between">
              <span className="font-display text-2xl font-bold">₹{loan.principalAmount}</span>
              {loan.status === "COMPLETED" ? (
                <span className="flex items-center gap-1 rounded-full bg-success/10 px-3 py-1 text-xs font-semibold text-success">
                  <CheckCircleIcon className="h-4 w-4" /> Completed
                </span>
              ) : (
                <span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700 dark:bg-brand-900/40 dark:text-brand-300">
                  Active
                </span>
              )}
            </div>
            <p className="mb-4 text-sm text-ink-500">
              Loan from {loan.payer.name} · issued{" "}
              {new Date(loan.issueDate).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}
            </p>

            <div className="mb-1 h-2.5 w-full overflow-hidden rounded-full bg-ink-900/5 dark:bg-white/10">
              <div className="h-full rounded-full bg-brand-gradient transition-all duration-700" style={{ width: `${progress}%` }} />
            </div>
            <div className="mb-5 flex justify-between text-sm text-ink-500">
              <span>Paid ₹{loan.paidAmount}</span>
              <span>Remaining ₹{loan.remainingAmount}</span>
            </div>

            {loan.status === "ACTIVE" && (
              <div className="mb-5 flex gap-2">
                <input
                  type="number"
                  placeholder="Amount"
                  className="input-field"
                  value={payAmount[loan.id] || ""}
                  onChange={(e) => setPayAmount((prev) => ({ ...prev, [loan.id]: Number(e.target.value) }))}
                />
                <button
                  onClick={() => handlePay(loan.id)}
                  disabled={submitting === loan.id}
                  className="btn-primary shrink-0"
                >
                  {submitting === loan.id ? "..." : "Pay"}
                </button>
              </div>
            )}

            <h3 className="mb-2 text-sm font-semibold">Payment History</h3>
            <div className="max-h-56 space-y-1.5 overflow-y-auto pr-1">
              {loan.payments.length === 0 && <p className="text-sm text-ink-500">No payments yet.</p>}
              {loan.payments.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between rounded-lg border border-ink-900/10 px-3 py-2 text-sm dark:border-white/10"
                >
                  <span className="text-ink-500">
                    {new Date(p.paymentDate).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}
                  </span>
                  <span className="font-semibold tabular-nums">₹{p.amount}</span>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
