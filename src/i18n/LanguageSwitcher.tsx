"use client";

import { useI18n } from "./I18nProvider";

export function TopBar() {
  const { locale, setLocale, t } = useI18n();
  const nextLabel = locale === "zh" ? t.nav.switchLangToEn : t.nav.switchLangToZh;

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 h-16 bg-black/80 backdrop-blur-xl border-b border-white/[0.06]">
      <div className="max-w-[1440px] mx-auto h-full flex items-center justify-between px-6 md:px-10 lg:px-16">
        {/* Logo */}
        <a href="/" className="flex items-center gap-2.5 shrink-0 group">
          <div className="w-8 h-8 rounded-full bg-[#6c4fff] flex items-center justify-center text-white font-bold text-sm">
            C
          </div>
          <span className="text-white font-semibold text-[15px] tracking-tight">
            Claw 42
          </span>
        </a>

        {/* Language toggle */}
        <button
          onClick={() => setLocale(locale === "zh" ? "en" : "zh")}
          className="w-9 h-9 rounded-full bg-white/[0.08] border border-white/[0.12] hover:bg-white/[0.15] transition-all text-white/70 hover:text-white text-xs font-medium flex items-center justify-center"
          aria-label="Switch language"
        >
          {nextLabel}
        </button>
      </div>
    </nav>
  );
}
