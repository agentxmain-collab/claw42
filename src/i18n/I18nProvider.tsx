"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import zh from "./zh.json";
import en from "./en.json";
import type { Dict, Locale } from "./types";

const DICTS: Record<Locale, Dict> = {
  zh: zh as Dict,
  en: en as Dict,
};

interface I18nContextValue {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: Dict;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("zh");

  // 客户端挂载后从 localStorage 读取
  useEffect(() => {
    const saved = localStorage.getItem("claw42-locale");
    if (saved === "zh" || saved === "en") {
      setLocaleState(saved);
      document.documentElement.lang = saved === "zh" ? "zh-CN" : "en";
    }
  }, []);

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    localStorage.setItem("claw42-locale", l);
    document.documentElement.lang = l === "zh" ? "zh-CN" : "en";
  }, []);

  return (
    <I18nContext.Provider value={{ locale, setLocale, t: DICTS[locale] }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}
