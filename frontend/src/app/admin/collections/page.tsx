"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { CalendarDaysIcon, XMarkIcon, PencilSquareIcon, CheckIcon } from "@heroicons/react/24/outline";
import { Navbar } from "@/components/Navbar";
import { useLanguage } from "@/i18n/LanguageContext";
import { api } from "@/lib/api";

interface ChildMember {
  id: string;
  name: string;
  username: string;
  weeklyAmount: number;
}

interface Payer {
  id: string;
  name: string;
  username: string;
  weeklyAmount: number;
  payerRelations?: { child: ChildMember }[];
}

interface ScheduleRow {
  weekNumber: number;
  dueDate: string;
  id: string | null;
  amountDue: number;
  amountPaid: number;
  status: string;
  paymentDate: string | null;
}

const statusColor: Record<string, string> = {
  PAID: "bg-success/10 text-success",
  PENDING: "bg-warning/10 text-warning",
  MISSED: "bg-danger/10 text-danger",
  PARTIAL: "bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300",
};

export default function CollectionsPage() {
  const { t } = useLanguage();
  const [members, setMembers] = useState<Payer[]>([]);
  const [selectedPayer, setSelectedPayer] = useState<Payer | null>(null);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [amounts, setAmounts] = useState<Record<string, number>>({});
  const [submitting, setSubmitting] = useState(false);

  const [scheduleFor, setScheduleFor] = useState<{ id: string; name: string } | null>(null);
  const [schedule, setSchedule] = useState<ScheduleRow[]>([]);
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [editingRow, setEditingRow] = useState<string | null>(null);
  const [editAmount, setEditAmount] = useState(0);

  useEffect(() => {
    api.get("/members").then((res) => setMembers(res.data.data));
  }, []);

  // "Payable" units: members who have linked children (family payers), plus
  // any member with no payer of their own (they pay for themselves).
  const payableEntities = members.filter((m: any) => !m.childRelation);

  function selectPayer(payer: Payer) {
    setSelectedPayer(payer);
    const initChecked: Record<string, boolean> = {};
    const initAmounts: Record<string, number> = {};
    if (payer.payerRelations && payer.payerRelations.length > 0) {
      payer.payerRelations.forEach((r) => {
        initChecked[r.child.id] = true;
        initAmounts[r.child.id] = r.child.weeklyAmount;
      });
    } else {
      initChecked[payer.id] = true;
      initAmounts[payer.id] = payer.weeklyAmount;
    }
    setChecked(initChecked);
    setAmounts(initAmounts);
  }

  const total = Object.entries(checked)
    .filter(([, v]) => v)
    .reduce((sum, [id]) => sum + (amounts[id] || 0), 0);

  async function handleCollect() {
    if (!selectedPayer) return;
    const payments = Object.entries(checked)
      .filter(([, v]) => v)
      .map(([memberId]) => ({ memberId, amount: amounts[memberId] }));

    if (payments.length === 0) return toast.error("Select at least one member");

    setSubmitting(true);
    try {
      const isFamilyPayer = (selectedPayer.payerRelations?.length ?? 0) > 0;
      if (isFamilyPayer) {
        const { data } = await api.post("/collections/pay-family", { payerId: selectedPayer.id, payments });
        toast.success(`₹${data.totalCollected} collected for ${payments.length} member(s)`);
      } else {
        await api.post("/collections/pay-single", { memberId: selectedPayer.id, amount: payments[0].amount });
        toast.success(`₹${payments[0].amount} collected`);
      }
      setSelectedPayer(null);
      setChecked({});
      setAmounts({});
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Payment failed");
    } finally {
      setSubmitting(false);
    }
  }

  async function openSchedule(member: { id: string; name: string }) {
    setScheduleFor(member);
    setScheduleLoading(true);
    try {
      const { data } = await api.get(`/collections/schedule/${member.id}`, { params: { weeks: 10 } });
      setSchedule(data.data);
    } catch {
      toast.error("Could not load schedule");
    } finally {
      setScheduleLoading(false);
    }
  }

  function startEdit(row: ScheduleRow) {
    setEditingRow(row.id);
    setEditAmount(row.amountPaid || row.amountDue);
  }

  async function saveEdit(row: ScheduleRow) {
    if (!row.id) return;
    try {
      await api.patch(`/collections/${row.id}`, { amountPaid: editAmount, status: "PAID" });
      toast.success(`Week ${row.weekNumber} updated`);
      setEditingRow(null);
      if (scheduleFor) openSchedule(scheduleFor);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Could not update");
    }
  }

  return (
    <>
      <Navbar title={t("weeklyCollections")} />
      <main className="grid grid-cols-1 gap-6 p-6 lg:grid-cols-3">
        {/* Payer / member list */}
        <div className="glass-card p-4 lg:col-span-1">
          <h3 className="mb-3 font-display font-semibold">Members</h3>
          <div className="max-h-[70vh] space-y-2 overflow-y-auto pr-1">
            {payableEntities.length === 0 && <p className="text-sm text-ink-500">{t("noDataFound")}</p>}
            {payableEntities.map((p) => (
              <button
                key={p.id}
                onClick={() => selectPayer(p)}
                className={`w-full rounded-xl border px-3 py-2.5 text-left text-sm transition-colors ${
                  selectedPayer?.id === p.id
                    ? "border-brand-500 bg-brand-50 dark:bg-brand-900/30"
                    : "border-ink-900/10 hover:bg-ink-900/5 dark:border-white/10 dark:hover:bg-white/5"
                }`}
              >
                <div className="font-medium">{p.name}</div>
                <div className="text-xs text-ink-500">
                  {p.username} · {(p.payerRelations?.length ?? 0) > 0 ? `${p.payerRelations!.length} linked members` : "pays for self"}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Batch payment screen */}
        <div className="glass-card p-5 lg:col-span-2">
          <h3 className="mb-1 font-display font-semibold">{t("payForFamily")}</h3>
          {!selectedPayer ? (
            <p className="mt-4 text-sm text-ink-500">Select a member on the left to begin collecting.</p>
          ) : (
            <>
              <p className="mb-4 text-sm text-ink-500 dark:text-ink-300">
                {t("selectMembersToPay")} for <b>{selectedPayer.name}</b>
              </p>
              <div className="space-y-2">
                {(selectedPayer.payerRelations && selectedPayer.payerRelations.length > 0
                  ? selectedPayer.payerRelations.map((r) => r.child)
                  : [selectedPayer]
                ).map((child) => (
                  <div
                    key={child.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-ink-900/10 px-4 py-3 dark:border-white/10"
                  >
                    <label className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={!!checked[child.id]}
                        onChange={(e) => setChecked({ ...checked, [child.id]: e.target.checked })}
                        className="h-4 w-4 rounded accent-brand-500"
                      />
                      <div>
                        <div className="font-medium">{child.name}</div>
                        <div className="text-xs text-ink-500">{child.username}</div>
                      </div>
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        className="input-field w-28 text-right"
                        value={amounts[child.id] ?? 0}
                        onChange={(e) => setAmounts({ ...amounts, [child.id]: Number(e.target.value) })}
                      />
                      <button
                        type="button"
                        title="View schedule"
                        onClick={() => openSchedule(child)}
                        className="rounded-lg p-1.5 hover:bg-ink-900/5 dark:hover:bg-white/10"
                      >
                        <CalendarDaysIcon className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-5 flex items-center justify-between rounded-xl bg-brand-gradient p-4 text-white">
                <span className="font-medium">{t("totalCollected")}</span>
                <span className="font-display text-xl font-bold tabular-nums">₹{total}</span>
              </div>

              <button onClick={handleCollect} disabled={submitting} className="btn-primary mt-4 w-full">
                {submitting ? t("loading") : t("payNow")}
              </button>
            </>
          )}
        </div>
      </main>

      {/* Schedule modal */}
      <AnimatePresence>
        {scheduleFor && (
          <motion.div
            className="fixed inset-0 z-20 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setScheduleFor(null)}
          >
            <motion.div
              onClick={(e) => e.stopPropagation()}
              initial={{ opacity: 0, scale: 0.96, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96 }}
              className="glass-card w-full max-w-lg p-6"
            >
              <div className="mb-4 flex items-center justify-between">
                <h3 className="font-display text-lg font-bold">Schedule — {scheduleFor.name}</h3>
                <button onClick={() => setScheduleFor(null)}>
                  <XMarkIcon className="h-5 w-5" />
                </button>
              </div>

              {scheduleLoading ? (
                <div className="skeleton h-48 rounded-xl" />
              ) : (
                <div className="max-h-96 space-y-1.5 overflow-y-auto pr-1">
                  {schedule.map((row) => (
                    <div
                      key={row.weekNumber}
                      className="flex items-center justify-between rounded-xl border border-ink-900/10 px-3 py-2 text-sm dark:border-white/10"
                    >
                      <div>
                        <div className="font-medium">Week {row.weekNumber}</div>
                        <div className="text-xs text-ink-500">
                          {new Date(row.dueDate).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}
                        </div>
                      </div>

                      {editingRow === row.id ? (
                        <div className="flex items-center gap-1.5">
                          <input
                            type="number"
                            autoFocus
                            className="input-field w-24 !py-1 text-right text-sm"
                            value={editAmount}
                            onChange={(e) => setEditAmount(Number(e.target.value))}
                          />
                          <button onClick={() => saveEdit(row)} className="rounded-lg p-1.5 text-success hover:bg-success/10">
                            <CheckIcon className="h-4 w-4" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusColor[row.status]}`}>
                            {row.status === "PENDING" && !row.id ? "Upcoming" : row.status}
                          </span>
                          <span className="w-14 text-right tabular-nums">₹{row.amountPaid || row.amountDue}</span>
                          {row.id && (
                            <button onClick={() => startEdit(row)} className="rounded-lg p-1.5 hover:bg-ink-900/5 dark:hover:bg-white/10">
                              <PencilSquareIcon className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                  {schedule.length === 0 && <p className="py-6 text-center text-sm text-ink-500">{t("noDataFound")}</p>}
                </div>
              )}
              <p className="mt-4 text-xs text-ink-500">
                Only already-recorded weeks (with the pencil icon) can be corrected here. Upcoming weeks appear once paid.
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
