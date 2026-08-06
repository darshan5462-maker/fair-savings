"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { PlusIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { Navbar } from "@/components/Navbar";
import { useLanguage } from "@/i18n/LanguageContext";
import { api } from "@/lib/api";

interface Loan {
  id: string;
  principalAmount: number;
  interestRate: number;
  weeklyEmi: number;
  remainingAmount: number;
  remainingWeeks: number;
  status: string;
  member: { name: string; username: string };
}

interface MemberOption {
  id: string;
  name: string;
  username: string;
}

const statusColor: Record<string, string> = {
  ACTIVE: "bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300",
  RENEWED: "bg-warning/10 text-warning",
  COMPLETED: "bg-success/10 text-success",
  DEFAULTED: "bg-danger/10 text-danger",
};

export default function LoansPage() {
  const { t } = useLanguage();
  const [loans, setLoans] = useState<Loan[]>([]);
  const [members, setMembers] = useState<MemberOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [showIssue, setShowIssue] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ memberId: "", principalAmount: 10000, interestRate: 10, durationWeeks: 11 });

  function load() {
    setLoading(true);
    Promise.all([api.get("/loans"), api.get("/members")])
      .then(([loansRes, membersRes]) => {
        setLoans(loansRes.data.data);
        setMembers(membersRes.data.data.map((m: any) => ({ id: m.id, name: m.name, username: m.username })));
      })
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function payEmi(loanId: string, emi: number) {
    try {
      await api.post(`/loans/${loanId}/pay-emi`, { amount: emi });
      toast.success("EMI recorded");
      load();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Payment failed");
    }
  }

  async function handleIssueLoan(e: React.FormEvent) {
    e.preventDefault();
    if (!form.memberId) return toast.error("Select a member");
    setSubmitting(true);
    try {
      await api.post("/loans", form);
      toast.success("Loan issued");
      setShowIssue(false);
      setForm({ memberId: "", principalAmount: 10000, interestRate: 10, durationWeeks: 11 });
      load();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Could not issue loan");
    } finally {
      setSubmitting(false);
    }
  }

  const totalRepayment = Math.round(form.principalAmount * (1 + form.interestRate / 100));
  const weeklyEmi = form.durationWeeks > 0 ? Math.round(totalRepayment / form.durationWeeks) : 0;

  return (
    <>
      <Navbar title={t("loans")} />
      <main className="p-6">
        <div className="mb-4 flex justify-end">
          <button onClick={() => setShowIssue(true)} className="btn-primary">
            <PlusIcon className="h-4 w-4" /> Issue Loan
          </button>
        </div>

        <div className="glass-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-ink-900/5 text-left text-xs uppercase tracking-wide text-ink-500 dark:bg-white/5 dark:text-ink-300">
              <tr>
                <th className="px-4 py-3">{t("name")}</th>
                <th className="px-4 py-3">Principal</th>
                <th className="px-4 py-3">Interest</th>
                <th className="px-4 py-3">Weekly EMI</th>
                <th className="px-4 py-3">Remaining</th>
                <th className="px-4 py-3">Weeks Left</th>
                <th className="px-4 py-3">{t("status")}</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {loading &&
                Array.from({ length: 4 }).map((_, i) => (
                  <tr key={i} className="border-t border-ink-900/5 dark:border-white/5">
                    <td colSpan={8} className="px-4 py-3">
                      <div className="skeleton h-5 w-full" />
                    </td>
                  </tr>
                ))}
              {!loading && loans.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-ink-500">
                    {t("noDataFound")}
                  </td>
                </tr>
              )}
              {!loading &&
                loans.map((l) => (
                  <tr key={l.id} className="border-t border-ink-900/5 dark:border-white/5">
                    <td className="px-4 py-3 font-medium">
                      {l.member.name}
                      <div className="font-mono text-xs text-ink-500">{l.member.username}</div>
                    </td>
                    <td className="px-4 py-3">₹{l.principalAmount}</td>
                    <td className="px-4 py-3">{l.interestRate}%</td>
                    <td className="px-4 py-3">₹{l.weeklyEmi}</td>
                    <td className="px-4 py-3">₹{l.remainingAmount}</td>
                    <td className="px-4 py-3">{l.remainingWeeks}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusColor[l.status]}`}>{l.status}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {(l.status === "ACTIVE" || l.status === "RENEWED") && (
                        <button onClick={() => payEmi(l.id, l.weeklyEmi)} className="btn-secondary !px-3 !py-1.5 text-xs">
                          Record EMI
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </main>

      <AnimatePresence>
        {showIssue && (
          <motion.div
            className="fixed inset-0 z-20 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowIssue(false)}
          >
            <motion.form
              onClick={(e) => e.stopPropagation()}
              onSubmit={handleIssueLoan}
              initial={{ opacity: 0, scale: 0.96, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96 }}
              className="glass-card w-full max-w-md p-6"
            >
              <div className="mb-4 flex items-center justify-between">
                <h3 className="font-display text-lg font-bold">Issue Loan</h3>
                <button type="button" onClick={() => setShowIssue(false)}>
                  <XMarkIcon className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase text-ink-500">Member</label>
                  <select
                    required
                    className="input-field"
                    value={form.memberId}
                    onChange={(e) => setForm({ ...form, memberId: e.target.value })}
                  >
                    <option value="">Select a member</option>
                    {members.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} ({m.username})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase text-ink-500">Principal Amount (₹)</label>
                  <input
                    type="number"
                    required
                    className="input-field"
                    value={form.principalAmount}
                    onChange={(e) => setForm({ ...form, principalAmount: Number(e.target.value) })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase text-ink-500">Interest %</label>
                    <input
                      type="number"
                      className="input-field"
                      value={form.interestRate}
                      onChange={(e) => setForm({ ...form, interestRate: Number(e.target.value) })}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase text-ink-500">Duration (weeks)</label>
                    <input
                      type="number"
                      className="input-field"
                      value={form.durationWeeks}
                      onChange={(e) => setForm({ ...form, durationWeeks: Number(e.target.value) })}
                    />
                  </div>
                </div>
              </div>

              <div className="mt-4 space-y-1 rounded-xl bg-ink-900/5 p-4 text-sm dark:bg-white/5">
                <div className="flex justify-between">
                  <span className="text-ink-500">Total Repayment</span>
                  <span className="font-semibold">₹{totalRepayment}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-ink-500">Weekly EMI</span>
                  <span className="font-semibold">₹{weeklyEmi}</span>
                </div>
              </div>

              <button type="submit" disabled={submitting} className="btn-primary mt-5 w-full">
                {submitting ? t("loading") : "Issue Loan"}
              </button>
            </motion.form>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
