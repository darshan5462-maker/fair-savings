"use client";

import { useEffect, useState } from "react";
import { BellIcon } from "@heroicons/react/24/outline";
import { Navbar } from "@/components/Navbar";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/i18n/LanguageContext";
import { api } from "@/lib/api";

interface Notification {
  id: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

export default function MemberNotificationsPage() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [items, setItems] = useState<Notification[]>([]);

  useEffect(() => {
    if (!user) return;
    api.get(`/notifications/member/${user.id}`).then((res) => setItems(res.data.data));
  }, [user]);

  return (
    <>
      <Navbar title={t("notifications")} />
      <main className="space-y-3 p-6">
        {items.length === 0 && <p className="text-sm text-ink-500">{t("noDataFound")}</p>}
        {items.map((n) => (
          <div key={n.id} className="glass-card flex gap-3 p-4">
            <BellIcon className="h-5 w-5 shrink-0 text-brand-500" />
            <div>
              <div className="font-medium">{n.title}</div>
              <div className="text-sm text-ink-500 dark:text-ink-300">{n.message}</div>
              <div className="mt-1 text-xs text-ink-500">{new Date(n.createdAt).toLocaleString()}</div>
            </div>
          </div>
        ))}
      </main>
    </>
  );
}
