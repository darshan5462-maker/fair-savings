"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { PlusIcon, XMarkIcon, KeyIcon, TrashIcon, PowerIcon } from "@heroicons/react/24/outline";
import { Navbar } from "@/components/Navbar";
import { useLanguage } from "@/i18n/LanguageContext";
import { api } from "@/lib/api";

interface Member {
  id: string;
  username: string;
  name: string;
  village?: string;
  phone?: string;
  weeklyAmount: number;
  isActive: boolean;
  isDefaulter: boolean;
  savings?: { totalPaid: number; weeksCompleted: number };
  childRelation?: { payer: { name: string; username: string } } | null;
}

export default function MembersPage() {
  const { t } = useLanguage();
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [newCreds, setNewCreds] = useState<{ username: string; password: string } | null>(null);
  const [form, setForm] = useState({ name: "", phone: "", village: "", weeklyAmount: 500 });

  async function load() {
    setLoading(true);
    try {
      const { data } = await api.get("/members", { params: { search } });
      setMembers(data.data);
    } catch {
      toast.error("Failed to load members");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timeout = setTimeout(load, 300);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    try {
      const { data } = await api.post("/members", form);
      setNewCreds(data.credentials);
      toast.success(`${data.data.name} added`);
      setForm({ name: "", phone: "", village: "", weeklyAmount: 500 });
      load();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Could not add member");
    }
  }

  async function handleDeactivate(id: string, isActive: boolean) {
    try {
      await api.patch(`/members/${id}/${isActive ? "deactivate" : "activate"}`);
      toast.success(isActive ? "Member deactivated" : "Member activated");
      load();
    } catch {
      toast.error("Action failed");
    }
  }

  async function handleResetPassword(id: string) {
    try {
      const { data } = await api.post(`/members/${id}/reset-password`);
      setNewCreds(data.credentials);
    } catch {
      toast.error("Could not reset password");
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this member permanently?")) return;
    try {
      await api.delete(`/members/${id}`);
      toast.success("Member deleted");
      load();
    } catch {
      toast.error("Could not delete member");
    }
  }

  return (
    <>
      <Navbar title={t("members")} onSearch={setSearch} />
      <main className="p-6">
        <div className="mb-4 flex justify-end">
          <button onClick={() => setShowAdd(true)} className="btn-primary">
            <PlusIcon className="h-4 w-4" /> {t("addMember")}
          </button>
        </div>

        <div className="glass-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-ink-900/5 text-left text-xs uppercase tracking-wide text-ink-500 dark:bg-white/5 dark:text-ink-300">
              <tr>
                <th className="px-4 py-3">{t("name")}</th>
                <th className="px-4 py-3">Username</th>
                <th className="px-4 py-3">{t("village")}</th>
                <th className="px-4 py-3">{t("phone")}</th>
                <th className="px-4 py-3">Weekly</th>
                <th className="px-4 py-3">Paid</th>
                <th className="px-4 py-3">Payer</th>
                <th className="px-4 py-3">{t("status")}</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading &&
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-t border-ink-900/5 dark:border-white/5">
                    <td colSpan={9} className="px-4 py-3">
                      <div className="skeleton h-5 w-full" />
                    </td>
                  </tr>
                ))}

              {!loading && members.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-10 text-center text-ink-500">
                    {t("noDataFound")}
                  </td>
                </tr>
              )}

              {!loading &&
                members.map((m) => (
                  <tr key={m.id} className="border-t border-ink-900/5 hover:bg-ink-900/[0.02] dark:border-white/5 dark:hover:bg-white/[0.03]">
                    <td className="px-4 py-3 font-medium">{m.name}</td>
                    <td className="px-4 py-3 font-mono text-xs">{m.username}</td>
                    <td className="px-4 py-3">{m.village || "-"}</td>
                    <td className="px-4 py-3">{m.phone || "-"}</td>
                    <td className="px-4 py-3">₹{m.weeklyAmount}</td>
                    <td className="px-4 py-3">₹{m.savings?.totalPaid ?? 0}</td>
                    <td className="px-4 py-3">{m.childRelation ? m.childRelation.payer.name : "—"}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                          m.isDefaulter
                            ? "bg-danger/10 text-danger"
                            : m.isActive
                            ? "bg-success/10 text-success"
                            : "bg-ink-900/10 text-ink-500"
                        }`}
                      >
                        {m.isDefaulter ? t("defaulters") : m.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <button title={t("resetPassword")} onClick={() => handleResetPassword(m.id)} className="rounded-lg p-1.5 hover:bg-ink-900/5 dark:hover:bg-white/10">
                          <KeyIcon className="h-4 w-4" />
                        </button>
                        <button title={m.isActive ? t("deactivate") : t("activate")} onClick={() => handleDeactivate(m.id, m.isActive)} className="rounded-lg p-1.5 hover:bg-ink-900/5 dark:hover:bg-white/10">
                          <PowerIcon className="h-4 w-4" />
                        </button>
                        <button title={t("deleteMember")} onClick={() => handleDelete(m.id)} className="rounded-lg p-1.5 text-danger hover:bg-danger/10">
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

      {/* Add Member Modal */}
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
                <h3 className="font-display text-lg font-bold">{t("addMember")}</h3>
                <button type="button" onClick={() => setShowAdd(false)}>
                  <XMarkIcon className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-3">
                <input required placeholder={t("name")} className="input-field" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                <input placeholder={t("phone")} className="input-field" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                <input placeholder={t("village")} className="input-field" value={form.village} onChange={(e) => setForm({ ...form, village: e.target.value })} />
                <input
                  type="number"
                  placeholder={t("assignWeeklyAmount")}
                  className="input-field"
                  value={form.weeklyAmount}
                  onChange={(e) => setForm({ ...form, weeklyAmount: Number(e.target.value) })}
                />
              </div>

              <button type="submit" className="btn-primary mt-5 w-full">
                {t("save")}
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
              <h3 className="font-display text-lg font-bold">Login Credentials</h3>
              <p className="mt-1 text-sm text-ink-500 dark:text-ink-300">Share these with the member. Shown only once.</p>
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
