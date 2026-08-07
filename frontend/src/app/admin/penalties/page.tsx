"use client";

import { useEffect, useState } from "react";
import { Navbar } from "@/components/Navbar";
import { useLanguage } from "@/i18n/LanguageContext";
import { api } from "@/lib/api";

interface Loan {
  id: string;
  member: { name: string; username: string };
  penalties: { id: string; reason: string; amount: number; isPaid: boolean; createdAt: string }[];
}

export default function PenaltiesPage() {
  const { t } = useLanguage();
  const [penalties, setPenalties] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Loans endpoint includes nested penalties per loan; flatten client-side.
    api
      .get("/loans")
      .then(async (res) => {
        const loans: Loan[] = res.data.data;
        const detailed = await Promise.all(
          loans.map((l) => api.get(`/loans/member/${(l as any).memberId ?? ""}`).catch(() => null))
        );
        const flat = detailed
          .filter(Boolean)
          .flatMap((r: any) => r!.data.data)
          .flatMap((loan: any) => loan.penalties.map((p: any) => ({ ...p, member: loan.member })));
        setPenalties(flat);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <>
      <Navbar title={t("penalties")} />
      <main className="p-6">
        <div className="glass-card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-ink-900/5 text-left text-xs uppercase tracking-wide text-ink-500 dark:bg-white/5 dark:text-ink-300">
              <tr>
                <th className="px-4 py-3">{t("name")}</th>
                <th className="px-4 py-3">Reason</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">{t("status")}</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={4} className="px-4 py-3">
                    <div className="skeleton h-5 w-full" />
                  </td>
                </tr>
              )}
              {!loading && penalties.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-10 text-center text-ink-500">
                    {t("noDataFound")}
                  </td>
                </tr>
              )}
              {!loading &&
                penalties.map((p) => (
                  <tr key={p.id} className="border-t border-ink-900/5 dark:border-white/5">
                    <td className="px-4 py-3 font-medium">{p.member?.name ?? "-"}</td>
                    <td className="px-4 py-3 text-ink-500">{p.reason}</td>
                    <td className="px-4 py-3 tabular-nums">₹{p.amount}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${p.isPaid ? "bg-success/10 text-success" : "bg-danger/10 text-danger"}`}>
                        {p.isPaid ? "Paid" : "Pending"}
                      </span>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-ink-500">
          Note: penalties are applied automatically from the Loans page when an EMI is missed (1% of the EMI amount by default).
        </p>
      </main>
    </>
  );
}
