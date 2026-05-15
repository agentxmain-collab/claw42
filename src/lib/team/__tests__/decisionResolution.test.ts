import { describe, expect, it } from "vitest";
import {
  applyDecisionResolution,
  evaluateDecisionResolution,
  resolveDecisionRecordFromPrice,
} from "@/lib/team/decisionResolution";
import { manualCloseDecisionRecord } from "@/lib/team/manualCloseHandler";
import type { StrategyDecisionRecord } from "@/lib/team/strategyDecisionRecord";
import type { TradeDecision } from "@/lib/team/tradeDecision";

const now = Date.UTC(2026, 4, 13, 20, 0, 0);

describe("evaluateDecisionResolution", () => {
  it("resolves long and short decisions from a market price snapshot", () => {
    expect(
      evaluateDecisionResolution(record({ direction: "long" }), 112, now, "coinw-kline"),
    ).toMatchObject({
      outcome: "hit_tp",
      observedPrice: 112,
      observedPriceSource: "coinw-kline",
    });
    expect(evaluateDecisionResolution(record({ direction: "long" }), 94, now)).toMatchObject({
      outcome: "hit_sl",
      observedPrice: 94,
    });
    expect(evaluateDecisionResolution(record({ direction: "short" }), 88, now)).toMatchObject({
      outcome: "hit_tp",
      observedPrice: 88,
    });
    expect(evaluateDecisionResolution(record({ direction: "short" }), 106, now)).toMatchObject({
      outcome: "hit_sl",
      observedPrice: 106,
    });
  });

  it("expires an unresolved decision after its evaluation window", () => {
    expect(
      evaluateDecisionResolution(
        record({
          evaluationWindowEndsAt: new Date(now - 60_000).toISOString(),
        }),
        101,
        now,
      ),
    ).toMatchObject({
      outcome: "expired",
      reason: "evaluation_window_elapsed",
    });
  });

  it("keeps unresolved or non-executable decisions open", () => {
    expect(evaluateDecisionResolution(record(), 101, now)).toBeNull();
    expect(evaluateDecisionResolution(record({ direction: "wait" }), 101, now)).toBeNull();
    expect(evaluateDecisionResolution(record({ tradeDecision: null }), 101, now)).toBeNull();
  });

  it("applies a resolution without mutating the original record", () => {
    const original = record();
    const resolution = evaluateDecisionResolution(original, 112, now);
    if (!resolution) throw new Error("expected resolution");

    const resolved = applyDecisionResolution(original, resolution);

    expect(original.resolvedOutcome).toBeNull();
    expect(resolved).toMatchObject({
      id: original.id,
      resolvedOutcome: "hit_tp",
      resolvedAt: new Date(now).toISOString(),
      resolvedPrice: 112,
      resolutionReason: "take_profit_reached",
      resolutionPriceSource: null,
    });
  });

  it("writes a resolved record through the supplied writer", async () => {
    const writerCalls: StrategyDecisionRecord[] = [];
    const result = await resolveDecisionRecordFromPrice(
      record(),
      112,
      now,
      async (nextRecord) => {
        writerCalls.push(nextRecord);
      },
      "coinw-kline",
    );

    expect(result?.resolution.outcome).toBe("hit_tp");
    expect(result?.resolution.observedPriceSource).toBe("coinw-kline");
    expect(result?.record.resolvedOutcome).toBe("hit_tp");
    expect(result?.record.resolvedPrice).toBe(112);
    expect(result?.record.resolutionReason).toBe("take_profit_reached");
    expect(result?.record.resolutionPriceSource).toBe("coinw-kline");
    expect(writerCalls).toHaveLength(1);
    expect(writerCalls[0]?.resolvedOutcome).toBe("hit_tp");
  });

  it("does not write when the decision remains unresolved", async () => {
    const writerCalls: StrategyDecisionRecord[] = [];
    const result = await resolveDecisionRecordFromPrice(record(), 101, now, async (nextRecord) => {
      writerCalls.push(nextRecord);
    });

    expect(result).toBeNull();
    expect(writerCalls).toHaveLength(0);
  });

  it("supports a manual_close writer result through the shared apply path", async () => {
    const writerCalls: StrategyDecisionRecord[] = [];
    const result = await manualCloseDecisionRecord({
      recordId: "record-1",
      locale: "zh_CN",
      now,
      observedPrice: 103,
      readRecords: async () => [record()],
      writeRecord: async (nextRecord) => {
        writerCalls.push(nextRecord);
      },
    });

    expect(result.resolution.outcome).toBe("manual_close");
    expect(result.record.resolvedOutcome).toBe("manual_close");
    expect(result.record.resolutionReason).toBe("manual_close_requested");
    expect(result.record.resolutionPriceSource).toBe("admin_manual");
    expect(writerCalls).toHaveLength(1);
  });
});

function record(
  overrides: {
    direction?: TradeDecision["direction"];
    evaluationWindowEndsAt?: string | null;
    tradeDecision?: TradeDecision | null;
  } = {},
): StrategyDecisionRecord {
  const tradeDecision: TradeDecision | null =
    overrides.tradeDecision === null
      ? null
      : {
          id: "trade-1",
          schemaVersion: 1,
          symbol: "BTC",
          generatedBy: "pm",
          generatedAt: new Date(now - 10 * 60_000).toISOString(),
          direction: overrides.direction ?? "long",
          entryType: "market",
          entryPrice: 100,
          entryRange: null,
          stopLoss: overrides.direction === "short" ? 105 : 95,
          takeProfit: overrides.direction === "short" ? [90, 85] : [110, 115],
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
    schemaVersion: 1,
    recordSource: "paper",
    symbol: "BTC",
    locale: "zh_CN",
    decisionOwnerId: "pm",
    contributorIds: ["pm"],
    analystInputs: [],
    sourceThreadId: null,
    tradeDecision,
    createdAt: new Date(now - 10 * 60_000).toISOString(),
    evaluationWindowEndsAt:
      overrides.evaluationWindowEndsAt ?? new Date(now + 60_000).toISOString(),
    resolvedAt: null,
    resolvedOutcome: null,
    promptVersion: "test",
    modelProvider: "stub",
  };
}
