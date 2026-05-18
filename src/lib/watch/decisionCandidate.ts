import type { Locale } from "@/i18n/types";
import type { TopicSelectionReason } from "@/lib/team/topicSelector";

export type CandidateType = "symbol" | "market_overview" | "hotspot";

export type DecisionCandidateCadence = "daily" | "intraday" | "event";

export interface DecisionCandidate {
  candidateType: CandidateType;
  candidateKey: string;
  symbol?: string;
  displayTitle: string;
  executable: boolean;
  cadence: DecisionCandidateCadence;
  score: number;
  reasons: TopicSelectionReason[];
}

export interface DecisionCandidateOrderKey {
  candidateType?: CandidateType | null;
  candidateKey?: string | null;
  recordId?: string | null;
  symbol?: string | null;
  score?: number | null;
  lastUpdatedAt?: number | string | null;
}

export const CANDIDATE_TYPE_PRIORITY: Record<CandidateType, number> = {
  market_overview: 0,
  hotspot: 1,
  symbol: 2,
};

export function normalizeCandidateType(value: unknown): CandidateType {
  return value === "market_overview" || value === "hotspot" || value === "symbol"
    ? value
    : "symbol";
}

export function normalizeCandidateKey(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

export function normalizeCandidateSymbol(value: unknown) {
  if (typeof value !== "string") return null;
  const symbol = value.trim().replace(/^\$+/, "").toUpperCase();
  return symbol && symbol !== "UNKNOWN" ? symbol : null;
}

export function candidateDayKey(ts: number) {
  return Number.isFinite(ts) ? new Date(ts).toISOString().slice(0, 10) : "unknown-date";
}

function utc8CandidateDayKey(ts: number) {
  const UTC8_OFFSET_MS = 8 * 60 * 60 * 1000;
  return Number.isFinite(ts)
    ? new Date(ts + UTC8_OFFSET_MS).toISOString().slice(0, 10)
    : "unknown-date";
}

function dateKeyFromCandidateKey(candidateKey: string | null | undefined) {
  const match = candidateKey?.match(/\d{4}-\d{2}-\d{2}/);
  return match?.[0] ?? null;
}

export function compareDecisionCandidateOrder(
  left: DecisionCandidateOrderKey,
  right: DecisionCandidateOrderKey,
) {
  const typeDelta =
    CANDIDATE_TYPE_PRIORITY[normalizeCandidateType(left.candidateType)] -
    CANDIDATE_TYPE_PRIORITY[normalizeCandidateType(right.candidateType)];
  if (typeDelta !== 0) return typeDelta;

  const scoreDelta = finiteScore(right.score) - finiteScore(left.score);
  if (scoreDelta !== 0) return scoreDelta;

  const timeDelta =
    parseLastUpdatedAt(right.lastUpdatedAt) - parseLastUpdatedAt(left.lastUpdatedAt);
  if (timeDelta !== 0) return timeDelta;

  return candidateTieBreaker(left).localeCompare(candidateTieBreaker(right));
}

export function decisionCandidateDedupeKey({
  locale,
  candidateType,
  candidateKey,
  symbol,
  recordId,
  ts,
}: {
  locale: Locale;
  candidateType?: CandidateType | null;
  candidateKey?: string | null;
  symbol?: string | null;
  recordId?: string | null;
  ts: number;
}) {
  const type = normalizeCandidateType(candidateType);
  if (type === "symbol") {
    const normalizedSymbol = normalizeCandidateSymbol(symbol);
    return normalizedSymbol ? `${locale}:${normalizedSymbol}` : null;
  }

  if (type === "market_overview") {
    return `${locale}:market_overview:${dateKeyFromCandidateKey(candidateKey) ?? utc8CandidateDayKey(ts)}`;
  }

  const key = normalizeCandidateKey(candidateKey) ?? normalizeCandidateSymbol(symbol) ?? recordId;
  return key ? `${locale}:hotspot:${key}` : null;
}

function finiteScore(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function parseLastUpdatedAt(value: DecisionCandidateOrderKey["lastUpdatedAt"]) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return 0;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function candidateTieBreaker(key: DecisionCandidateOrderKey) {
  return [
    normalizeCandidateKey(key.candidateKey) ?? "",
    normalizeCandidateKey(key.recordId) ?? "",
    normalizeCandidateSymbol(key.symbol) ?? "",
  ].join(":");
}
