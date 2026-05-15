import type { Locale } from "@/i18n/types";
import type { StrategyDecisionRecord } from "@/lib/team/strategyDecisionRecord";
import { buildDecisionHistoryPayload } from "@/lib/watch/decisionHistory";

const OUTCOMES = ["hit_tp", "hit_sl", "expired", "manual_close", null] as const;

export function getStagingDecisionHistoryPayload({
  symbol,
  locale,
  limit,
  before,
  now = Date.now(),
}: {
  symbol: string;
  locale: Locale;
  limit: number;
  before?: string | null;
  now?: number;
}) {
  return buildDecisionHistoryPayload({
    symbol,
    locale,
    records: Array.from({ length: 20 }, (_, index) => stagingRecord(symbol, locale, index, now)),
    limit,
    before,
  });
}

function stagingRecord(
  symbol: string,
  locale: Locale,
  index: number,
  now: number,
): StrategyDecisionRecord {
  const createdAt = new Date(now - index * 6 * 60 * 60 * 1000).toISOString();
  const outcome = OUTCOMES[index % OUTCOMES.length] ?? null;
  const direction = index % 3 === 0 ? "short" : "long";
  const entryPrice = 100 + index * 2;
  return {
    id: `staging-history-${symbol.toLowerCase()}-${index}`,
    schemaVersion: 2,
    recordVersion: 1,
    recordSource: "paper",
    symbol,
    locale,
    decisionOwnerId: "pm",
    contributorIds: ["chart_analyst", "news_analyst", "pm"],
    analystInputs: [
      {
        memberId: "chart_analyst",
        direction,
        confidence: 0.55 + (index % 5) * 0.07,
        rationale: `${symbol} staging history ${index}`,
        evidenceIds: [`staging-history-${index}`],
      },
    ],
    sourceThreadId: null,
    tradeDecision: {
      id: `staging-history-trade-${symbol.toLowerCase()}-${index}`,
      schemaVersion: 1,
      symbol,
      generatedBy: "pm",
      generatedAt: createdAt,
      direction,
      entryType: "market",
      entryPrice,
      entryRange: { low: entryPrice - 1, high: entryPrice + 1 },
      stopLoss: direction === "long" ? entryPrice - 4 : entryPrice + 4,
      takeProfit:
        direction === "long"
          ? [entryPrice + 5, entryPrice + 10]
          : [entryPrice - 5, entryPrice - 10],
      positionSizing: 0.1,
      timeHorizon: "intraday",
      rating: ((index % 5) + 1) as 1 | 2 | 3 | 4 | 5,
      confidence: 0.58 + (index % 4) * 0.08,
      evidenceIds: [`staging-history-${index}`],
      riskNote: "fixture risk",
      invalidatesIf: "fixture invalidation",
      promptVersion: "fixture",
      modelProvider: "fixture",
      severity: index % 2 === 0 ? "medium" : "high",
    },
    stageTrace: [],
    createdAt,
    evaluationWindowEndsAt: null,
    resolvedAt: outcome ? new Date(Date.parse(createdAt) + 90 * 60_000).toISOString() : null,
    resolvedOutcome: outcome,
    promptVersion: "fixture",
    modelProvider: "fixture",
  };
}
