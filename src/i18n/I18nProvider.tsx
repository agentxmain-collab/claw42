"use client";

import { createContext, useCallback, useContext, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { localeCookiePath, stripBasePathFromPathname } from "@/lib/basePath";
import { DICTS } from "./dictRegistry";
import { LOCALES } from "./locales";
import type { Dict, Locale } from "./types";

interface I18nContextValue {
  locale: Locale;
  t: Dict;
  switchLocale: (next: Locale) => void;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({
  children,
  initialLocale,
}: {
  children: ReactNode;
  initialLocale: Locale;
}) {
  const router = useRouter();
  const pathname = usePathname();

  const switchLocale = useCallback(
    (next: Locale) => {
      document.cookie = `claw42-locale=${next}; path=${localeCookiePath()}; max-age=${60 * 60 * 24 * 365}; samesite=lax`;

      const segments = stripBasePathFromPathname(pathname).split("/").filter(Boolean);
      if (segments.length > 0 && (LOCALES as readonly string[]).includes(segments[0])) {
        segments[0] = next;
      } else {
        segments.unshift(next);
      }

      router.push("/" + segments.join("/"));
    },
    [pathname, router],
  );

  return (
    <I18nContext.Provider
      value={{
        locale: initialLocale,
        t: DICTS[initialLocale],
        switchLocale,
      }}
    >
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}
