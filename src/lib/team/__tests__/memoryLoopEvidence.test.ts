import { describe, expect, test } from "vitest";
import {
  fetchMemoryContext,
  fetchTeamTrackRecord,
  formatMemoryContextForPrompt,
} from "@/lib/team/memoryLoopEvidence";
import type { StrategyDecisionRecord } from "@/lib/team/strategyDecisionRecord";
import type { TeamMemberId } from "@/lib/team/teamRegistry";
import type { TradeDecision } from "@/lib/team/tradeDecision";

describe("memoryLoopEvidence", () => {
  test("returns no-history context without assuming a history wall key", async () => {
    const context = await fetchMemoryContext("HYPE", "zh_CN", {
      readDecisionRecords: async () => [],
    });

    expect(context).toMatchObject({
      historicalCount: 0,
      sampleSizeCaution: true,
      error: "no_history",
    });
    expect(formatMemoryContextForPrompt(context)).toContain("No historical baseline");
  });

  test("builds sparse memory context from non-legacy symbol records", async () => {
    const context = await fetchMemoryContext("HYPE", "zh_CN", {
      readDecisionRecords: async () => [
        makeRecord({
          id: "hype-win",
          symbol: "HYPE",
          resolvedOutcome: "hit_tp",
          analystInputs: [
            {
              memberId: "memory_loop",
              direction: "long",
              confidence: 0.6,
              rationale: "Prior breakouts worked when volume confirmed.",
              oneLineSummary: "Volume-confirmed breakouts had better follow-through.",
              evidenceIds: [],
            },
          ],
        }),
        makeRecord({
          id: "hype-loss",
          symbol: "HYPE",
          createdAt: "2026-05-09T00:00:00.000Z",
          resolvedOutcome: "hit_sl",
          tradeDecision: makeTradeDecision({ direction: "short" }),
        }),
        makeRecord({ id: "legacy", recordSource: "legacy", symbol: "HYPE" }),
      ],
    });

    expect(context.historicalCount).toBe(2);
    expect(context.winLossDistribution).toEqual({ wins: 1, losses: 1, openTrades: 0 });
    expect(context.similarSetups).toHaveLength(2);
    expect(context.lastReviewNotes).toContain("Volume-confirmed");
    expect(context.sampleSizeCaution).toBe(true);
  });

  test("computes team track record through the existing winrate aggregator", async () => {
    const trackRecord = await fetchTeamTrackRecord("zh_CN", {
      now: () => Date.UTC(2026, 4, 15, 12),
      readAllDecisionRecords: async () => [
        makeRecord({
          decisionOwnerId: "pm",
          contributorIds: ["chart_analyst", "memory_loop"],
          resolvedOutcome: "hit_tp",
        }),
      ],
    });

    expect(trackRecord.generatedAt).toBe("2026-05-15T12:00:00.000Z");
    expect(trackRecord.winrates.find((item) => item.memberId === "pm")).toMatchObject({
      totalDecisions: 1,
      wins: 1,
      lastFiveWinRate: 1,
      sampleSizeWarning: true,
    });
  });
});

function makeRecord(overrides: Partial<StrategyDecisionRecord> = {}): StrategyDecisionRecord {
  return {
    id: "record-1",
    schemaVersion: 2,
    recordSource: "live",
    symbol: "BTC",
    locale: "zh_CN",
    decisionOwnerId: "pm",
    contributorIds: ["chart_analyst", "memory_loop"],
    analystInputs: [],
    sourceThreadId: "thread-1",
    tradeDecision: makeTradeDecision(),
    createdAt: "2026-05-10T00:00:00.000Z",
    evaluationWindowEndsAt: null,
    resolvedAt: "2026-05-10T01:00:00.000Z",
    resolvedOutcome: "hit_tp",
    promptVersion: "test-v1",
    modelProvider: "deepseek",
    ...overrides,
  };
}

function makeTradeDecision(overrides: Partial<TradeDecision> = {}): TradeDecision {
  return {
    id: "trade-1",
    schemaVersion: 1,
    symbol: "BTC",
    generatedBy: "pm" as TeamMemberId,
    generatedAt: "2026-05-10T00:00:00.000Z",
    direction: "long",
    entryType: "market",
    entryPrice: 100,
    entryRange: null,
    stopLoss: 95,
    takeProfit: [110],
    positionSizing: 0.1,
    timeHorizon: "intraday",
    rating: 4,
    confidence: 0.7,
    evidenceIds: [],
    riskNote: "test risk",
    invalidatesIf: "test invalidation",
    promptVersion: "test-v1",
    modelProvider: "deepseek",
    severity: "medium",
    ...overrides,
  };
}
