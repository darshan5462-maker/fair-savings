"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
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

const statusColor: Record<string, string> = {
  ACTIVE: "bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300",
  RENEWED: "bg-warning/10 text-warning",
  COMPLETED: "bg-success/10 text-success",
  DEFAULTED: "bg-danger/10 text-danger",
};

export default function LoansPage() {
  const { t } = useLanguage();
  const [loans, setLoans] = useState<Loan[]>([]);
  const [loading, setLoading] = useState(true);

  function load() {
    setLoading(true);
    api
      .get("/loans")
      .then((res) => setLoans(res.data.data))
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

  return (
    <>
      <Navbar title={t("loans")} />
      <main className="p-6">
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
    </>
  );
}
