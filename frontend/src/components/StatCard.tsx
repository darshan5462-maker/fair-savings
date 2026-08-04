"use client";

import { motion } from "framer-motion";
import { clsx } from "clsx";

interface StatCardProps {
  label: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
  tone?: "brand" | "success" | "warning" | "danger";
  delay?: number;
}

const toneMap = {
  brand: "bg-brand-gradient text-white",
  success: "bg-success/10 text-success",
  warning: "bg-warning/10 text-warning",
  danger: "bg-danger/10 text-danger",
};

export function StatCard({ label, value, icon: Icon, tone = "brand", delay = 0 }: StatCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
      className="stat-card"
    >
      <div className={clsx("flex h-10 w-10 items-center justify-center rounded-xl", toneMap[tone])}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="mt-1 font-display text-2xl font-bold tabular-nums">{value}</div>
      <div className="text-sm text-ink-500 dark:text-ink-300">{label}</div>
    </motion.div>
  );
}
