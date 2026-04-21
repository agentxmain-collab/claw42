import type { Locale } from "./types";

export const LOCALES = [
  "zh_CN",
  "zh_TW",
  "en_US",
  "ru_RU",
  "uk_UA",
  "ja_JP",
  "fr_FR",
  "es_ES",
  "ar_SA",
  "en_XA",
] as const;

export const DEFAULT_LOCALE: Locale = "en_US";

export const RTL_LOCALES: ReadonlySet<Locale> = new Set<Locale>(["ar_SA"]);

export const HTML_LANG: Record<Locale, string> = {
  zh_CN: "zh-CN",
  zh_TW: "zh-TW",
  en_US: "en-US",
  ru_RU: "ru-RU",
  uk_UA: "uk-UA",
  ja_JP: "ja-JP",
  fr_FR: "fr-FR",
  es_ES: "es-ES",
  ar_SA: "ar-SA",
  en_XA: "en",
};

export const LOCALE_LABELS: Record<Locale, { en: string; native: string }> = {
  zh_CN: { en: "Chinese (Simplified)", native: "简体中文" },
  zh_TW: { en: "Chinese (Traditional)", native: "繁體中文" },
  en_US: { en: "English", native: "English" },
  ru_RU: { en: "Russian", native: "Русский" },
  uk_UA: { en: "Ukrainian", native: "Українська" },
  ja_JP: { en: "Japanese", native: "日本語" },
  fr_FR: { en: "French", native: "Français" },
  es_ES: { en: "Spanish", native: "Español" },
  ar_SA: { en: "Arabic", native: "العربية" },
  en_XA: { en: "English (East Asia)", native: "English (EA)" },
};

export function isLocale(x: string): x is Locale {
  return (LOCALES as readonly string[]).includes(x);
}

export function matchLocale(acceptLanguage: string | null): Locale {
  if (!acceptLanguage) return DEFAULT_LOCALE;

  const prefs = acceptLanguage
    .split(",")
    .map((s) => s.trim().split(";")[0].toLowerCase());

  for (const pref of prefs) {
    const normalized = pref.replace("-", "_");
    for (const locale of LOCALES) {
      if (locale.toLowerCase() === normalized) return locale;
    }

    const primary = pref.split("-")[0];
    const primaryMap: Record<string, Locale> = {
      zh: "zh_CN",
      en: "en_US",
      ru: "ru_RU",
      uk: "uk_UA",
      ja: "ja_JP",
      fr: "fr_FR",
      es: "es_ES",
      ar: "ar_SA",
    };

    if (primaryMap[primary]) return primaryMap[primary];
  }

  return DEFAULT_LOCALE;
}
