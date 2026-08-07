"use client";

import { useEffect, useState } from "react";
import { Navbar } from "@/components/Navbar";
import { useLanguage } from "@/i18n/LanguageContext";
import { api } from "@/lib/api";

interface Tx {
  id: string;
  type: string;
  amount: number;
  description?: string;
  createdAt: string;
  member: { name: string; username: string };
}

export default function TransactionsPage() {
  const { t } = useLanguage();
  const [rows, setRows] = useState<Tx[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get("/transactions")
      .then((res) => setRows(res.data.data))
      .finally(() => setLoading(false));
  }, []);

  return (
    <>
      <Navbar title={t("transactions")} />
      <main className="p-6">
        <div className="glass-card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-ink-900/5 text-left text-xs uppercase tracking-wide text-ink-500 dark:bg-white/5 dark:text-ink-300">
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">{t("name")}</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">Description</th>
              </tr>
            </thead>
            <tbody>
              {loading &&
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} className="border-t border-ink-900/5 dark:border-white/5">
                    <td colSpan={5} className="px-4 py-3">
                      <div className="skeleton h-5 w-full" />
                    </td>
                  </tr>
                ))}
              {!loading && rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-ink-500">
                    {t("noDataFound")}
                  </td>
                </tr>
              )}
              {!loading &&
                rows.map((r) => (
                  <tr key={r.id} className="border-t border-ink-900/5 dark:border-white/5">
                    <td className="px-4 py-3">{new Date(r.createdAt).toLocaleDateString()}</td>
                    <td className="px-4 py-3 font-medium">{r.member.name}</td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-700 dark:bg-brand-900/40 dark:text-brand-300">
                        {r.type.replace("_", " ")}
                      </span>
                    </td>
                    <td className="px-4 py-3 tabular-nums">₹{r.amount}</td>
                    <td className="px-4 py-3 text-ink-500">{r.description}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </main>
    </>
  );
}
