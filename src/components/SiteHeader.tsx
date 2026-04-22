"use client";

import Image from "next/image";
import { useI18n } from "@/i18n/I18nProvider";
import { LOCALES, LOCALE_LABELS } from "@/i18n/locales";
import type { Locale } from "@/i18n/types";

export function SiteHeader() {
  const { locale, switchLocale } = useI18n();

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 h-[72px] bg-black/80 backdrop-blur-xl border-b border-white/[0.06]">
      <div className="max-w-[1440px] mx-auto h-full flex items-center justify-between px-6 md:px-10 lg:px-16">
        <a href={`/${locale}`} className="flex items-center gap-3 shrink-0">
          <Image
            src="/images/brand/claw42-horizontal.png"
            alt="Claw 42"
            width={270}
            height={90}
            priority
            className="h-7 md:h-8 w-auto object-contain"
          />
        </a>

        <label className="relative" aria-label="Select language">
          <select
            value={locale}
            onChange={(e) => switchLocale(e.target.value as Locale)}
            className="appearance-none h-11 pl-4 pr-9 rounded-full bg-white/[0.08] border border-white/[0.12] hover:bg-white/[0.15] transition-all text-white/90 hover:text-white text-sm font-semibold cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#7c5cff]/50"
          >
            {LOCALES.map((l) => (
              <option key={l} value={l} className="bg-[#111] text-white">
                {LOCALE_LABELS[l].native}
              </option>
            ))}
          </select>
          <svg
            className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/70"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </label>
      </div>
    </nav>
  );
}
