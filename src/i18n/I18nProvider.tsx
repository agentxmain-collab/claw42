"use client";

import { createContext, useCallback, useContext, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { LOCALES } from "./locales";
import type { Dict, Locale } from "./types";

import ar_SA from "./dicts/ar_SA.json";
import en_US from "./dicts/en_US.json";
import en_XA from "./dicts/en_XA.json";
import es_ES from "./dicts/es_ES.json";
import fr_FR from "./dicts/fr_FR.json";
import ja_JP from "./dicts/ja_JP.json";
import ru_RU from "./dicts/ru_RU.json";
import uk_UA from "./dicts/uk_UA.json";
import zh_CN from "./dicts/zh_CN.json";
import zh_TW from "./dicts/zh_TW.json";

const DICTS: Record<Locale, Dict> = {
  zh_CN: zh_CN as Dict,
  zh_TW: zh_TW as Dict,
  en_US: en_US as Dict,
  ru_RU: ru_RU as Dict,
  uk_UA: uk_UA as Dict,
  ja_JP: ja_JP as Dict,
  fr_FR: fr_FR as Dict,
  es_ES: es_ES as Dict,
  ar_SA: ar_SA as Dict,
  en_XA: en_XA as Dict,
};

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
      document.cookie = `claw42-locale=${next}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;

      const segments = pathname.split("/").filter(Boolean);
      if (
        segments.length > 0 &&
        (LOCALES as readonly string[]).includes(segments[0])
      ) {
        segments[0] = next;
      } else {
        segments.unshift(next);
      }

      router.push("/" + segments.join("/"));
    },
    [pathname, router]
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
