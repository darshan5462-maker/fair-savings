"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { PlusIcon, XMarkIcon, ClockIcon, TrashIcon, KeyIcon, UserIcon } from "@heroicons/react/24/outline";
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
  issueDate: string;
  member: { name: string; username: string };
}

interface LoanPayment {
  id: string;
  weekNumber: number;
  emiDue: number;
  amountPaid: number;
  status: string;
  paymentDate: string | null;
  dueDate: string;
}

interface MemberOption {
  id: string;
  name: string;
  username: string;
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
  payer: { id: string; name: string; username: string };
  borrower?: { name: string; username: string; phone?: string } | null;
  payments: GivenLoanPayment[];
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

  // --- Interest loans (existing feature, unchanged) ---
  const [loans, setLoans] = useState<Loan[]>([]);
  const [members, setMembers] = useState<MemberOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [showIssue, setShowIssue] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ memberId: "", principalAmount: 10000, interestRate: 10, durationWeeks: 11 });

  const [historyFor, setHistoryFor] = useState<Loan | null>(null);
  const [payments, setPayments] = useState<LoanPayment[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // --- Loan Giving (peer-to-peer, self/outside) ---
  const [givenLoans, setGivenLoans] = useState<GivenLoan[]>([]);
  const [givenLoading, setGivenLoading] = useState(true);
  const [showGiveLoan, setShowGiveLoan] = useState(false);
  const [givenSubmitting, setGivenSubmitting] = useState(false);
  const [givenForm, setGivenForm] = useState({
    payerId: "",
    borrowerType: "SELF" as "SELF" | "OUTSIDE",
    principalAmount: 1000,
    name: "",
    phone: "",
  });
  const [givenHistoryFor, setGivenHistoryFor] = useState<GivenLoan | null>(null);
  const [payTarget, setPayTarget] = useState<GivenLoan | null>(null);
  const [payAmount, setPayAmount] = useState(0);
  const [newCreds, setNewCreds] = useState<{ username: string; password: string } | null>(null);

  function load() {
    setLoading(true);
    Promise.all([api.get("/loans"), api.get("/members")])
      .then(([loansRes, membersRes]) => {
        setLoans(loansRes.data.data);
        // Loans can only be issued to payers/standalone members, not a member
        // who is themselves someone else's linked child.
        const payerOptions = membersRes.data.data
          .filter((m: any) => !m.childRelation)
          .map((m: any) => ({ id: m.id, name: m.name, username: m.username }));
        setMembers(payerOptions);
      })
      .finally(() => setLoading(false));
  }

  function loadGivenLoans() {
    setGivenLoading(true);
    api
      .get("/payer-loans")
      .then((res) => setGivenLoans(res.data.data))
      .finally(() => setGivenLoading(false));
  }

  useEffect(() => {
    load();
    loadGivenLoans();
  }, []);

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

  async function openHistory(loan: Loan) {
    setHistoryFor(loan);
    setHistoryLoading(true);
    try {
      const { data } = await api.get(`/loans/${loan.id}`);
      setPayments(data.data.payments);
    } catch {
      toast.error("Could not load loan history");
    } finally {
      setHistoryLoading(false);
    }
  }

  async function handleGiveLoan(e: React.FormEvent) {
    e.preventDefault();
    if (!givenForm.payerId) return toast.error("Select a payer");
    setGivenSubmitting(true);
    try {
      const payload: any = {
        payerId: givenForm.payerId,
        borrowerType: givenForm.borrowerType,
        principalAmount: givenForm.principalAmount,
      };
      if (givenForm.borrowerType === "OUTSIDE") payload.borrower = { name: givenForm.name, phone: givenForm.phone };

      const { data } = await api.post("/payer-loans", payload);
      if (data.credentials) setNewCreds(data.credentials);
      toast.success("Loan created");
      setShowGiveLoan(false);
      setGivenForm({ payerId: "", borrowerType: "SELF", principalAmount: 1000, name: "", phone: "" });
      loadGivenLoans();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Could not create loan");
    } finally {
      setGivenSubmitting(false);
    }
  }

  async function handlePayGivenLoan(e: React.FormEvent) {
    e.preventDefault();
    if (!payTarget) return;
    if (!payAmount || payAmount <= 0) return toast.error("Enter an amount");
    setGivenSubmitting(true);
    try {
      await api.post(`/payer-loans/${payTarget.id}/pay`, { amount: payAmount });
      toast.success("Payment recorded");
      setPayTarget(null);
      setPayAmount(0);
      loadGivenLoans();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Payment failed");
    } finally {
      setGivenSubmitting(false);
    }
  }

  async function handleDeleteGivenLoan(loan: GivenLoan) {
    if (!confirm(`Delete this loan (₹${loan.principalAmount})? This also removes its payment history.`)) return;
    try {
      await api.delete(`/payer-loans/${loan.id}`);
      toast.success("Loan deleted");
      loadGivenLoans();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Could not delete loan");
    }
  }

  async function handleResetBorrowerPassword(loan: GivenLoan) {
    try {
      const { data } = await api.post(`/payer-loans/${loan.id}/reset-borrower-password`);
      setNewCreds(data.credentials);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Could not reset password");
    }
  }

  const totalRepayment = Math.round(form.principalAmount * (1 + form.interestRate / 100));
  const weeklyEmi = form.durationWeeks > 0 ? Math.round(totalRepayment / form.durationWeeks) : 0;

  return (
    <>
      <Navbar title={t("loans")} />
      <main className="space-y-8 p-6">
        {/* ============ Interest loans (existing) ============ */}
        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-lg font-bold">Member Loans</h2>
            <button onClick={() => setShowIssue(true)} className="btn-primary">
              <PlusIcon className="h-4 w-4" /> Issue Loan
            </button>
          </div>

          <div className="glass-card overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-ink-900/5 text-left text-xs uppercase tracking-wide text-ink-500 dark:bg-white/5 dark:text-ink-300">
                <tr>
                  <th className="px-4 py-3">{t("name")}</th>
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
                      <td colSpan={9} className="px-4 py-3">
                        <div className="skeleton h-5 w-full" />
                      </td>
                    </tr>
                  ))}
                {!loading && loans.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-4 py-10 text-center text-ink-500">
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
                      <td className="px-4 py-3 text-ink-500">
                        {new Date(l.issueDate).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}
                      </td>
                      <td className="px-4 py-3">₹{l.principalAmount}</td>
                      <td className="px-4 py-3">{l.interestRate}%</td>
                      <td className="px-4 py-3">₹{l.weeklyEmi}</td>
                      <td className="px-4 py-3">₹{l.remainingAmount}</td>
                      <td className="px-4 py-3">{l.remainingWeeks}</td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusColor[l.status]}`}>{l.status}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          <button onClick={() => openHistory(l)} className="btn-secondary !px-3 !py-1.5 text-xs">
                            <ClockIcon className="h-3.5 w-3.5" /> History
                          </button>
                          {(l.status === "ACTIVE" || l.status === "RENEWED") && (
                            <button onClick={() => payEmi(l.id, l.weeklyEmi)} className="btn-secondary !px-3 !py-1.5 text-xs">
                              Record EMI
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* ============ Loan Giving (payer -> self / outside person) ============ */}
        <section>
          <div className="mb-1 flex items-center justify-between">
            <h2 className="font-display text-lg font-bold">Loan Giving</h2>
            <button onClick={() => setShowGiveLoan(true)} className="btn-primary">
              <PlusIcon className="h-4 w-4" /> Issue Loan
            </button>
          </div>
          <p className="mb-4 text-xs text-ink-500">
            A payer lending money to themself or to someone outside the savings scheme. Separate from member savings/EMI loans above.
          </p>

          <div className="glass-card overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-ink-900/5 text-left text-xs uppercase tracking-wide text-ink-500 dark:bg-white/5 dark:text-ink-300">
                <tr>
                  <th className="px-4 py-3">Payer</th>
                  <th className="px-4 py-3">Loan Given To</th>
                  <th className="px-4 py-3">Amount</th>
                  <th className="px-4 py-3">Paid</th>
                  <th className="px-4 py-3">Remaining</th>
                  <th className="px-4 py-3">{t("status")}</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {givenLoading &&
                  Array.from({ length: 2 }).map((_, i) => (
                    <tr key={i} className="border-t border-ink-900/5 dark:border-white/5">
                      <td colSpan={7} className="px-4 py-3">
                        <div className="skeleton h-5 w-full" />
                      </td>
                    </tr>
                  ))}
                {!givenLoading && givenLoans.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-ink-500">
                      {t("noDataFound")}
                    </td>
                  </tr>
                )}
                {!givenLoading &&
                  givenLoans.map((l) => (
                    <tr key={l.id} className="border-t border-ink-900/5 dark:border-white/5">
                      <td className="px-4 py-3 font-medium">
                        {l.payer.name}
                        <div className="font-mono text-xs text-ink-500">{l.payer.username}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <UserIcon className="h-3.5 w-3.5 text-ink-500" />
                          {l.borrowerType === "SELF" ? "Self" : l.borrower?.name}
                        </div>
                        {l.borrower?.username && <div className="font-mono text-xs text-ink-500">{l.borrower.username}</div>}
                      </td>
                      <td className="px-4 py-3">₹{l.principalAmount}</td>
                      <td className="px-4 py-3">₹{l.paidAmount}</td>
                      <td className="px-4 py-3">₹{l.remainingAmount}</td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusColor[l.status]}`}>{l.status}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1.5">
                          <button onClick={() => setGivenHistoryFor(l)} className="btn-secondary !px-2.5 !py-1.5 text-xs">
                            <ClockIcon className="h-3.5 w-3.5" />
                          </button>
                          {l.status === "ACTIVE" && (
                            <button
                              onClick={() => {
                                setPayTarget(l);
                                setPayAmount(0);
                              }}
                              className="btn-secondary !px-2.5 !py-1.5 text-xs"
                            >
                              Pay
                            </button>
                          )}
                          {l.borrowerType === "OUTSIDE" && (
                            <button
                              onClick={() => handleResetBorrowerPassword(l)}
                              title="Reset borrower password"
                              className="rounded-lg p-1.5 hover:bg-ink-900/5 dark:hover:bg-white/10"
                            >
                              <KeyIcon className="h-4 w-4" />
                            </button>
                          )}
                          <button
                            onClick={() => handleDeleteGivenLoan(l)}
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

      {/* Issue Loan modal (interest loans) */}
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
                  <label className="mb-1 block text-xs font-semibold uppercase text-ink-500">Member (payer)</label>
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
                  <p className="mt-1 text-xs text-ink-500">Only family payers and standalone members can hold a loan.</p>
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

      {/* Loan history modal - date-wise EMI schedule */}
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
                <h3 className="font-display text-lg font-bold">Loan History — {historyFor.member.name}</h3>
                <button onClick={() => setHistoryFor(null)}>
                  <XMarkIcon className="h-5 w-5" />
                </button>
              </div>

              {historyLoading ? (
                <div className="skeleton h-56 rounded-xl" />
              ) : (
                <div className="max-h-96 space-y-1.5 overflow-y-auto pr-1">
                  {payments.map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center justify-between rounded-xl border border-ink-900/10 px-3 py-2 text-sm dark:border-white/10"
                    >
                      <div>
                        <div className="font-medium">Week {p.weekNumber}</div>
                        <div className="text-xs text-ink-500">
                          {p.status === "PAID" || p.status === "PARTIAL"
                            ? p.paymentDate &&
                              `Paid ${new Date(p.paymentDate).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}`
                            : `Due ${new Date(p.dueDate).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}`}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusColor[p.status]}`}>{p.status}</span>
                        <span className="w-14 text-right tabular-nums">₹{p.amountPaid || p.emiDue}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Give Loan modal (Self / Outside) */}
      <AnimatePresence>
        {showGiveLoan && (
          <motion.div
            className="fixed inset-0 z-20 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowGiveLoan(false)}
          >
            <motion.form
              onClick={(e) => e.stopPropagation()}
              onSubmit={handleGiveLoan}
              initial={{ opacity: 0, scale: 0.96, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96 }}
              className="glass-card w-full max-w-md p-6"
            >
              <div className="mb-4 flex items-center justify-between">
                <h3 className="font-display text-lg font-bold">Loan Giving — Issue Loan</h3>
                <button type="button" onClick={() => setShowGiveLoan(false)}>
                  <XMarkIcon className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase text-ink-500">Select Payer</label>
                  <select
                    required
                    className="input-field"
                    value={givenForm.payerId}
                    onChange={(e) => setGivenForm({ ...givenForm, payerId: e.target.value })}
                  >
                    <option value="">Select a payer</option>
                    {members.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} ({m.username})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase text-ink-500">Loan Given To</label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setGivenForm({ ...givenForm, borrowerType: "SELF" })}
                      className={`flex-1 rounded-xl border px-3 py-2 text-sm font-medium ${
                        givenForm.borrowerType === "SELF"
                          ? "border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300"
                          : "border-ink-900/10 dark:border-white/10"
                      }`}
                    >
                      Self
                    </button>
                    <button
                      type="button"
                      onClick={() => setGivenForm({ ...givenForm, borrowerType: "OUTSIDE" })}
                      className={`flex-1 rounded-xl border px-3 py-2 text-sm font-medium ${
                        givenForm.borrowerType === "OUTSIDE"
                          ? "border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300"
                          : "border-ink-900/10 dark:border-white/10"
                      }`}
                    >
                      Outside Person
                    </button>
                  </div>
                </div>

                {givenForm.borrowerType === "OUTSIDE" && (
                  <>
                    <input
                      required
                      placeholder="Borrower name"
                      className="input-field"
                      value={givenForm.name}
                      onChange={(e) => setGivenForm({ ...givenForm, name: e.target.value })}
                    />
                    <input
                      placeholder="Mobile number"
                      className="input-field"
                      value={givenForm.phone}
                      onChange={(e) => setGivenForm({ ...givenForm, phone: e.target.value })}
                    />
                    <p className="text-xs text-ink-500">
                      A login (username + password) will be generated automatically for this person once you submit.
                    </p>
                  </>
                )}

                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase text-ink-500">Loan Amount (₹)</label>
                  <input
                    type="number"
                    required
                    className="input-field"
                    value={givenForm.principalAmount}
                    onChange={(e) => setGivenForm({ ...givenForm, principalAmount: Number(e.target.value) })}
                  />
                </div>
              </div>

              <button type="submit" disabled={givenSubmitting} className="btn-primary mt-5 w-full">
                {givenSubmitting ? t("loading") : "Issue Loan"}
              </button>
            </motion.form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Given-loan history modal */}
      <AnimatePresence>
        {givenHistoryFor && (
          <motion.div
            className="fixed inset-0 z-20 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setGivenHistoryFor(null)}
          >
            <motion.div
              onClick={(e) => e.stopPropagation()}
              initial={{ opacity: 0, scale: 0.96, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96 }}
              className="glass-card w-full max-w-md p-6"
            >
              <div className="mb-4 flex items-center justify-between">
                <h3 className="font-display text-lg font-bold">
                  Payment History — {givenHistoryFor.borrowerType === "SELF" ? givenHistoryFor.payer.name : givenHistoryFor.borrower?.name}
                </h3>
                <button onClick={() => setGivenHistoryFor(null)}>
                  <XMarkIcon className="h-5 w-5" />
                </button>
              </div>
              <div className="max-h-80 space-y-1.5 overflow-y-auto pr-1">
                {givenHistoryFor.payments.length === 0 && <p className="text-sm text-ink-500">No payments yet.</p>}
                {givenHistoryFor.payments.map((p) => (
                  <div key={p.id} className="flex items-center justify-between rounded-lg border border-ink-900/10 px-3 py-2 text-sm dark:border-white/10">
                    <span className="text-ink-500">
                      {new Date(p.paymentDate).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}
                    </span>
                    <span className="font-semibold tabular-nums">₹{p.amount}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Record Payment modal (given loans) */}
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
              onSubmit={handlePayGivenLoan}
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
                {payTarget.payer.name} → {payTarget.borrowerType === "SELF" ? "self" : payTarget.borrower?.name} · remaining ₹
                {payTarget.remainingAmount}
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
              <button type="submit" disabled={givenSubmitting} className="btn-primary mt-4 w-full">
                {givenSubmitting ? t("loading") : "Save Payment"}
              </button>
            </motion.form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Credentials reveal modal (new borrower or reset password) */}
      <AnimatePresence>
        {newCreds && (
          <motion.div
            className="fixed inset-0 z-30 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} className="glass-card w-full max-w-sm p-6 text-center">
              <h3 className="font-display text-lg font-bold">Borrower Login</h3>
              <p className="mt-1 text-sm text-ink-500 dark:text-ink-300">
                Share these with the borrower so they can log in to view and pay their loan. Shown only once — if lost, use the key icon
                to generate new ones.
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
