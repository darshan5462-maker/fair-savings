"use client";

import { useEffect, useState } from "react";
import { PlusIcon, PencilIcon, TrashIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { Navbar } from "@/components/Navbar";
import { useLanguage } from "@/i18n/LanguageContext";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

interface Penalty {
  id: string;
  memberId: string;
  member: { name: string; username: string };
  reason: string;
  amount: number;
  isPaid: boolean;
  createdAt: string;
}

export default function PenaltiesPage() {
  const { t } = useLanguage();
  const [penalties, setPenalties] = useState<Penalty[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [modalMode, setModalMode] = useState<"ADD" | "EDIT" | null>(null);
  const [selected, setSelected] = useState<Penalty | null>(null);

  const [form, setForm] = useState({ memberId: "", reason: "", amount: "", isPaid: false });
  const [submitting, setSubmitting] = useState(false);

  function load() {
    setLoading(true);
    Promise.all([api.get("/penalties"), api.get("/members")])
      .then(([pRes, mRes]) => {
        setPenalties(pRes.data?.data || []);
        setMembers(mRes.data?.data || []);
      })
      .catch((err) => {
        console.error("Error loading penalties:", err);
        toast.error("Failed to load penalties");
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, []);

  function openAdd() {
    setForm({ memberId: "", reason: "", amount: "", isPaid: false });
    setModalMode("ADD");
  }

  function openEdit(p: Penalty) {
    setSelected(p);
    setForm({ memberId: p.memberId, reason: p.reason, amount: p.amount.toString(), isPaid: p.isPaid });
    setModalMode("EDIT");
  }

  async function handleQuickPay(p: Penalty) {
    try {
      await api.put(`/penalties/${p.id}`, { isPaid: true });
      toast.success(`Marked penalty for ${p.member?.name ?? "member"} as paid`);
      load();
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Error marking penalty as paid");
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (modalMode === "ADD") {
        await api.post("/penalties", { ...form, amount: Number(form.amount) });
        toast.success("Penalty added successfully");
      } else if (modalMode === "EDIT" && selected) {
        await api.put(`/penalties/${selected.id}`, { ...form, amount: Number(form.amount) });
        toast.success("Penalty updated successfully");
      }
      setModalMode(null);
      load();
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Error saving penalty");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Are you sure you want to delete this penalty?")) return;
    try {
      await api.delete(`/penalties/${id}`);
      toast.success("Penalty deleted");
      load();
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Error deleting penalty");
    }
  }

  const totalAmount = penalties.reduce((sum, p) => sum + Number(p.amount || 0), 0);
  const pendingAmount = penalties.filter((p) => !p.isPaid).reduce((sum, p) => sum + Number(p.amount || 0), 0);
  const paidAmount = penalties.filter((p) => p.isPaid).reduce((sum, p) => sum + Number(p.amount || 0), 0);

  return (
    <>
      <Navbar title={t("penalties")} />
      <main className="p-6">
        {/* Summary Stat Cards */}
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="glass-card p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-ink-500">Total Penalties</p>
            <p className="mt-1 font-display text-2xl font-bold text-danger">₹{totalAmount.toLocaleString()}</p>
            <p className="mt-0.5 text-xs text-ink-400">{penalties.length} total records</p>
          </div>
          <div className="glass-card p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-ink-500">Pending Fines</p>
            <p className="mt-1 font-display text-2xl font-bold text-warning">₹{pendingAmount.toLocaleString()}</p>
            <p className="mt-0.5 text-xs text-ink-400">{penalties.filter((p) => !p.isPaid).length} unpaid</p>
          </div>
          <div className="glass-card p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-ink-500">Collected Fines</p>
            <p className="mt-1 font-display text-2xl font-bold text-success">₹{paidAmount.toLocaleString()}</p>
            <p className="mt-0.5 text-xs text-ink-400">{penalties.filter((p) => p.isPaid).length} paid</p>
          </div>
        </div>

        <div className="mb-6 flex items-center justify-between">
          <h2 className="font-display text-lg font-bold">Penalties Ledger</h2>
          <button onClick={openAdd} className="btn-primary flex items-center gap-2">
            <PlusIcon className="h-5 w-5" />
            Add Penalty
          </button>
        </div>

        <div className="glass-card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-ink-900/5 text-left text-xs uppercase tracking-wide text-ink-500 dark:bg-white/5 dark:text-ink-300">
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">{t("name")}</th>
                <th className="px-4 py-3">Reason</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">{t("status")}</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={6} className="px-4 py-3">
                    <div className="skeleton h-5 w-full" />
                  </td>
                </tr>
              )}
              {!loading && penalties.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-ink-500">
                    {t("noDataFound")}
                  </td>
                </tr>
              )}
              {!loading &&
                penalties.map((p) => (
                  <tr key={p.id} className="border-t border-ink-900/5 dark:border-white/5">
                    <td className="px-4 py-3 text-ink-400 text-xs">
                      {p.createdAt ? new Date(p.createdAt).toLocaleDateString() : "-"}
                    </td>
                    <td className="px-4 py-3 font-medium">{p.member?.name ?? "-"}</td>
                    <td className="px-4 py-3 text-ink-500">{p.reason}</td>
                    <td className="px-4 py-3 tabular-nums font-semibold">₹{p.amount}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${p.isPaid ? "bg-success/10 text-success" : "bg-warning/10 text-warning"}`}>
                        {p.isPaid ? "Paid" : "Pending"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end items-center gap-1.5">
                        {!p.isPaid && (
                          <button
                            onClick={() => handleQuickPay(p)}
                            className="px-2 py-1 text-xs font-medium text-success hover:bg-success/10 rounded-lg transition-colors border border-success/30"
                            title="Mark as Paid"
                          >
                            Mark Paid
                          </button>
                        )}
                        <button onClick={() => openEdit(p)} className="p-1.5 text-brand-500 hover:bg-brand-50 rounded-lg dark:hover:bg-brand-900/30 transition-colors" title="Edit">
                          <PencilIcon className="h-4 w-4" />
                        </button>
                        <button onClick={() => handleDelete(p.id)} className="p-1.5 text-danger hover:bg-danger/10 rounded-lg transition-colors" title="Delete">
                          <TrashIcon className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </main>

      <AnimatePresence>
        {modalMode && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-ink-900/40 backdrop-blur-sm dark:bg-black/60" onClick={() => setModalMode(null)} />
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="glass-card relative w-full max-w-md overflow-hidden p-6 shadow-2xl">
              <button onClick={() => setModalMode(null)} className="absolute right-4 top-4 text-ink-500 hover:text-ink-900 dark:hover:text-white">
                <XMarkIcon className="h-5 w-5" />
              </button>
              <h2 className="mb-6 font-display text-xl font-bold">{modalMode === "ADD" ? "Add Penalty" : "Edit Penalty"}</h2>

              <form onSubmit={handleSubmit} className="space-y-4">
                {modalMode === "ADD" && (
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-ink-700 dark:text-ink-300">Member</label>
                    <select
                      required
                      className="input-field"
                      value={form.memberId}
                      onChange={(e) => setForm({ ...form, memberId: e.target.value })}
                    >
                      <option value="">Select Member</option>
                      {members.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name} ({m.username})
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-ink-700 dark:text-ink-300">Amount (₹)</label>
                  <input
                    type="number"
                    required
                    min="1"
                    className="input-field"
                    value={form.amount}
                    onChange={(e) => setForm({ ...form, amount: e.target.value })}
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-ink-700 dark:text-ink-300">Reason</label>
                  <input
                    type="text"
                    required
                    className="input-field"
                    value={form.reason}
                    onChange={(e) => setForm({ ...form, reason: e.target.value })}
                    placeholder="e.g. Late fee"
                  />
                </div>

                {modalMode === "EDIT" && (
                  <label className="flex items-center gap-3 rounded-xl border border-ink-900/10 p-4 cursor-pointer hover:bg-ink-900/5 dark:border-white/10 dark:hover:bg-white/5 transition-colors">
                    <input
                      type="checkbox"
                      checked={form.isPaid}
                      onChange={(e) => setForm({ ...form, isPaid: e.target.checked })}
                      className="h-5 w-5 rounded border-ink-300 text-brand-600 focus:ring-brand-600"
                    />
                    <span className="text-sm font-medium">Mark as Paid</span>
                  </label>
                )}

                <button type="submit" disabled={submitting} className="btn-primary mt-6 w-full">
                  {submitting ? "Saving..." : modalMode === "ADD" ? "Add Penalty" : "Save Changes"}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
