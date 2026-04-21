"use client";

import Image from "next/image";
import { useI18n } from "@/i18n/I18nProvider";

export function SiteHeader() {
  const { locale, setLocale, t } = useI18n();
  const nextLabel = locale === "zh" ? t.nav.switchLangToEn : t.nav.switchLangToZh;

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 h-[72px] bg-black/80 backdrop-blur-xl border-b border-white/[0.06]">
      <div className="max-w-[1440px] mx-auto h-full flex items-center justify-between px-6 md:px-10 lg:px-16">
        {/* Logo */}
        <a href="/" className="flex items-center gap-3 shrink-0">
          <Image
            src="/images/claw42-logo-trimmed.png"
            alt="Claw 42"
            width={40}
            height={40}
            priority
            className="w-10 h-10 object-contain"
          />
          <span className="text-white font-semibold text-lg tracking-tight">
            Claw 42
          </span>
        </a>

        {/* Language toggle */}
        <button
          onClick={() => setLocale(locale === "zh" ? "en" : "zh")}
          className="w-11 h-11 rounded-full bg-white/[0.08] border border-white/[0.12] hover:bg-white/[0.15] transition-all text-white/80 hover:text-white text-sm font-semibold flex items-center justify-center"
          aria-label="Switch language"
        >
          {nextLabel}
        </button>
      </div>
    </nav>
  );
}
