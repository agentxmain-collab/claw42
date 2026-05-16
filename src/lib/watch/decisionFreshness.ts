import type { StrategyDecisionRecord } from "@/lib/team/strategyDecisionRecord";
import {
  normalizeCandidateKey,
  normalizeCandidateType,
  type CandidateType,
} from "@/lib/watch/decisionCandidate";
import type { PublicTimelineEvent } from "@/lib/watch/publicTimelineEvent";

export const WATCH_DECISION_FRESHNESS_MS = 15 * 60_000;

export type DecisionFreshnessSource = "records" | "timeline" | "none";

export interface DecisionFreshnessSnapshot {
  symbol: string;
  lastDecisionAt: string | null;
  lastDecisionAtMs: number | null;
  refreshSource: DecisionFreshnessSource;
  isFresh: boolean;
}

export function normalizeRefreshSymbol(symbol: string | null | undefined) {
  const normalized = symbol
    ?.trim()
    .replace(/^\$+/, "")
    .replace(/_?USDT$/i, "")
    .toUpperCase();
  return normalized && normalized !== "UNKNOWN" ? normalized : null;
}

export function deriveDecisionFreshness({
  symbol,
  candidateType,
  candidateKey,
  records = [],
  timelineEvents = [],
  now = Date.now(),
}: {
  symbol: string;
  candidateType?: CandidateType;
  candidateKey?: string;
  records?: readonly StrategyDecisionRecord[];
  timelineEvents?: readonly PublicTimelineEvent[];
  now?: number;
}): DecisionFreshnessSnapshot {
  const normalizedSymbol = normalizeRefreshSymbol(symbol) ?? "UNKNOWN";
  const normalizedCandidateType = candidateType ? normalizeCandidateType(candidateType) : null;
  const normalizedCandidateKey = normalizeCandidateKey(candidateKey);
  const recordCandidates = records.flatMap((record) => {
    if (normalizedCandidateType && normalizedCandidateType !== "symbol") {
      if (normalizeCandidateType(record.candidate?.candidateType) !== normalizedCandidateType) {
        return [];
      }
      if (
        normalizedCandidateKey &&
        normalizeCandidateKey(record.candidate?.candidateKey) !== normalizedCandidateKey
      ) {
        return [];
      }
      const createdAtMs = Date.parse(record.createdAt);
      return Number.isFinite(createdAtMs)
        ? [{ ts: createdAtMs, source: "records" as DecisionFreshnessSource }]
        : [];
    }
    const recordSymbol =
      normalizeRefreshSymbol(record.symbol) ?? normalizeRefreshSymbol(record.tradeDecision?.symbol);
    if (recordSymbol !== normalizedSymbol) return [];
    const createdAtMs = Date.parse(record.createdAt);
    return Number.isFinite(createdAtMs)
      ? [{ ts: createdAtMs, source: "records" as DecisionFreshnessSource }]
      : [];
  });
  const timelineCandidates = timelineEvents.flatMap((event) => {
    if (event.payload.kind !== "pm_decision") return [];
    if (normalizedCandidateType && normalizedCandidateType !== "symbol") {
      if (normalizeCandidateType(event.payload.candidateType) !== normalizedCandidateType) {
        return [];
      }
      if (
        normalizedCandidateKey &&
        normalizeCandidateKey(event.payload.candidateKey) !== normalizedCandidateKey
      ) {
        return [];
      }
      return Number.isFinite(event.ts)
        ? [{ ts: event.ts, source: "timeline" as DecisionFreshnessSource }]
        : [];
    }
    if (normalizeRefreshSymbol(event.payload.symbol) !== normalizedSymbol) return [];
    return Number.isFinite(event.ts)
      ? [{ ts: event.ts, source: "timeline" as DecisionFreshnessSource }]
      : [];
  });
  const latest = [...recordCandidates, ...timelineCandidates].sort((a, b) => b.ts - a.ts)[0];

  if (!latest) {
    return {
      symbol: normalizedSymbol,
      lastDecisionAt: null,
      lastDecisionAtMs: null,
      refreshSource: "none",
      isFresh: false,
    };
  }

  return {
    symbol: normalizedSymbol,
    lastDecisionAt: new Date(latest.ts).toISOString(),
    lastDecisionAtMs: latest.ts,
    refreshSource: latest.source,
    isFresh: now - latest.ts < WATCH_DECISION_FRESHNESS_MS,
  };
}
