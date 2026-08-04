"use client";

import { MagnifyingGlassIcon, SunIcon, MoonIcon, LanguageIcon } from "@heroicons/react/24/outline";
import { useTheme } from "@/contexts/ThemeContext";
import { useLanguage } from "@/i18n/LanguageContext";

export function Navbar({ title, onSearch }: { title: string; onSearch?: (v: string) => void }) {
  const { theme, toggleTheme } = useTheme();
  const { locale, setLocale, t } = useLanguage();

  return (
    <header className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-ink-900/5 bg-surface-light/80 px-6 py-4 backdrop-blur-xl dark:border-white/5 dark:bg-surface-dark/80">
      <h1 className="font-display text-xl font-bold">{title}</h1>

      <div className="flex flex-1 items-center justify-end gap-3">
        {onSearch && (
          <div className="relative hidden w-64 sm:block">
            <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-500" />
            <input
              className="input-field pl-9"
              placeholder={t("search")}
              onChange={(e) => onSearch(e.target.value)}
            />
          </div>
        )}
        <button
          onClick={() => setLocale(locale === "en" ? "kn" : "en")}
          className="flex items-center gap-1.5 rounded-full border border-ink-900/10 px-3 py-1.5 text-xs font-semibold dark:border-white/10"
        >
          <LanguageIcon className="h-4 w-4" /> {locale === "en" ? "ಕನ್ನಡ" : "EN"}
        </button>
        <button
          onClick={toggleTheme}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-ink-900/10 dark:border-white/10"
        >
          {theme === "light" ? <MoonIcon className="h-4 w-4" /> : <SunIcon className="h-4 w-4" />}
        </button>
      </div>
    </header>
  );
}
