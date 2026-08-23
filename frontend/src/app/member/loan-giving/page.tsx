"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { PlusIcon, XMarkIcon, ChevronDownIcon, ChevronUpIcon, UserIcon } from "@heroicons/react/24/outline";
import { Navbar } from "@/components/Navbar";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/i18n/LanguageContext";
import { api } from "@/lib/api";

interface Payment {
  id: string;
  amount: number;
  paymentDate: string;
}

interface Loan {
  id: string;
  borrowerType: "SELF" | "OUTSIDE";
  principalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  status: "ACTIVE" | "COMPLETED";
  issueDate: string;
  borrower?: { name: string; username: string; phone?: string } | null;
  payments: Payment[];
}

const statusColor: Record<string, string> = {
  ACTIVE: "bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300",
  COMPLETED: "bg-success/10 text-success",
};

export default function LoanGivingPage() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [loans, setLoans] = useState<Loan[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  const [showAdd, setShowAdd] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ borrowerType: "SELF" as "SELF" | "OUTSIDE", principalAmount: 1000, name: "", phone: "" });

  const [payTarget, setPayTarget] = useState<Loan | null>(null);
  const [payAmount, setPayAmount] = useState(0);
  const [newCreds, setNewCreds] = useState<{ username: string; password: string } | null>(null);

  function load() {
    if (!user) return;
    setLoading(true);
    api
      .get(`/payer-loans/payer/${user.id}`)
      .then((res) => setLoans(res.data.data))
      .finally(() => setLoading(false));
  }

  useEffect(load, [user]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setSubmitting(true);
    try {
      const payload: any = { payerId: user.id, borrowerType: form.borrowerType, principalAmount: form.principalAmount };
      if (form.borrowerType === "OUTSIDE") payload.borrower = { name: form.name, phone: form.phone };

      const { data } = await api.post("/payer-loans", payload);
      if (data.credentials) setNewCreds(data.credentials);
      toast.success("Loan created");
      setShowAdd(false);
      setForm({ borrowerType: "SELF", principalAmount: 1000, name: "", phone: "" });
      load();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Could not create loan");
    } finally {
      setSubmitting(false);
    }
  }

  async function handlePay(e: React.FormEvent) {
    e.preventDefault();
    if (!payTarget) return;
    if (!payAmount || payAmount <= 0) return toast.error("Enter an amount");
    setSubmitting(true);
    try {
      await api.post(`/payer-loans/${payTarget.id}/pay`, { amount: payAmount });
      toast.success("Payment recorded");
      setPayTarget(null);
      setPayAmount(0);
      load();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Payment failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <Navbar title={t("loanGiving")} />
      <main className="space-y-4 p-6">
        <div className="flex justify-end">
          <button onClick={() => setShowAdd(true)} className="btn-primary">
            <PlusIcon className="h-4 w-4" /> Add Loan
          </button>
        </div>

        {loading && <div className="skeleton h-32 rounded-xl2" />}

        {!loading && loans.length === 0 && (
          <div className="glass-card p-10 text-center text-ink-500">{t("noDataFound")}</div>
        )}

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {loans.map((loan) => {
            const isOpen = expanded === loan.id;
            const borrowerName = loan.borrowerType === "SELF" ? "Self" : loan.borrower?.name ?? "Unknown";
            return (
              <div key={loan.id} className="glass-card p-5">
                <div className="mb-1 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <UserIcon className="h-4 w-4 text-ink-500" />
                    <span className="font-medium">{borrowerName}</span>
                    {loan.borrower?.username && (
                      <span className="font-mono text-xs text-ink-500">{loan.borrower.username}</span>
                    )}
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusColor[loan.status]}`}>{loan.status}</span>
                </div>

                <div className="mb-3 font-display text-xl font-bold">₹{loan.principalAmount}</div>

                <div className="mb-1 h-2 w-full overflow-hidden rounded-full bg-ink-900/5 dark:bg-white/10">
                  <div
                    className="h-full rounded-full bg-brand-gradient transition-all duration-700"
                    style={{ width: `${Math.min(100, Math.round((Number(loan.paidAmount) / Number(loan.principalAmount)) * 100))}%` }}
                  />
                </div>
                <div className="mb-4 flex justify-between text-sm text-ink-500">
                  <span>Paid ₹{loan.paidAmount}</span>
                  <span>Remaining ₹{loan.remainingAmount}</span>
                </div>

                <div className="flex gap-2">
                  {loan.status === "ACTIVE" && (
                    <button
                      onClick={() => {
                        setPayTarget(loan);
                        setPayAmount(0);
                      }}
                      className="btn-secondary flex-1 !py-1.5 text-xs"
                    >
                      Record Payment
                    </button>
                  )}
                  <button
                    onClick={() => setExpanded(isOpen ? null : loan.id)}
                    className="flex flex-1 items-center justify-center gap-1 rounded-full border border-ink-900/10 py-1.5 text-xs font-semibold text-ink-500 hover:bg-ink-900/5 dark:border-white/10 dark:hover:bg-white/5"
                  >
                    History {isOpen ? <ChevronUpIcon className="h-3.5 w-3.5" /> : <ChevronDownIcon className="h-3.5 w-3.5" />}
                  </button>
                </div>

                {isOpen && (
                  <div className="mt-3 max-h-48 space-y-1.5 overflow-y-auto pr-1">
                    {loan.payments.length === 0 && <p className="text-xs text-ink-500">No payments yet.</p>}
                    {loan.payments.map((p) => (
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
      </main>

      {/* Add Loan modal */}
      <AnimatePresence>
        {showAdd && (
          <motion.div
            className="fixed inset-0 z-20 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowAdd(false)}
          >
            <motion.form
              onClick={(e) => e.stopPropagation()}
              onSubmit={handleAdd}
              initial={{ opacity: 0, scale: 0.96, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96 }}
              className="glass-card w-full max-w-md p-6"
            >
              <div className="mb-4 flex items-center justify-between">
                <h3 className="font-display text-lg font-bold">Add Loan</h3>
                <button type="button" onClick={() => setShowAdd(false)}>
                  <XMarkIcon className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase text-ink-500">Loan Given To</label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, borrowerType: "SELF" })}
                      className={`flex-1 rounded-xl border px-3 py-2 text-sm font-medium ${
                        form.borrowerType === "SELF"
                          ? "border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300"
                          : "border-ink-900/10 dark:border-white/10"
                      }`}
                    >
                      Self
                    </button>
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, borrowerType: "OUTSIDE" })}
                      className={`flex-1 rounded-xl border px-3 py-2 text-sm font-medium ${
                        form.borrowerType === "OUTSIDE"
                          ? "border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300"
                          : "border-ink-900/10 dark:border-white/10"
                      }`}
                    >
                      Outside Person
                    </button>
                  </div>
                </div>

                {form.borrowerType === "OUTSIDE" && (
                  <>
                    <input
                      required
                      placeholder="Borrower name"
                      className="input-field"
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                    />
                    <input
                      placeholder="Mobile number"
                      className="input-field"
                      value={form.phone}
                      onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    />
                  </>
                )}

                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase text-ink-500">Loan Amount (₹)</label>
                  <input
                    type="number"
                    required
                    className="input-field"
                    value={form.principalAmount}
                    onChange={(e) => setForm({ ...form, principalAmount: Number(e.target.value) })}
                  />
                </div>
              </div>

              <button type="submit" disabled={submitting} className="btn-primary mt-5 w-full">
                {submitting ? t("loading") : t("save")}
              </button>
            </motion.form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Record Payment modal */}
      <AnimatePresence>
        {payTarget && (
          <motion.div
            className="fixed inset-0 z-20 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setPayTarget(null)}
          >
            <motion.form
              onClick={(e) => e.stopPropagation()}
              onSubmit={handlePay}
              initial={{ opacity: 0, scale: 0.96, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96 }}
              className="glass-card w-full max-w-sm p-6"
            >
              <div className="mb-4 flex items-center justify-between">
                <h3 className="font-display text-lg font-bold">Record Payment</h3>
                <button type="button" onClick={() => setPayTarget(null)}>
                  <XMarkIcon className="h-5 w-5" />
                </button>
              </div>
              <p className="mb-3 text-sm text-ink-500">
                From {payTarget.borrowerType === "SELF" ? "yourself" : payTarget.borrower?.name} · remaining ₹{payTarget.remainingAmount}
              </p>
              <input
                type="number"
                autoFocus
                required
                placeholder="Amount"
                className="input-field"
                value={payAmount || ""}
                onChange={(e) => setPayAmount(Number(e.target.value))}
              />
              <button type="submit" disabled={submitting} className="btn-primary mt-4 w-full">
                {submitting ? t("loading") : "Save Payment"}
              </button>
            </motion.form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Credentials reveal modal */}
      <AnimatePresence>
        {newCreds && (
          <motion.div
            className="fixed inset-0 z-30 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} className="glass-card w-full max-w-sm p-6 text-center">
              <h3 className="font-display text-lg font-bold">Borrower Login Created</h3>
              <p className="mt-1 text-sm text-ink-500 dark:text-ink-300">
                Share these with the borrower so they can log in to view and pay their loan. Shown only once.
              </p>
              <div className="mt-4 space-y-2 rounded-xl bg-ink-900/5 p-4 font-mono text-sm dark:bg-white/5">
                <div>Username: <b>{newCreds.username}</b></div>
                <div>Password: <b>{newCreds.password}</b></div>
              </div>
              <button onClick={() => setNewCreds(null)} className="btn-primary mt-5 w-full">
                {t("close")}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
