"use client";

import { useState } from "react";
import { toast } from "sonner";
import { BellAlertIcon } from "@heroicons/react/24/outline";
import { Navbar } from "@/components/Navbar";
import { useLanguage } from "@/i18n/LanguageContext";
import { api } from "@/lib/api";

export default function NotificationsPage() {
  const { t } = useLanguage();
  const [form, setForm] = useState({ type: "WEEKLY_REMINDER", title: "", message: "" });
  const [memberIds, setMemberIds] = useState("");
  const [sending, setSending] = useState(false);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const ids = memberIds.split(",").map((s) => s.trim()).filter(Boolean);
    if (ids.length === 0) return toast.error("Enter at least one member ID");
    setSending(true);
    try {
      const { data } = await api.post("/notifications/broadcast", { memberIds: ids, ...form });
      toast.success(`Sent to ${data.count} member(s)`);
      setForm({ ...form, title: "", message: "" });
    } catch {
      toast.error("Could not send notifications");
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <Navbar title={t("notifications")} />
      <main className="p-6">
        <form onSubmit={handleSend} className="glass-card max-w-lg space-y-3 p-6">
          <div className="flex items-center gap-2 font-display font-semibold">
            <BellAlertIcon className="h-5 w-5 text-brand-500" /> Send Reminder
          </div>
          <select className="input-field" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
            <option value="WEEKLY_REMINDER">Upcoming Friday Reminder</option>
            <option value="LOAN_REMINDER">Loan Reminder</option>
            <option value="PENALTY_REMINDER">Penalty Reminder</option>
            <option value="SETTLEMENT_REMINDER">Settlement Reminder</option>
            <option value="GENERAL">General</option>
          </select>
          <input required placeholder="Title" className="input-field" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          <textarea required placeholder="Message" rows={3} className="input-field" value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} />
          <input
            required
            placeholder="Member IDs, comma-separated"
            className="input-field"
            value={memberIds}
            onChange={(e) => setMemberIds(e.target.value)}
          />
          <button type="submit" disabled={sending} className="btn-primary w-full">
            {sending ? t("loading") : "Send"}
          </button>
        </form>
      </main>
    </>
  );
}
