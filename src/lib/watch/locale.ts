import type { Locale } from "@/i18n/types";
import { LOCALES, matchLocale } from "@/i18n/locales";

export const LEGACY_WATCH_LOCALE: Locale = "zh_CN";

const LOCALE_NAMES: Record<Locale, string> = {
  zh_CN: "Simplified Chinese",
  zh_TW: "Traditional Chinese",
  en_US: "English",
  ru_RU: "Russian",
  uk_UA: "Ukrainian",
  ja_JP: "Japanese",
  fr_FR: "French",
  es_ES: "Spanish",
  ar_SA: "Arabic",
  en_XA: "English",
};

const LOCALE_SCRIPT_HINTS: Record<Locale, string> = {
  zh_CN: "Use Simplified Chinese prose.",
  zh_TW: "Use Traditional Chinese prose.",
  en_US: "Use English prose.",
  ru_RU: "Use Russian prose.",
  uk_UA: "Use Ukrainian prose.",
  ja_JP: "Use Japanese prose.",
  fr_FR: "Use French prose.",
  es_ES: "Use Spanish prose.",
  ar_SA: "Use Arabic prose.",
  en_XA: "Use English prose.",
};

export function normalizeWatchLocale(
  value: unknown,
  fallback: Locale = LEGACY_WATCH_LOCALE,
): Locale {
  if (typeof value !== "string") return fallback;
  return (LOCALES as readonly string[]).includes(value) ? (value as Locale) : fallback;
}

export function localeFromRequestUrl(url: URL, acceptLanguage: string | null): Locale {
  const explicit = url.searchParams.get("locale");
  if (explicit) return normalizeWatchLocale(explicit);
  return matchLocale(acceptLanguage);
}

export function buildLocaleInstruction(locale: Locale): string {
  return [
    `Locale requirement: respond strictly in ${LOCALE_NAMES[locale]} (locale=${locale}).`,
    LOCALE_SCRIPT_HINTS[locale],
    "JSON keys must stay exactly as requested, but all natural-language values must use this locale.",
    "Ticker symbols, model/provider names, numbers, URLs, and evidence IDs may remain ASCII.",
  ].join(" ");
}

export function buildLocaleRetryInstruction(locale: Locale): string {
  return [
    "The previous output violated the locale requirement.",
    buildLocaleInstruction(locale),
    "Return corrected JSON only. Do not explain the correction.",
  ].join(" ");
}

export function textMatchesLocale(text: string, locale: Locale): boolean {
  const normalized = text
    .replace(/\$?[A-Z0-9_]{2,12}/g, " ")
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/ev_[a-z0-9]+/gi, " ")
    .replace(/[0-9.,:%+\-/$]+/g, " ")
    .trim();
  if (normalized.length === 0) return true;

  const hasHan = /[\u3400-\u9fff]/.test(normalized);
  const hasKana = /[\u3040-\u30ff]/.test(normalized);
  const hasCyrillic = /[\u0400-\u04ff]/.test(normalized);
  const hasArabic = /[\u0600-\u06ff]/.test(normalized);
  const hasLatin = /[A-Za-zÀ-ÿ]/.test(normalized);

  switch (locale) {
    case "zh_CN":
    case "zh_TW":
      return hasHan;
    case "ja_JP":
      return hasKana || hasHan;
    case "ru_RU":
    case "uk_UA":
      return hasCyrillic;
    case "ar_SA":
      return hasArabic;
    case "en_US":
    case "en_XA":
    case "fr_FR":
    case "es_ES":
      return hasLatin && !hasHan && !hasKana && !hasCyrillic && !hasArabic;
  }
}

export function allTextMatchesLocale(locale: Locale, fields: string[]): boolean {
  return fields.every((field) => textMatchesLocale(field, locale));
}
