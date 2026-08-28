"use client";

import { useEffect, useState } from "react";
import {
  UsersIcon,
  BanknotesIcon,
  CreditCardIcon,
  ClockIcon,
  WalletIcon,
  ScaleIcon,
  ExclamationTriangleIcon,
  TrophyIcon,
  ReceiptPercentIcon,
  CurrencyRupeeIcon,
} from "@heroicons/react/24/outline";
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { Navbar } from "@/components/Navbar";
import { StatCard } from "@/components/StatCard";
import { useLanguage } from "@/i18n/LanguageContext";
import { api } from "@/lib/api";

interface DashboardData {
  cards: {
    totalMembers: number;
    todaysCollection: number;
    activeLoans: number;
    pendingCollections: number;
    totalSavings: number;
    totalLoanAmount: number;
    currentAmount: number;
    totalInterest: number;
    totalFines: number;
    defaulters: number;
    completedMembers: number;
  };
  charts: {
    weeklyCollection: { week: number; amount: number }[];
    savingsGrowth: { month: string; amount: number }[];
    loanStatistics: { status: string; count: number }[];
  };
}

const PIE_COLORS = ["#7C5CF5", "#3B82F6", "#17B26A", "#F04438"];

function currency(n: number) {
  if (n < 0) {
    return `-₹${Math.abs(n).toLocaleString("en-IN")}`;
  }
  return `₹${n.toLocaleString("en-IN")}`;
}

export default function AdminDashboard() {
  const { t } = useLanguage();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get("/dashboard/admin")
      .then((res) => setData(res.data.data))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  return (
    <>
      <Navbar title={t("dashboard")} />
      <main className="space-y-6 p-6">
        {loading ? (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {Array.from({ length: 11 }).map((_, i) => (
              <div key={i} className="skeleton h-28 rounded-xl2" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <StatCard label={t("totalMembers")} value={data?.cards.totalMembers ?? 0} icon={UsersIcon} tone="brand" delay={0.0} />
            <StatCard label={t("todaysCollection")} value={currency(data?.cards.todaysCollection ?? 0)} icon={BanknotesIcon} tone="success" delay={0.05} />
            <StatCard label={t("activeLoans")} value={data?.cards.activeLoans ?? 0} icon={CreditCardIcon} tone="brand" delay={0.1} />
            <StatCard label={t("pendingCollections")} value={data?.cards.pendingCollections ?? 0} icon={ClockIcon} tone="warning" delay={0.15} />
            <StatCard label={t("totalSavings")} value={currency(data?.cards.totalSavings ?? 0)} icon={WalletIcon} tone="success" delay={0.2} />
            <StatCard label={t("totalLoanAmount")} value={currency(data?.cards.totalLoanAmount ?? 0)} icon={ScaleIcon} tone="brand" delay={0.23} />
            <StatCard
              label={t("currentAmount")}
              value={currency(data?.cards.currentAmount ?? 0)}
              icon={CurrencyRupeeIcon}
              tone={(data?.cards.currentAmount ?? 0) >= 0 ? "success" : "danger"}
              delay={0.26}
            />
            <StatCard label="Total Interest" value={currency(data?.cards.totalInterest ?? 0)} icon={ReceiptPercentIcon} tone="brand" delay={0.28} />
            <StatCard label="Total Fines" value={currency(data?.cards.totalFines ?? 0)} icon={ExclamationTriangleIcon} tone="danger" delay={0.3} />
            <StatCard label={t("defaulters")} value={data?.cards.defaulters ?? 0} icon={ExclamationTriangleIcon} tone="danger" delay={0.32} />
            <StatCard label={t("completed52Week")} value={data?.cards.completedMembers ?? 0} icon={TrophyIcon} tone="success" delay={0.35} />
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="glass-card p-5 lg:col-span-2">
            <h3 className="mb-4 font-display font-semibold">{t("weeklyCollectionChart")}</h3>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={data?.charts.weeklyCollection ?? []}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,148,170,0.15)" />
                <XAxis dataKey="week" tickFormatter={(w) => `W${w}`} fontSize={12} />
                <YAxis fontSize={12} />
                <Tooltip formatter={(v: number) => currency(v)} />
                <Bar dataKey="amount" fill="#7C5CF5" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="glass-card p-5">
            <h3 className="mb-4 font-display font-semibold">{t("loanStatisticsChart")}</h3>
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={data?.charts.loanStatistics ?? []}
                  dataKey="count"
                  nameKey="status"
                  innerRadius={55}
                  outerRadius={85}
                  paddingAngle={4}
                >
                  {(data?.charts.loanStatistics ?? []).map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="glass-card p-5 lg:col-span-3">
            <h3 className="mb-4 font-display font-semibold">{t("savingsGrowthChart")}</h3>
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={data?.charts.savingsGrowth ?? []}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,148,170,0.15)" />
                <XAxis dataKey="month" fontSize={12} />
                <YAxis fontSize={12} />
                <Tooltip formatter={(v: number) => currency(v)} />
                <Line type="monotone" dataKey="amount" stroke="#3B82F6" strokeWidth={3} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </main>
    </>
  );
}
