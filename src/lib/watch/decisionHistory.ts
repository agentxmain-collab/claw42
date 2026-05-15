import type { Locale } from "@/i18n/types";
import type { DecisionOutcome, StrategyDecisionRecord } from "@/lib/team/strategyDecisionRecord";

export interface DecisionHistoryItem {
  recordId: string;
  symbol: string;
  createdAt: string;
  resolvedAt: string | null;
  outcome: DecisionOutcome;
  direction: "long" | "short" | "wait" | "neutral";
  intensity: number;
  confidence: number;
  entry: string;
  stopLoss: string;
  takeProfit: string;
}

export interface DecisionHistoryPayload {
  symbol: string;
  locale: Locale;
  items: DecisionHistoryItem[];
  hasMore: boolean;
  nextBefore: string | null;
}

const MAX_INTENSITY = 100;
const MIN_SYMBOL_LENGTH = 2;
const MAX_SYMBOL_LENGTH = 20;

export function normalizeDecisionHistorySymbol(value: string | null): string | null {
  if (!value) return null;
  const normalized = value.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  const withoutQuote = normalized.endsWith("USDT") ? normalized.slice(0, -4) : normalized;
  if (
    withoutQuote.length < MIN_SYMBOL_LENGTH ||
    withoutQuote.length > MAX_SYMBOL_LENGTH ||
    !/^[A-Z0-9]+$/.test(withoutQuote)
  ) {
    return null;
  }
  return withoutQuote;
}

export function buildDecisionHistoryPayload({
  symbol,
  locale,
  records,
  limit,
  before,
}: {
  symbol: string;
  locale: Locale;
  records: StrategyDecisionRecord[];
  limit: number;
  before?: string | null;
}): DecisionHistoryPayload {
  const beforeTs = before ? Date.parse(before) : Number.POSITIVE_INFINITY;
  const filtered = records
    .filter((record) => record.symbol === symbol)
    .filter((record) => {
      const createdAt = Date.parse(record.createdAt);
      return Number.isFinite(createdAt) && createdAt < beforeTs;
    })
    .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt));
  const page = filtered.slice(0, limit);

  return {
    symbol,
    locale,
    items: page.map(recordToDecisionHistoryItem),
    hasMore: filtered.length > limit,
    nextBefore: filtered.length > limit ? (page.at(-1)?.createdAt ?? null) : null,
  };
}

function recordToDecisionHistoryItem(record: StrategyDecisionRecord): DecisionHistoryItem {
  const tradeDecision = record.tradeDecision;
  const confidence =
    tradeDecision?.confidence ??
    average(record.analystInputs.map((input) => input.confidence)) ??
    0;

  return {
    recordId: record.id,
    symbol: record.symbol,
    createdAt: record.createdAt,
    resolvedAt: record.resolvedAt,
    outcome: record.resolvedOutcome,
    direction:
      tradeDecision?.direction ??
      record.analystInputs[0]?.direction ??
      (record.resolvedOutcome ? "neutral" : "wait"),
    intensity: computeDecisionIntensity(record),
    confidence,
    entry: formatNullableNumber(tradeDecision?.entryPrice),
    stopLoss: formatNullableNumber(tradeDecision?.stopLoss),
    takeProfit: tradeDecision?.takeProfit.length
      ? tradeDecision.takeProfit.map(formatNullableNumber).join(" / ")
      : "-",
  };
}

function computeDecisionIntensity(record: StrategyDecisionRecord) {
  const confidence =
    record.tradeDecision?.confidence ??
    average(record.analystInputs.map((input) => input.confidence)) ??
    0.5;
  const rating = record.tradeDecision?.rating ?? 3;
  const resolvedBoost = record.resolvedOutcome ? 8 : 0;
  return Math.min(
    MAX_INTENSITY,
    Math.max(0, Math.round(confidence * 68 + (rating / 5) * 24 + resolvedBoost)),
  );
}

function average(values: number[]) {
  const valid = values.filter((value) => Number.isFinite(value));
  if (valid.length === 0) return null;
  return valid.reduce((sum, value) => sum + value, 0) / valid.length;
}

function formatNullableNumber(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "-";
  return Number.isInteger(value)
    ? String(value)
    : value.toFixed(4).replace(/0+$/, "").replace(/\.$/, "");
}
