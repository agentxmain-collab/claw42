"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useI18n } from "@/i18n/I18nProvider";
import { trackEvent } from "@/lib/analytics";

export function AnalyticsPageView() {
  const pathname = usePathname();
  const { locale } = useI18n();

  useEffect(() => {
    trackEvent("page_view", { locale });
  }, [locale, pathname]);

  return null;
}
