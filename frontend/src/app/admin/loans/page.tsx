"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { PlusIcon, XMarkIcon, ClockIcon, TrashIcon, KeyIcon, UserIcon, ArrowPathIcon } from "@heroicons/react/24/outline";
import { Navbar } from "@/components/Navbar";
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
  durationWeeks: number;
  weeklyEmi: number;
  paidAmount: number;
  remainingAmount: number;
  remainingWeeks: number;
  status: string;
  issueDate: string;
  member: { id: string; name: string; username: string };
  borrower?: { id: string; name: string; username: string; phone?: string } | null;
  payments?: LoanPayment[];
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
  PAID: "bg-success/10 text-success",
  PENDING: "bg-warning/10 text-warning",
  MISSED: "bg-danger/10 text-danger",
  PARTIAL: "bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300",
};

export default function LoansPage() {
  const { t } = useLanguage();

  const [loans, setLoans] = useState<Loan[]>([]);
  const [members, setMembers] = useState<MemberOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [showIssue, setShowIssue] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    memberId: "",
    borrowerType: "SELF" as "SELF" | "OUTSIDE",
    borrowerName: "",
    borrowerPhone: "",
    borrowerUsername: "",
    borrowerPassword: "",
    principalAmount: 10000,
    interestRate: 10,
    durationWeeks: 11,
  });

  const [historyFor, setHistoryFor] = useState<Loan | null>(null);
  const [payments, setPayments] = useState<LoanPayment[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const [newCreds, setNewCreds] = useState<{ username: string; password: string; name?: string } | null>(null);
  const [filterType, setFilterType] = useState<"ALL" | "SELF" | "OUTSIDE">("ALL");

  function load() {
    setLoading(true);
    Promise.all([api.get("/loans"), api.get("/members")])
      .then(([loansRes, membersRes]) => {
        setLoans(loansRes.data.data);
        const payerOptions = membersRes.data.data
          .filter((m: any) => !m.childRelation)
          .map((m: any) => ({ id: m.id, name: m.name, username: m.username }));
        setMembers(payerOptions);
      })
      .catch((err) => {
        toast.error(err?.response?.data?.message || "Failed to load loans");
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, []);

  async function openIssueModal() {
    try {
      const { data } = await api.get("/loans/next-borrower-id");
      const nextId = data.nextId || "LB001";
      setForm({
        memberId: "",
        borrowerType: "SELF",
        borrowerName: "",
        borrowerPhone: "",
        borrowerUsername: nextId,
        borrowerPassword: Math.random().toString(36).slice(-8),
        principalAmount: 10000,
        interestRate: 10,
        durationWeeks: 11,
      });
    } catch {
      setForm({
        memberId: "",
        borrowerType: "SELF",
        borrowerName: "",
        borrowerPhone: "",
        borrowerUsername: "LB001",
        borrowerPassword: "password123",
        principalAmount: 10000,
        interestRate: 10,
        durationWeeks: 11,
      });
    }
    setShowIssue(true);
  }

  async function handleIssueLoan(e: React.FormEvent) {
    e.preventDefault();
    if (!form.memberId) return toast.error("Select a member (payer)");
    if (form.borrowerType === "OUTSIDE" && !form.borrowerName.trim()) {
      return toast.error("Enter outside borrower name");
    }

    setSubmitting(true);
    try {
      const payload: any = {
        memberId: form.memberId,
        borrowerType: form.borrowerType,
        principalAmount: Number(form.principalAmount),
        interestRate: Number(form.interestRate),
        durationWeeks: Number(form.durationWeeks),
      };

      if (form.borrowerType === "OUTSIDE") {
        payload.borrower = {
          name: form.borrowerName.trim(),
          phone: form.borrowerPhone.trim() || undefined,
          username: form.borrowerUsername.trim() || undefined,
          password: form.borrowerPassword.trim() || undefined,
        };
      }

      const { data } = await api.post("/loans", payload);
      toast.success("Loan issued successfully");
      setShowIssue(false);

      if (data.credentials) {
        setNewCreds({
          username: data.credentials.username,
          password: data.credentials.password,
          name: form.borrowerName,
        });
      }

      load();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Could not issue loan");
    } finally {
      setSubmitting(false);
    }
  }

  async function payEmi(loanId: string, emi: number) {
    try {
      await api.post(`/loans/${loanId}/pay-emi`, { amount: emi });
      toast.success("EMI payment recorded");
      load();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Payment failed");
    }
  }

  async function openHistory(loan: Loan) {
    setHistoryFor(loan);
    setHistoryLoading(true);
    try {
      const { data } = await api.get(`/loans/${loan.id}`);
      setPayments(data.data.payments || []);
    } catch {
      toast.error("Could not load loan history");
    } finally {
      setHistoryLoading(false);
    }
  }

  async function handleDeleteLoan(loan: Loan) {
    const targetName = loan.borrowerType === "OUTSIDE" ? `${loan.borrower?.name} (Outside)` : `${loan.member.name} (Self)`;
    if (!confirm(`Are you sure you want to delete this loan of ₹${loan.principalAmount} for ${targetName}? This will remove its EMI payment schedule and history.`)) {
      return;
    }
    try {
      await api.delete(`/loans/${loan.id}`);
      toast.success("Loan deleted successfully");
      load();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Could not delete loan");
    }
  }

  async function handleResetBorrowerPassword(loan: Loan) {
    try {
      const { data } = await api.post(`/loans/${loan.id}/reset-borrower-password`);
      setNewCreds({
        username: data.credentials.username,
        password: data.credentials.password,
        name: loan.borrower?.name,
      });
      toast.success("Password reset successfully");
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Could not reset password");
    }
  }

  const filteredLoans = loans.filter((l) => {
    if (filterType === "SELF") return l.borrowerType !== "OUTSIDE";
    if (filterType === "OUTSIDE") return l.borrowerType === "OUTSIDE";
    return true;
  });

  const totalRepayment = Math.round(form.principalAmount * (1 + (form.interestRate || 0) / 100));
  const weeklyEmi = form.durationWeeks > 0 ? Math.round(totalRepayment / form.durationWeeks) : 0;

  return (
    <>
      <Navbar title={t("loans")} />
      <main className="space-y-6 p-6">
        <section>
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <h2 className="font-display text-lg font-bold">Loans</h2>
              <div className="flex rounded-xl bg-ink-900/5 p-1 text-xs dark:bg-white/5">
                <button
                  onClick={() => setFilterType("ALL")}
                  className={`rounded-lg px-2.5 py-1 font-medium transition ${
                    filterType === "ALL" ? "bg-white text-ink-900 shadow-sm dark:bg-surface-dark-card dark:text-white" : "text-ink-500"
                  }`}
                >
                  All ({loans.length})
                </button>
                <button
                  onClick={() => setFilterType("SELF")}
                  className={`rounded-lg px-2.5 py-1 font-medium transition ${
                    filterType === "SELF" ? "bg-white text-ink-900 shadow-sm dark:bg-surface-dark-card dark:text-white" : "text-ink-500"
                  }`}
                >
                  Self ({loans.filter((l) => l.borrowerType !== "OUTSIDE").length})
                </button>
                <button
                  onClick={() => setFilterType("OUTSIDE")}
                  className={`rounded-lg px-2.5 py-1 font-medium transition ${
                    filterType === "OUTSIDE" ? "bg-white text-ink-900 shadow-sm dark:bg-surface-dark-card dark:text-white" : "text-ink-500"
                  }`}
                >
                  Outside ({loans.filter((l) => l.borrowerType === "OUTSIDE").length})
                </button>
              </div>
            </div>
            <button onClick={openIssueModal} className="btn-primary">
              <PlusIcon className="h-4 w-4" /> Issue Loan
            </button>
          </div>

          <div className="glass-card overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-ink-900/5 text-left text-xs uppercase tracking-wide text-ink-500 dark:bg-white/5 dark:text-ink-300">
                <tr>
                  <th className="px-4 py-3">{t("name")}</th>
                  <th className="px-4 py-3">Loan Target</th>
                  <th className="px-4 py-3">Issued</th>
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
                  Array.from({ length: 3 }).map((_, i) => (
                    <tr key={i} className="border-t border-ink-900/5 dark:border-white/5">
                      <td colSpan={10} className="px-4 py-3">
                        <div className="skeleton h-5 w-full" />
                      </td>
                    </tr>
                  ))}
                {!loading && filteredLoans.length === 0 && (
                  <tr>
                    <td colSpan={10} className="px-4 py-10 text-center text-ink-500">
                      {t("noDataFound")}
                    </td>
                  </tr>
                )}
                {!loading &&
                  filteredLoans.map((l) => (
                    <tr key={l.id} className="border-t border-ink-900/5 hover:bg-ink-900/5 dark:border-white/5 dark:hover:bg-white/5">
                      <td className="px-4 py-3 font-medium">
                        <div>{l.member.name}</div>
                        <div className="font-mono text-xs text-ink-500">{l.member.username}</div>
                      </td>
                      <td className="px-4 py-3">
                        {l.borrowerType === "OUTSIDE" ? (
                          <div className="flex flex-col">
                            <span className="inline-flex items-center gap-1 font-medium text-brand-600 dark:text-brand-400">
                              <UserIcon className="h-3.5 w-3.5" />
                              {l.borrower?.name || "Outside Person"}
                            </span>
                            {l.borrower?.username && (
                              <span className="font-mono text-xs text-ink-500">ID: {l.borrower.username}</span>
                            )}
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-ink-600 dark:text-ink-300">
                            Self
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-ink-500">
                        {new Date(l.issueDate).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}
                      </td>
                      <td className="px-4 py-3 font-semibold">₹{l.principalAmount}</td>
                      <td className="px-4 py-3">{l.interestRate}%</td>
                      <td className="px-4 py-3">₹{l.weeklyEmi}</td>
                      <td className="px-4 py-3 font-semibold">₹{l.remainingAmount}</td>
                      <td className="px-4 py-3">{l.remainingWeeks}</td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusColor[l.status]}`}>{l.status}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => openHistory(l)}
                            className="btn-secondary !px-2.5 !py-1 text-xs"
                            title="View EMI Schedule & Due Dates"
                          >
                            <ClockIcon className="h-3.5 w-3.5" /> History
                          </button>

                          {(l.status === "ACTIVE" || l.status === "RENEWED") && (
                            <button
                              onClick={() => payEmi(l.id, l.weeklyEmi)}
                              className="btn-secondary !px-2.5 !py-1 text-xs"
                              title="Record EMI payment"
                            >
                              Record EMI
                            </button>
                          )}

                          {l.borrowerType === "OUTSIDE" && (
                            <button
                              onClick={() => handleResetBorrowerPassword(l)}
                              title="Reset borrower password"
                              className="rounded-lg p-1.5 text-ink-600 hover:bg-ink-900/10 dark:text-ink-300 dark:hover:bg-white/10"
                            >
                              <KeyIcon className="h-4 w-4" />
                            </button>
                          )}

                          <button
                            onClick={() => handleDeleteLoan(l)}
                            title="Delete loan"
                            className="rounded-lg p-1.5 text-danger hover:bg-danger/10"
                          >
                            <TrashIcon className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>

      {/* Issue Loan Modal (Unified Self / Outside) */}
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
              className="glass-card max-h-[90vh] w-full max-w-md overflow-y-auto p-6"
            >
              <div className="mb-4 flex items-center justify-between">
                <h3 className="font-display text-lg font-bold">Issue Loan</h3>
                <button type="button" onClick={() => setShowIssue(false)}>
                  <XMarkIcon className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-3.5">
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase text-ink-500">Member (Payer)</label>
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
                  <p className="mt-1 text-xs text-ink-500">Only family payers and standalone members can hold or guarantee a loan.</p>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase text-ink-500">Loan For</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, borrowerType: "SELF" })}
                      className={`rounded-xl border px-3 py-2 text-sm font-medium transition ${
                        form.borrowerType === "SELF"
                          ? "border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300 font-semibold"
                          : "border-ink-900/10 text-ink-600 hover:bg-ink-900/5 dark:border-white/10 dark:text-ink-300"
                      }`}
                    >
                      Self (Member)
                    </button>
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, borrowerType: "OUTSIDE" })}
                      className={`rounded-xl border px-3 py-2 text-sm font-medium transition ${
                        form.borrowerType === "OUTSIDE"
                          ? "border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300 font-semibold"
                          : "border-ink-900/10 text-ink-600 hover:bg-ink-900/5 dark:border-white/10 dark:text-ink-300"
                      }`}
                    >
                      Outside (Borrower)
                    </button>
                  </div>
                </div>

                {form.borrowerType === "OUTSIDE" && (
                  <div className="space-y-2.5 rounded-xl border border-brand-500/20 bg-brand-50/40 p-3 dark:bg-brand-900/20">
                    <div className="text-xs font-semibold text-brand-700 dark:text-brand-300">Borrower Details & Login</div>
                    <div>
                      <label className="mb-0.5 block text-xs font-medium text-ink-500">Borrower Full Name *</label>
                      <input
                        required
                        placeholder="e.g. Abujaragafhari Nadaf"
                        className="input-field"
                        value={form.borrowerName}
                        onChange={(e) => setForm({ ...form, borrowerName: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="mb-0.5 block text-xs font-medium text-ink-500">Mobile Number (optional)</label>
                      <input
                        placeholder="e.g. 9876543210"
                        className="input-field"
                        value={form.borrowerPhone}
                        onChange={(e) => setForm({ ...form, borrowerPhone: e.target.value })}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="mb-0.5 block text-xs font-medium text-ink-500">Borrower ID</label>
                        <input
                          required
                          placeholder="e.g. LB001"
                          className="input-field font-mono"
                          value={form.borrowerUsername}
                          onChange={(e) => setForm({ ...form, borrowerUsername: e.target.value })}
                        />
                      </div>
                      <div>
                        <label className="mb-0.5 block text-xs font-medium text-ink-500">Password</label>
                        <input
                          required
                          placeholder="Enter password"
                          className="input-field font-mono"
                          value={form.borrowerPassword}
                          onChange={(e) => setForm({ ...form, borrowerPassword: e.target.value })}
                        />
                      </div>
                    </div>
                    <p className="text-[11px] text-ink-500">
                      The borrower can log in using this ID & Password to view and pay their weekly EMIs.
                    </p>
                  </div>
                )}

                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase text-ink-500">Principal Amount (₹)</label>
                  <input
                    type="number"
                    required
                    min={1}
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
                      min={0}
                      className="input-field"
                      value={form.interestRate}
                      onChange={(e) => setForm({ ...form, interestRate: Number(e.target.value) })}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase text-ink-500">Duration (weeks)</label>
                    <input
                      type="number"
                      min={1}
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

      {/* Loan History Modal with Due Dates (for both Member and Outside Borrower Loans) */}
      <AnimatePresence>
        {historyFor && (
          <motion.div
            className="fixed inset-0 z-20 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setHistoryFor(null)}
          >
            <motion.div
              onClick={(e) => e.stopPropagation()}
              initial={{ opacity: 0, scale: 0.96, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96 }}
              className="glass-card w-full max-w-lg p-6"
            >
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h3 className="font-display text-lg font-bold">
                    Loan History — {historyFor.borrowerType === "OUTSIDE" ? historyFor.borrower?.name : historyFor.member.name}
                  </h3>
                  <div className="text-xs text-ink-500">
                    {historyFor.borrowerType === "OUTSIDE"
                      ? `Guaranteed by: ${historyFor.member.name} (${historyFor.member.username})`
                      : `Member: ${historyFor.member.username}`}
                  </div>
                </div>
                <button onClick={() => setHistoryFor(null)}>
                  <XMarkIcon className="h-5 w-5" />
                </button>
              </div>

              {historyLoading ? (
                <div className="skeleton h-56 rounded-xl" />
              ) : payments.length === 0 ? (
                <div className="py-8 text-center text-sm text-ink-500">No payment schedule found</div>
              ) : (
                <div className="max-h-96 space-y-2 overflow-y-auto pr-1">
                  {payments.map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center justify-between rounded-xl border border-ink-900/10 px-3.5 py-2.5 text-sm dark:border-white/10"
                    >
                      <div>
                        <div className="font-medium">Week {p.weekNumber}</div>
                        <div className="text-xs text-ink-500">
                          {p.status === "PAID" || p.status === "PARTIAL"
                            ? p.paymentDate &&
                              `Paid ${new Date(p.paymentDate).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}`
                            : p.dueDate &&
                              `Due ${new Date(p.dueDate).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}`}
                        </div>
                      </div>
                      <div className="flex items-center gap-2.5">
                        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusColor[p.status]}`}>{p.status}</span>
                        <span className="w-16 text-right font-medium tabular-nums">₹{p.amountPaid || p.emiDue}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Credentials Reveal Modal (New Borrower ID & Password) */}
      <AnimatePresence>
        {newCreds && (
          <motion.div
            className="fixed inset-0 z-30 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} className="glass-card w-full max-w-sm p-6 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-brand-600 dark:bg-brand-900/40 dark:text-brand-300">
                <KeyIcon className="h-6 w-6" />
              </div>
              <h3 className="font-display text-lg font-bold">Borrower Login Created</h3>
              {newCreds.name && <p className="text-xs font-medium text-ink-600 dark:text-ink-300 mt-0.5">For {newCreds.name}</p>}
              <p className="mt-2 text-xs text-ink-500 dark:text-ink-400">
                Share these login details with the borrower so they can log in to view their weekly due dates and pay their loan.
              </p>
              <div className="mt-4 space-y-2 rounded-xl bg-ink-900/5 p-4 text-left font-mono text-sm dark:bg-white/5">
                <div className="flex justify-between items-center">
                  <span className="text-ink-500 text-xs">Username / ID:</span>
                  <span className="font-bold text-brand-600 dark:text-brand-400">{newCreds.username}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-ink-500 text-xs">Password:</span>
                  <span className="font-bold">{newCreds.password}</span>
                </div>
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
