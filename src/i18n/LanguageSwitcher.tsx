"use client";

import Image from "next/image";
import { useI18n } from "./I18nProvider";

export function TopBar() {
  const { locale, setLocale, t } = useI18n();
  const nextLabel = locale === "zh" ? t.nav.switchLangToEn : t.nav.switchLangToZh;

  return (
    <div className="w-full flex items-center justify-between px-6 md:px-12 lg:px-20 py-5">
      {/* Logo */}
      <a href="/" className="shrink-0">
        <Image
          src="/images/claw42-logo-trimmed.png"
          alt="Claw 42"
          width={120}
          height={26}
          className="h-6 md:h-7 w-auto brightness-100"
          priority
        />
      </a>

      {/* Language toggle */}
      <button
        onClick={() => setLocale(locale === "zh" ? "en" : "zh")}
        className="w-10 h-10 rounded-full bg-white/10 border border-white/20 hover:bg-white/20 hover:scale-105 transition-all text-white text-xs font-semibold flex items-center justify-center"
        aria-label="Switch language"
      >
        {nextLabel}
      </button>
    </div>
  );
}
