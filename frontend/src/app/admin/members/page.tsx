"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  PlusIcon,
  XMarkIcon,
  KeyIcon,
  TrashIcon,
  PowerIcon,
  PencilSquareIcon,
  UserPlusIcon,
  UsersIcon,
} from "@heroicons/react/24/outline";
import { Navbar } from "@/components/Navbar";
import { useLanguage } from "@/i18n/LanguageContext";
import { api } from "@/lib/api";

interface Member {
  id: string;
  username: string;
  name: string;
  phone?: string;
  village?: string;
  weeklyAmount: number;
  isActive: boolean;
  isDefaulter: boolean;
  savings?: { totalPaid: number; weeksCompleted: number };
  childRelation?: { payer: { id: string; name: string; username: string } } | null;
  payerRelations?: { child: Member }[];
}

type ModalMode = "addPayer" | "addChild" | "edit" | null;

const emptyForm = { name: "", username: "", password: "", phone: "", village: "", weeklyAmount: 500 };

export default function MembersPage() {
  const { t } = useLanguage();
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [modalTarget, setModalTarget] = useState<Member | null>(null); // payer (for addChild) or member being edited
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [newCreds, setNewCreds] = useState<{ username: string; password: string } | null>(null);

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

  const topLevel = members.filter((m) => !m.childRelation);

  function openAddPayer() {
    setModalMode("addPayer");
    setModalTarget(null);
    setForm(emptyForm);
  }

  function openAddChild(payer: Member) {
    setModalMode("addChild");
    setModalTarget(payer);
    setForm({ ...emptyForm, weeklyAmount: payer.weeklyAmount });
  }

  function openEdit(member: Member) {
    setModalMode("edit");
    setModalTarget(member);
    setForm({
      name: member.name,
      username: member.username,
      password: "",
      phone: member.phone || "",
      village: member.village || "",
      weeklyAmount: member.weeklyAmount,
    });
  }

  function closeModal() {
    setModalMode(null);
    setModalTarget(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (modalMode === "edit" && modalTarget) {
        const payload: Record<string, any> = {
          name: form.name,
          username: form.username,
          phone: form.phone,
          village: form.village,
          weeklyAmount: form.weeklyAmount,
        };
        if (form.password) payload.password = form.password;
        await api.put(`/members/${modalTarget.id}`, payload);
        toast.success("Member updated");
        closeModal();
        load();
      } else {
        const payload: Record<string, any> = {
          name: form.name,
          phone: form.phone,
          village: form.village,
          weeklyAmount: form.weeklyAmount,
        };
        if (modalMode === "addChild" && modalTarget) payload.payerId = modalTarget.id;
        const { data } = await api.post("/members", payload);
        setNewCreds(data.credentials);
        toast.success(`${data.data.name} added`);
        closeModal();
        load();
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Something went wrong");
    } finally {
      setSubmitting(false);
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

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete ${name} permanently? This removes all their savings, loan, and payment history.`)) return;
    try {
      await api.delete(`/members/${id}`);
      toast.success("Member deleted");
      load();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Could not delete member");
    }
  }

  function MemberRow({ member, isChild }: { member: Member; isChild: boolean }) {
    return (
      <tr className="border-t border-ink-900/5 hover:bg-ink-900/[0.02] dark:border-white/5 dark:hover:bg-white/[0.03]">
        <td className={`px-4 py-3 font-medium ${isChild ? "pl-10" : ""}`}>
          {isChild && <span className="mr-1.5 text-ink-300">└</span>}
          {member.name}
        </td>
        <td className="px-4 py-3 font-mono text-xs">{member.username}</td>
        <td className="px-4 py-3">{member.village || "-"}</td>
        <td className="px-4 py-3">{member.phone || "-"}</td>
        <td className="px-4 py-3">₹{member.weeklyAmount}</td>
        <td className="px-4 py-3">₹{member.savings?.totalPaid ?? 0}</td>
        <td className="px-4 py-3">
          <span
            className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
              member.isDefaulter
                ? "bg-danger/10 text-danger"
                : member.isActive
                ? "bg-success/10 text-success"
                : "bg-ink-900/10 text-ink-500"
            }`}
          >
            {member.isDefaulter ? t("defaulters") : member.isActive ? "Active" : "Inactive"}
          </span>
        </td>
        <td className="px-4 py-3">
          <div className="flex justify-end gap-1.5">
            <button title="Edit" onClick={() => openEdit(member)} className="rounded-lg p-1.5 hover:bg-ink-900/5 dark:hover:bg-white/10">
              <PencilSquareIcon className="h-4 w-4" />
            </button>
            <button title={t("resetPassword")} onClick={() => handleResetPassword(member.id)} className="rounded-lg p-1.5 hover:bg-ink-900/5 dark:hover:bg-white/10">
              <KeyIcon className="h-4 w-4" />
            </button>
            <button
              title={member.isActive ? t("deactivate") : t("activate")}
              onClick={() => handleDeactivate(member.id, member.isActive)}
              className="rounded-lg p-1.5 hover:bg-ink-900/5 dark:hover:bg-white/10"
            >
              <PowerIcon className="h-4 w-4" />
            </button>
            <button title={t("deleteMember")} onClick={() => handleDelete(member.id, member.name)} className="rounded-lg p-1.5 text-danger hover:bg-danger/10">
              <TrashIcon className="h-4 w-4" />
            </button>
          </div>
        </td>
      </tr>
    );
  }

  const tableHead = (
    <thead className="bg-ink-900/5 text-left text-xs uppercase tracking-wide text-ink-500 dark:bg-white/5 dark:text-ink-300">
      <tr>
        <th className="px-4 py-3">{t("name")}</th>
        <th className="px-4 py-3">Username</th>
        <th className="px-4 py-3">{t("village")}</th>
        <th className="px-4 py-3">{t("phone")}</th>
        <th className="px-4 py-3">Weekly</th>
        <th className="px-4 py-3">Paid</th>
        <th className="px-4 py-3">{t("status")}</th>
        <th className="px-4 py-3 text-right">Actions</th>
      </tr>
    </thead>
  );

  return (
    <>
      <Navbar title={t("members")} onSearch={setSearch} />
      <main className="space-y-6 p-6">
        <div className="flex justify-end">
          <button onClick={openAddPayer} className="btn-primary">
            <PlusIcon className="h-4 w-4" /> Add Payer / Member
          </button>
        </div>

        {loading && (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="skeleton h-16 rounded-xl2" />
            ))}
          </div>
        )}

        {!loading && topLevel.length === 0 && (
          <div className="glass-card p-10 text-center text-ink-500">{t("noDataFound")}</div>
        )}

        {!loading &&
          topLevel.map((member) => {
            const childCount = member.payerRelations?.length ?? 0;
            return (
              <div key={member.id} className="glass-card overflow-hidden">
                <div className="flex items-center justify-between border-b border-ink-900/5 bg-brand-50/60 px-4 py-3 dark:border-white/5 dark:bg-brand-900/20">
                  <div className="flex items-center gap-2">
                    <UsersIcon className="h-4 w-4 text-brand-500" />
                    <span className="font-display font-semibold">{member.name}</span>
                    <span className="font-mono text-xs text-ink-500">{member.username}</span>
                    <span className="text-xs text-ink-500">
                      {childCount > 0 ? `· Payer for ${childCount} member(s)` : "· pays for self"}
                    </span>
                  </div>
                  <button onClick={() => openAddChild(member)} className="btn-secondary !px-3 !py-1.5 text-xs">
                    <UserPlusIcon className="h-3.5 w-3.5" /> Add Child
                  </button>
                </div>
                <table className="w-full text-sm">
                  {tableHead}
                  <tbody>
                    <MemberRow member={member} isChild={false} />
                    {member.payerRelations?.map((r) => (
                      <MemberRow key={r.child.id} member={r.child} isChild />
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })}
      </main>

      {/* Add / Edit Modal */}
      <AnimatePresence>
        {modalMode && (
          <motion.div
            className="fixed inset-0 z-20 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeModal}
          >
            <motion.form
              onClick={(e) => e.stopPropagation()}
              onSubmit={handleSubmit}
              initial={{ opacity: 0, scale: 0.96, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96 }}
              className="glass-card w-full max-w-md p-6"
            >
              <div className="mb-4 flex items-center justify-between">
                <h3 className="font-display text-lg font-bold">
                  {modalMode === "edit" ? "Edit Member" : modalMode === "addChild" ? `Add Child under ${modalTarget?.name}` : "Add Payer / Member"}
                </h3>
                <button type="button" onClick={closeModal}>
                  <XMarkIcon className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-3">
                <input required placeholder={t("name")} className="input-field" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />

                {modalMode === "edit" && (
                  <>
                    <input
                      required
                      placeholder="Username"
                      className="input-field font-mono"
                      value={form.username}
                      onChange={(e) => setForm({ ...form, username: e.target.value })}
                    />
                    <input
                      placeholder="New password (leave blank to keep current)"
                      className="input-field"
                      value={form.password}
                      onChange={(e) => setForm({ ...form, password: e.target.value })}
                    />
                  </>
                )}

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

              <button type="submit" disabled={submitting} className="btn-primary mt-5 w-full">
                {submitting ? t("loading") : t("save")}
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
