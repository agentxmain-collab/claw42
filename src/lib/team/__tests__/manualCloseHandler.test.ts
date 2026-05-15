import { describe, expect, it } from "vitest";
import { manualCloseDecisionRecord } from "@/lib/team/manualCloseHandler";
import type { StrategyDecisionRecord } from "@/lib/team/strategyDecisionRecord";
import type { TradeDecision } from "@/lib/team/tradeDecision";

const now = Date.UTC(2026, 4, 15, 12, 0, 0);

describe("manualCloseDecisionRecord", () => {
  it("writes a manual_close resolution with admin_manual price source", async () => {
    const writerCalls: StrategyDecisionRecord[] = [];
    const result = await manualCloseDecisionRecord({
      recordId: "record-1",
      locale: "zh_CN",
      now,
      observedPrice: 102.5,
      readRecords: async () => [record()],
      writeRecord: async (nextRecord) => {
        writerCalls.push(nextRecord);
      },
    });

    expect(result.resolution).toEqual({
      outcome: "manual_close",
      reason: "manual_close_requested",
      observedPrice: 102.5,
      observedPriceSource: "admin_manual",
      resolvedAt: new Date(now).toISOString(),
    });
    expect(result.record).toMatchObject({
      resolvedOutcome: "manual_close",
      resolvedAt: new Date(now).toISOString(),
      resolvedPrice: 102.5,
      resolutionReason: "manual_close_requested",
      resolutionPriceSource: "admin_manual",
    });
    expect(writerCalls).toEqual([result.record]);
  });

  it("can derive the close price from a symbol price map", async () => {
    const result = await manualCloseDecisionRecord({
      recordId: "record-1",
      locale: "zh_CN",
      now,
      priceBySymbol: new Map([["BTC", 103]]),
      readRecords: async () => [record({ symbol: "UNKNOWN", tradeSymbol: " $btc " })],
      writeRecord: async () => undefined,
    });

    expect(result.resolution.observedPrice).toBe(103);
  });

  it("does not rewrite an already resolved decision", async () => {
    const writerCalls: StrategyDecisionRecord[] = [];
    await expect(
      manualCloseDecisionRecord({
        recordId: "record-1",
        locale: "zh_CN",
        now,
        observedPrice: 102.5,
        readRecords: async () => [record({ resolvedOutcome: "hit_tp" })],
        writeRecord: async (nextRecord) => {
          writerCalls.push(nextRecord);
        },
      }),
    ).rejects.toMatchObject({ code: "already_resolved" });

    expect(writerCalls).toHaveLength(0);
  });
});

function record(
  overrides: {
    symbol?: string;
    tradeSymbol?: string;
    resolvedOutcome?: StrategyDecisionRecord["resolvedOutcome"];
  } = {},
): StrategyDecisionRecord {
  const tradeDecision: TradeDecision = {
    id: "trade-1",
    schemaVersion: 1,
    symbol: overrides.tradeSymbol ?? "BTC",
    generatedBy: "pm",
    generatedAt: new Date(now - 10 * 60_000).toISOString(),
    direction: "long",
    entryType: "market",
    entryPrice: 100,
    entryRange: null,
    stopLoss: 95,
    takeProfit: [110, 115],
    positionSizing: 0.05,
    timeHorizon: "intraday",
    rating: 4,
    confidence: 0.75,
    evidenceIds: [],
    riskNote: "test risk",
    invalidatesIf: "test invalidation",
    promptVersion: "test",
    modelProvider: "stub",
    severity: "high",
  };

  return {
    id: "record-1",
    schemaVersion: 2,
    recordSource: "paper",
    symbol: overrides.symbol ?? "BTC",
    locale: "zh_CN",
    decisionOwnerId: "pm",
    contributorIds: ["pm"],
    analystInputs: [],
    sourceThreadId: null,
    tradeDecision,
    createdAt: new Date(now - 10 * 60_000).toISOString(),
    evaluationWindowEndsAt: new Date(now + 60_000).toISOString(),
    resolvedAt: overrides.resolvedOutcome ? new Date(now - 1000).toISOString() : null,
    resolvedOutcome: overrides.resolvedOutcome ?? null,
    promptVersion: "test",
    modelProvider: "stub",
  };
}
