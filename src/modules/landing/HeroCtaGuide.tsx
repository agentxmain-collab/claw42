"use client";

import React from "react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { Locale } from "@/i18n/types";
import { withBasePath } from "@/lib/basePath";

const STORAGE_KEY = "hero-cta-guide-shown";
const DISMISS_DELAY_MS = 5000;

export function HeroCtaGuide({ locale }: { locale: Locale }) {
  const [visible, setVisible] = useState(true);

  const dismiss = useCallback(() => {
    try {
      window.sessionStorage.setItem(STORAGE_KEY, "1");
    } catch {
      // Storage can be unavailable in private or embedded contexts; hiding locally is enough.
    }
    setVisible(false);
  }, []);

  useEffect(() => {
    try {
      if (window.sessionStorage.getItem(STORAGE_KEY) === "1") {
        setVisible(false);
        return;
      }
    } catch {
      // Keep the guide visible if storage cannot be read.
    }

    const timeoutId = window.setTimeout(dismiss, DISMISS_DELAY_MS);
    return () => window.clearTimeout(timeoutId);
  }, [dismiss]);

  if (!visible) return null;

  return (
    <div className="bg-black/28 fixed inset-0 z-[90]" onClick={dismiss} role="presentation">
      <Link
        href={withBasePath(`/${locale}/agent`)}
        onClick={() => {
          try {
            window.sessionStorage.setItem(STORAGE_KEY, "1");
          } catch {
            // Navigation is the primary action; storage is only a repeat guard.
          }
        }}
        className="absolute left-1/2 top-[58vh] -translate-x-1/2 rounded-xl bg-[#6C4FFF] px-6 py-4 text-sm font-bold text-white shadow-[0_18px_60px_rgba(108,79,255,0.42)] transition-transform hover:scale-[1.02]"
      >
        点击查看实时分析 <span aria-hidden="true">→</span>
      </Link>
    </div>
  );
}
