"use client";

import { useI18n } from "./I18nProvider";

export function LanguageSwitcher() {
  const { locale, setLocale, t } = useI18n();
  const nextLabel = locale === "zh" ? t.nav.switchLangToEn : t.nav.switchLangToZh;

  return (
    <button
      onClick={() => setLocale(locale === "zh" ? "en" : "zh")}
      className="fixed top-5 right-5 z-50 w-11 h-11 rounded-full bg-white/10 backdrop-blur-md border border-white/20 hover:bg-white/20 hover:scale-105 transition-all text-white text-sm font-semibold flex items-center justify-center shadow-lg"
      aria-label="Switch language"
    >
      {nextLabel}
    </button>
  );
}
