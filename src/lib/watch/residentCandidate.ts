import { resolveSymbolMapping } from "@/lib/team/symbolMapping";
import type { TopicSelectionReason } from "@/lib/team/topicSelector";
import type { Locale } from "@/i18n/types";
import type { DecisionCandidate } from "@/lib/watch/decisionCandidate";

const UTC8_OFFSET_MS = 8 * 60 * 60 * 1000;
const HOTSPOT_WINDOW_HOURS = 8;

export const MARKET_OVERVIEW_STORAGE_SYMBOL = "MARKET";
export const HOTSPOT_STORAGE_SYMBOL = "HOTSPOT";

const MARKET_OVERVIEW_TITLES: Record<Locale, string> = {
  en_US: "Market overview",
  ja_JP: "マーケット概況",
  zh_TW: "今日大盤綜述",
  zh_CN: "今日大盘综述",
  ru_RU: "Обзор рынка",
  uk_UA: "Огляд ринку",
  fr_FR: "Vue d'ensemble du marché",
  es_ES: "Panorama del mercado",
  ar_SA: "نظرة عامة على السوق",
  en_XA: "Market overview",
};

const HOTSPOT_TITLES: Record<Locale, string> = {
  en_US: "Narrative watch",
  ja_JP: "注目テーマ",
  zh_TW: "熱點敘事追蹤",
  zh_CN: "热点叙事追踪",
  ru_RU: "Мониторинг нарратива",
  uk_UA: "Моніторинг наративу",
  fr_FR: "Suivi des thèmes",
  es_ES: "Seguimiento narrativo",
  ar_SA: "متابعة السرديات",
  en_XA: "Narrative watch",
};

export function utc8DayKey(ts: number) {
  return new Date(ts + UTC8_OFFSET_MS).toISOString().slice(0, 10);
}

export function utc8HourWindowKey(ts: number, windowHours = HOTSPOT_WINDOW_HOURS) {
  const shifted = ts + UTC8_OFFSET_MS;
  const hour = new Date(shifted).getUTCHours();
  const bucket = Math.floor(hour / windowHours) * windowHours;
  return `${utc8DayKey(ts)}T${String(bucket).padStart(2, "0")}`;
}

export function normalizePipelineSymbol(value: string | undefined | null) {
  const symbol = value
    ?.trim()
    .replace(/^\$+/, "")
    .replace(/_?USDT$/i, "")
    .toUpperCase();
  return symbol && symbol !== "UNKNOWN" ? symbol : null;
}

export function symbolDecisionCandidate({
  symbol,
  score = 0,
  reasons = [],
}: {
  symbol: string;
  score?: number;
  reasons?: TopicSelectionReason[];
}): DecisionCandidate | null {
  const normalized = normalizePipelineSymbol(symbol);
  if (!normalized) return null;
  return {
    candidateType: "symbol",
    candidateKey: normalized,
    symbol: normalized,
    displayTitle: `${normalized} 实时行情分析`,
    executable: resolveSymbolMapping(normalized).execution.executable,
    cadence: "event",
    score,
    reasons,
  };
}

export function marketOverviewCandidate({
  locale,
  now,
  score = 100,
  reasons = [],
}: {
  locale: Locale;
  now: number;
  score?: number;
  reasons?: TopicSelectionReason[];
}): DecisionCandidate {
  return {
    candidateType: "market_overview",
    candidateKey: `market_overview:${locale}:${utc8DayKey(now)}`,
    displayTitle: MARKET_OVERVIEW_TITLES[locale] ?? MARKET_OVERVIEW_TITLES.en_US,
    executable: false,
    cadence: "daily",
    score,
    reasons,
  };
}

export function hotspotDecisionCandidate({
  locale,
  now,
  candidateKey,
  displayTitle,
  symbol,
  executable,
  score = 80,
  reasons = [],
}: {
  locale: Locale;
  now: number;
  candidateKey?: string | null;
  displayTitle?: string | null;
  symbol?: string | null;
  executable?: boolean;
  score?: number;
  reasons?: TopicSelectionReason[];
}): DecisionCandidate {
  const normalizedSymbol = normalizePipelineSymbol(symbol);
  const resolvedKey =
    candidateKey?.trim() ||
    (normalizedSymbol
      ? `hotspot:${locale}:${utc8HourWindowKey(now)}:${normalizedSymbol}`
      : `hotspot:${locale}:${utc8HourWindowKey(now)}:market`);
  return {
    candidateType: "hotspot",
    candidateKey: resolvedKey,
    ...(normalizedSymbol ? { symbol: normalizedSymbol } : {}),
    displayTitle:
      displayTitle?.trim() ||
      (normalizedSymbol
        ? `${normalizedSymbol} ${HOTSPOT_TITLES[locale] ?? HOTSPOT_TITLES.en_US}`
        : (HOTSPOT_TITLES[locale] ?? HOTSPOT_TITLES.en_US)),
    executable:
      typeof executable === "boolean"
        ? executable
        : normalizedSymbol
          ? resolveSymbolMapping(normalizedSymbol).execution.executable
          : false,
    cadence: "intraday",
    score,
    reasons,
  };
}

export function isTradeDisabledCandidate(candidate: DecisionCandidate) {
  if (candidate.candidateType === "market_overview") return true;
  return candidate.candidateType === "hotspot" && (!candidate.executable || !candidate.symbol);
}

export function storageSymbolForCandidate(candidate: DecisionCandidate) {
  if (candidate.symbol) return candidate.symbol;
  if (candidate.candidateType === "market_overview") return MARKET_OVERVIEW_STORAGE_SYMBOL;
  return HOTSPOT_STORAGE_SYMBOL;
}
