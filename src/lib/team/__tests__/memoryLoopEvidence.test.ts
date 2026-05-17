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
    expect(formatMemoryContextForPrompt(context)).toContain("Return an empty public rationale");
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

  test("does not treat unresolved open records as learning memory", async () => {
    const context = await fetchMemoryContext("HYPE", "zh_CN", {
      readDecisionRecords: async () => [
        makeRecord({
          id: "hype-open",
          symbol: "HYPE",
          resolvedOutcome: null,
          tradeDecision: makeTradeDecision({ direction: "long" }),
        }),
      ],
    });

    expect(context).toMatchObject({
      historicalCount: 0,
      error: "no_history",
      similarSetups: [],
    });
  });

  test("uses resolved cross-symbol lessons when the current symbol has no closed history", async () => {
    const context = await fetchMemoryContext("VVV", "zh_CN", {
      readDecisionRecords: async () => [],
      readAllDecisionRecords: async () => [
        makeRecord({
          id: "sol-win",
          symbol: "SOL",
          createdAt: "2026-05-11T00:00:00.000Z",
          resolvedOutcome: "hit_tp",
          tradeDecision: makeTradeDecision({ symbol: "SOL", direction: "long" }),
          analystInputs: [
            {
              memberId: "memory_loop",
              direction: "long",
              confidence: 0.64,
              rationale: "Breakout memory stayed valid only while liquidity expanded.",
              oneLineSummary: "Liquidity-confirmed breakouts followed through.",
              evidenceIds: [],
            },
          ],
        }),
        makeRecord({
          id: "eth-open",
          symbol: "ETH",
          createdAt: "2026-05-12T00:00:00.000Z",
          resolvedAt: null,
          resolvedOutcome: null,
          tradeDecision: makeTradeDecision({ symbol: "ETH", direction: "short" }),
        }),
      ],
    });

    expect(context.error).toBeUndefined();
    expect(context.historicalCount).toBe(1);
    expect(context.symbolHistoricalCount).toBe(0);
    expect(context.crossSymbolHistoricalCount).toBe(1);
    expect(context.similarSetups).toEqual([
      expect.objectContaining({ symbol: "SOL", outcome: "hit_tp" }),
    ]);

    const prompt = formatMemoryContextForPrompt(context);
    expect(prompt).toContain("Current-symbol samples: 0");
    expect(prompt).toContain("Cross-symbol resolved lessons");
    expect(prompt).toContain("SOL long -> hit_tp");
    expect(prompt).not.toContain("ETH");
  });

  test("keeps no-history when neither current nor cross-symbol resolved records exist", async () => {
    const context = await fetchMemoryContext("VVV", "zh_CN", {
      readDecisionRecords: async () => [],
      readAllDecisionRecords: async () => [
        makeRecord({
          id: "eth-open",
          symbol: "ETH",
          resolvedAt: null,
          resolvedOutcome: null,
        }),
        makeRecord({
          id: "legacy-win",
          symbol: "BTC",
          recordSource: "legacy",
          resolvedOutcome: "hit_tp",
        }),
      ],
    });

    expect(context).toMatchObject({
      historicalCount: 0,
      error: "no_history",
      similarSetups: [],
    });
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
