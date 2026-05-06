"use client";

import Image from "next/image";
import { useI18n } from "@/i18n/I18nProvider";
import { LocaleDropdown } from "./LocaleDropdown";

export function SiteHeader() {
  const { locale, t } = useI18n();

  return (
    <nav className="fixed top-0 left-0 right-0 z-[80] h-[72px] bg-black/80 backdrop-blur-xl border-b border-white/[0.06]">
      <div className="max-w-[1440px] mx-auto h-full flex items-center justify-between px-6 md:px-10 lg:px-16">
        <a href={`/${locale}`} className="flex items-center gap-3 shrink-0">
          {/*
           * 双层叠加：底层完整 logo（深灰线条 + 蓝色），顶层仅蓝色像素分离版加 drop-shadow 呼吸。
           * glow 只从眼睛/嘴/42 这些蓝色部分发出，深灰线条不参与发光。
           * 蓝色版 PNG 由色彩分离脚本生成（B > R+15 且 B > G+15）。
           */}
          <span className="relative inline-block h-14 md:h-[60px] lg:h-16">
            <Image
              src="/images/brand/claw42-horizontal.png"
              alt="Claw 42"
              width={270}
              height={90}
              priority
              className="relative h-full w-auto object-contain"
            />
            <Image
              src="/images/brand/claw42-horizontal-blue.png"
              alt=""
              aria-hidden="true"
              width={270}
              height={90}
              priority
              className="claw42-blue-breathe pointer-events-none absolute inset-0 h-full w-auto object-contain"
            />
          </span>
        </a>

        <div className="flex items-center gap-3">
          <a
            href={`/${locale}/agent`}
            className="hidden h-11 items-center rounded-full px-4 text-sm font-semibold text-white/80 transition-all hover:bg-white/[0.08] hover:text-white md:inline-flex"
          >
            <span className="relative flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-cw-green animate-pulse" />
              {t.nav.agentLiveMenuItem}
            </span>
          </a>
          <LocaleDropdown />
        </div>
      </div>
    </nav>
  );
}
