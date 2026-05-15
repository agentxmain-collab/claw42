import { describe, expect, it, vi } from "vitest";
import { writeDecisionStagePartial } from "@/lib/team/decisionStageWriter";
import type { StrategyDecisionRecord } from "@/lib/team/strategyDecisionRecord";

function record(overrides: Partial<StrategyDecisionRecord> = {}): StrategyDecisionRecord {
  return {
    id: "pm:BTC:1778407200000",
    schemaVersion: 2,
    recordSource: "live",
    symbol: "BTC",
    locale: "zh_CN",
    decisionOwnerId: "pm",
    contributorIds: ["pm"],
    analystInputs: [],
    stageTrace: [
      {
        stageId: "trade_decision",
        label: "PM trade decision",
        status: "in_progress",
        observedAt: new Date(0).toISOString(),
      },
    ],
    sourceThreadId: null,
    tradeDecision: null,
    createdAt: new Date(0).toISOString(),
    evaluationWindowEndsAt: null,
    resolvedAt: null,
    resolvedOutcome: null,
    promptVersion: "test",
    modelProvider: "stub",
    legacyFactionId: null,
    ...overrides,
  };
}

describe("writeDecisionStagePartial", () => {
  it("assigns a monotonic recordVersion before upserting the partial record", async () => {
    const updateDecisionRecord = vi.fn(async () => undefined);
    const updateVersionedJson = vi.fn(async (_key, updater) => {
      const value = await updater(null, 2);
      return {
        version: 3,
        value,
        updatedAt: new Date().toISOString(),
      };
    });

    const written = await writeDecisionStagePartial(record(), {
      updateDecisionRecord,
      updateVersionedJson,
    });

    expect(written.recordVersion).toBe(3);
    expect(updateDecisionRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "pm:BTC:1778407200000",
        recordVersion: 3,
      }),
    );
    expect(updateVersionedJson.mock.calls[0]?.[0]).toBe(
      "claw42:strategy:partial:v1:zh_CN:BTC:pm:BTC:1778407200000",
    );
  });
});
