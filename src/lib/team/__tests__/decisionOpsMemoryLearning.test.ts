import { describe, expect, it } from "vitest";
import { buildDecisionOpsMemoryLearning } from "@/lib/team/decisionOpsMemoryLearning";
import type { StrategyDecisionRecord } from "@/lib/team/strategyDecisionRecord";

const now = Date.parse("2026-05-19T12:00:00.000Z");

describe("buildDecisionOpsMemoryLearning", () => {
  it("is ready when resolved non-legacy records include usable memory loop notes", () => {
    const report = buildDecisionOpsMemoryLearning({
      records: [
        record("BTC", "hit_tp", "Breakout lesson kept."),
        record("ETH", "hit_sl", "False-break lesson kept."),
        record("SOL", "expired", null),
        record("HYPE", "manual_close", null),
        record("BILL", "hit_tp", null),
      ],
      now,
    });

    expect(report).toMatchObject({
      schemaVersion: 1,
      status: "ready",
      memoryLoopLearningReady: true,
      counts: {
        totalRecords: 5,
        resolvedNonLegacyRecords: 5,
        resolvedRecordsWithMemoryLoopNote: 2,
        distinctResolvedSymbols: 5,
      },
      ratios: {
        memoryNoteCoverage: 0.4,
      },
      blockingReasons: [],
    });
  });

  it("blocks when there are no resolved non-legacy records to learn from", () => {
    const report = buildDecisionOpsMemoryLearning({
      records: [
        record("BTC", null, "Open cases do not count."),
        { ...record("ETH", "hit_tp", "Legacy must not count."), recordSource: "legacy" },
      ],
      now,
    });

    expect(report).toMatchObject({
      status: "critical",
      memoryLoopLearningReady: false,
      counts: {
        resolvedNonLegacyRecords: 0,
        resolvedRecordsWithMemoryLoopNote: 0,
      },
      blockingReasons: ["memory_loop_no_resolved_non_legacy_records"],
    });
  });
});

function record(
  symbol: string,
  outcome: StrategyDecisionRecord["resolvedOutcome"],
  memoryNote: string | null,
): StrategyDecisionRecord {
  return {
    id: `pm:${symbol}:2026-05-19T00:00:00.000Z`,
    schemaVersion: 2,
    recordSource: "live",
    symbol,
    locale: "zh_CN",
    decisionOwnerId: "pm",
    contributorIds: ["pm", "memory_loop"],
    analystInputs: memoryNote
      ? [
          {
            memberId: "memory_loop",
            direction: "neutral",
            confidence: 0.5,
            rationale: memoryNote,
            evidenceIds: [],
          },
        ]
      : [],
    sourceThreadId: null,
    tradeDecision: null,
    createdAt: new Date(now - 60_000).toISOString(),
    evaluationWindowEndsAt: null,
    resolvedAt: outcome ? new Date(now).toISOString() : null,
    resolvedOutcome: outcome,
    promptVersion: "test",
    modelProvider: "deepseek-chat",
  };
}
