"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { LockClosedIcon, UserIcon, SunIcon, MoonIcon, LanguageIcon } from "@heroicons/react/24/outline";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useLanguage } from "@/i18n/LanguageContext";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { login } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { locale, setLocale, t } = useLanguage();
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const user = await login(username, password);
      toast.success(`Welcome, ${user.name}`);
      router.push(user.role === "ADMIN" ? "/admin" : "/member");
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Invalid username or password");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="relative flex min-h-screen bg-mesh-light dark:bg-mesh-dark">
      {/* Top-right controls */}
      <div className="absolute right-6 top-6 z-10 flex items-center gap-2">
        <button
          onClick={() => setLocale(locale === "en" ? "kn" : "en")}
          className="flex items-center gap-1.5 rounded-full border border-ink-900/10 bg-white/70 px-3 py-1.5 text-xs font-semibold backdrop-blur dark:border-white/10 dark:bg-white/5 dark:text-white"
        >
          <LanguageIcon className="h-4 w-4" /> {locale === "en" ? "ಕನ್ನಡ" : "English"}
        </button>
        <button
          onClick={toggleTheme}
          className="flex h-8 w-8 items-center justify-center rounded-full border border-ink-900/10 bg-white/70 backdrop-blur dark:border-white/10 dark:bg-white/5"
        >
          {theme === "light" ? <MoonIcon className="h-4 w-4" /> : <SunIcon className="h-4 w-4 text-white" />}
        </button>
      </div>

      {/* Left: brand panel */}
      <div className="relative hidden w-1/2 flex-col justify-between overflow-hidden bg-brand-gradient p-12 text-white lg:flex">
        <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
          <div className="flex items-center gap-2 text-xl font-display font-bold">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/20 backdrop-blur">₹</span>
            {t("appName")}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.15 }}
          className="max-w-md"
        >
          <h1 className="font-display text-4xl font-extrabold leading-tight">{t("tagline")}</h1>
          <p className="mt-4 text-white/80">
            One payer, many accounts. Fair Savings lets a single family head settle weekly savings for every linked
            member in one screen — while each person's balance, loans, and history stay completely separate.
          </p>
        </motion.div>

        <div className="flex gap-6 text-sm text-white/70">
          <div>
            <div className="font-display text-2xl font-bold text-white">52</div>
            weekly cycle
          </div>
          <div>
            <div className="font-display text-2xl font-bold text-white">10%</div>
            loan interest
          </div>
          <div>
            <div className="font-display text-2xl font-bold text-white">31</div>
            districts ready
          </div>
        </div>

        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -left-10 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
      </div>

      {/* Right: login form */}
      <div className="flex w-full items-center justify-center px-6 lg:w-1/2">
        <motion.form
          onSubmit={handleSubmit}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="glass-card w-full max-w-sm p-8"
        >
          <div className="mb-1 flex items-center gap-2 font-display text-lg font-bold lg:hidden">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-gradient text-white">₹</span>
            {t("appName")}
          </div>
          <h2 className="mt-4 font-display text-2xl font-bold">{t("login")}</h2>
          <p className="mb-6 mt-1 text-sm text-ink-500 dark:text-ink-300">
            Sign in with the username and password provided by your admin.
          </p>

          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-ink-500 dark:text-ink-300">
            {t("username")}
          </label>
          <div className="relative mb-4">
            <UserIcon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-500" />
            <input
              className="input-field pl-10"
              placeholder="KD001"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </div>

          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-ink-500 dark:text-ink-300">
            {t("password")}
          </label>
          <div className="relative mb-6">
            <LockClosedIcon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-500" />
            <input
              type="password"
              className="input-field pl-10"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button type="submit" disabled={submitting} className="btn-primary w-full">
            {submitting ? `${t("loading")}` : t("loginButton")}
          </button>

          <p className="mt-6 text-center text-xs text-ink-500 dark:text-ink-300">
            Demo — Admin: admin / Admin@123 &nbsp;·&nbsp; Member: KD001 / Member@123
          </p>
        </motion.form>
      </div>
    </div>
  );
}
