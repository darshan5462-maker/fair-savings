"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Navbar } from "@/components/Navbar";
import { useLanguage } from "@/i18n/LanguageContext";
import { api } from "@/lib/api";

interface Settings {
  collectionDay: string;
  loanInterestRate: number;
  penaltyRate: number;
  loanDurationWeeks: number;
  currency: string;
  savingsStartDate: string | null;
}

export default function SettingsPage() {
  const { t } = useLanguage();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get("/settings").then((res) => setSettings(res.data.data));
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!settings) return;
    setSaving(true);
    try {
      await api.put("/settings", settings);
      toast.success("Settings updated");
    } catch {
      toast.error("Could not save settings");
    } finally {
      setSaving(false);
    }
  }

  if (!settings) {
    return (
      <>
        <Navbar title={t("settings")} />
        <main className="p-6">
          <div className="skeleton h-64 max-w-lg rounded-xl2" />
        </main>
      </>
    );
  }

  return (
    <>
      <Navbar title={t("settings")} />
      <main className="p-6">
        <form onSubmit={handleSave} className="glass-card max-w-lg space-y-4 p-6">
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase text-ink-500">Collection Day</label>
            <select className="input-field" value={settings.collectionDay} onChange={(e) => setSettings({ ...settings, collectionDay: e.target.value })}>
              {["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"].map((d) => (
                <option key={d}>{d}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase text-ink-500">Savings Scheme Start Date</label>
            <input
              type="date"
              className="input-field"
              value={settings.savingsStartDate ? settings.savingsStartDate.slice(0, 10) : ""}
              onChange={(e) => setSettings({ ...settings, savingsStartDate: e.target.value ? new Date(e.target.value).toISOString() : null })}
            />
            <p className="mt-1 text-xs text-ink-500">
              The date Week 1 collection began for everyone. Every member's weekly due dates count forward from
              here, not from when they were individually added to the system.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase text-ink-500">Loan Interest %</label>
              <input type="number" className="input-field" value={settings.loanInterestRate} onChange={(e) => setSettings({ ...settings, loanInterestRate: Number(e.target.value) })} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase text-ink-500">Penalty %</label>
              <input type="number" className="input-field" value={settings.penaltyRate} onChange={(e) => setSettings({ ...settings, penaltyRate: Number(e.target.value) })} />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase text-ink-500">Loan Duration (weeks)</label>
            <input type="number" className="input-field" value={settings.loanDurationWeeks} onChange={(e) => setSettings({ ...settings, loanDurationWeeks: Number(e.target.value) })} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase text-ink-500">Currency</label>
            <input className="input-field" value={settings.currency} onChange={(e) => setSettings({ ...settings, currency: e.target.value })} />
          </div>
          <button type="submit" disabled={saving} className="btn-primary w-full">
            {saving ? t("loading") : t("save")}
          </button>
        </form>
      </main>
    </>
  );
}
