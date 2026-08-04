"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Navbar } from "@/components/Navbar";
import { useLanguage } from "@/i18n/LanguageContext";
import { api } from "@/lib/api";

interface Member {
  id: string;
  name: string;
  username: string;
  weeklyAmount: number;
  payerRelations?: { child: { id: string; name: string; username: string; weeklyAmount: number } }[];
}

export default function CollectionsPage() {
  const { t } = useLanguage();
  const [payers, setPayers] = useState<Member[]>([]);
  const [selectedPayer, setSelectedPayer] = useState<Member | null>(null);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [amounts, setAmounts] = useState<Record<string, number>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api.get("/family").then((res) => setPayers(res.data.data));
  }, []);

  function selectPayer(payer: Member) {
    setSelectedPayer(payer);
    const initChecked: Record<string, boolean> = {};
    const initAmounts: Record<string, number> = {};
    payer.payerRelations?.forEach((r) => {
      initChecked[r.child.id] = true;
      initAmounts[r.child.id] = r.child.weeklyAmount;
    });
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
      const { data } = await api.post("/collections/pay-family", { payerId: selectedPayer.id, payments });
      toast.success(`₹${data.totalCollected} collected for ${payments.length} member(s)`);
      setSelectedPayer(null);
      setChecked({});
      setAmounts({});
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Payment failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <Navbar title={t("weeklyCollections")} />
      <main className="grid grid-cols-1 gap-6 p-6 lg:grid-cols-3">
        {/* Payer list */}
        <div className="glass-card p-4 lg:col-span-1">
          <h3 className="mb-3 font-display font-semibold">Family Payers</h3>
          <div className="space-y-2">
            {payers.length === 0 && <p className="text-sm text-ink-500">{t("noDataFound")}</p>}
            {payers.map((p) => (
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
                  {p.username} · {p.payerRelations?.length ?? 0} linked members
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Batch payment screen */}
        <div className="glass-card p-5 lg:col-span-2">
          <h3 className="mb-1 font-display font-semibold">{t("payForFamily")}</h3>
          {!selectedPayer ? (
            <p className="mt-4 text-sm text-ink-500">Select a payer on the left to begin collecting.</p>
          ) : (
            <>
              <p className="mb-4 text-sm text-ink-500 dark:text-ink-300">
                {t("selectMembersToPay")} for <b>{selectedPayer.name}</b>
              </p>
              <div className="space-y-2">
                {selectedPayer.payerRelations?.map((r) => (
                  <div
                    key={r.child.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-ink-900/10 px-4 py-3 dark:border-white/10"
                  >
                    <label className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={!!checked[r.child.id]}
                        onChange={(e) => setChecked({ ...checked, [r.child.id]: e.target.checked })}
                        className="h-4 w-4 rounded accent-brand-500"
                      />
                      <div>
                        <div className="font-medium">{r.child.name}</div>
                        <div className="text-xs text-ink-500">{r.child.username}</div>
                      </div>
                    </label>
                    <input
                      type="number"
                      className="input-field w-28 text-right"
                      value={amounts[r.child.id] ?? 0}
                      onChange={(e) => setAmounts({ ...amounts, [r.child.id]: Number(e.target.value) })}
                    />
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
    </>
  );
}
