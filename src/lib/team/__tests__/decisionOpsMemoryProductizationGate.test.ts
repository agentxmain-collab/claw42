import { describe, expect, it } from "vitest";
import { buildDecisionOpsMemoryProductizationGate } from "@/lib/team/decisionOpsMemoryProductizationGate";
import type { DecisionOpsMemoryLearningReport } from "@/lib/team/decisionOpsMemoryLearning";
import type { StrategyDecisionRecord } from "@/lib/team/strategyDecisionRecord";

const now = Date.parse("2026-05-20T09:00:00.000Z");
const generatedAt = "2026-05-20T09:00:00.000Z";

describe("buildDecisionOpsMemoryProductizationGate", () => {
  it("allows a private memory-learning claim when resolved samples and historical contrast are present", () => {
    const report = buildDecisionOpsMemoryProductizationGate({
      memoryLearning: memoryLearning(),
      records: [
        resolvedRecord("BTC", "hit_tp", "历史样本显示突破后回踩，当前只采纳相同结构的仓位约束。"),
        resolvedRecord(
          "ETH",
          "hit_sl",
          "Historical samples show failed reversals; current case keeps risk tighter.",
        ),
        resolvedRecord("SOL", "expired", "跨品种历史样本提示事件热度衰减后不追价。"),
        resolvedRecord("HYPE", "hit_tp", "历史复盘显示强叙事延续，但必须等待资金确认。"),
        resolvedRecord(
          "BILL",
          "manual_close",
          "Resolved cases suggest reducing confidence when liquidity fades.",
        ),
      ],
      now,
    });

    expect(report).toMatchObject({
      schemaVersion: 1,
      generatedAt,
      status: "private_claim_ready",
      memoryProductizationReady: true,
      publicWinRateClaimAllowed: false,
      productionReleaseAllowed: false,
      publicBehaviorChanged: false,
      counts: {
        resolvedNonLegacyRecords: 5,
        memoryContrastRecords: 5,
        distinctResolvedSymbols: 5,
      },
      blockingReasons: [],
    });
    expect(report.ratios.memoryContrastCoverage).toBe(1);
  });

  it("keeps memory learning in observe-only mode when samples exist but memory loop repeats current analysis", () => {
    const report = buildDecisionOpsMemoryProductizationGate({
      memoryLearning: memoryLearning({
        status: "warming",
        memoryLoopLearningReady: false,
        blockingReasons: ["memory_loop_note_coverage_low"],
      }),
      records: [resolvedRecord("BTC", "hit_tp", "BTC 当前趋势向上，资金流增强。")],
      now,
    });

    expect(report).toMatchObject({
      status: "observe_only",
      memoryProductizationReady: false,
      blockingReasons: [
        "memory_learning_source_not_ready",
        "memory_product_sample_size_low",
        "memory_contrast_coverage_low",
        "memory_distinct_symbol_count_low",
      ],
    });
  });
});

function memoryLearning(
  overrides: Partial<DecisionOpsMemoryLearningReport> = {},
): DecisionOpsMemoryLearningReport {
  return {
    schemaVersion: 1,
    generatedAt,
    status: "ready",
    memoryLoopLearningReady: true,
    thresholds: {
      minimumResolvedRecords: 5,
      minimumMemoryLoopNoteCoverage: 0.2,
    },
    counts: {
      totalRecords: 5,
      resolvedNonLegacyRecords: 5,
      resolvedRecordsWithMemoryLoopNote: 5,
      distinctResolvedSymbols: 5,
      sampleSizeCautionRecords: 0,
    },
    ratios: {
      memoryNoteCoverage: 1,
    },
    blockingReasons: [],
    actions: [],
    ...overrides,
  };
}

function resolvedRecord(
  symbol: string,
  outcome: NonNullable<StrategyDecisionRecord["resolvedOutcome"]>,
  memoryText: string,
): StrategyDecisionRecord {
  return {
    id: `pm:${symbol}:1`,
    schemaVersion: 2,
    recordSource: "live",
    symbol,
    locale: "zh_CN",
    decisionOwnerId: "pm",
    contributorIds: ["memory_loop"],
    analystInputs: [
      {
        memberId: "memory_loop",
        direction: "neutral",
        confidence: 0.65,
        rationale: memoryText,
        oneLineSummary: memoryText,
        detailedRationale: memoryText,
        dataStatus: "ok",
        evidenceIds: [`memory:${symbol}`],
      },
    ],
    sourceThreadId: null,
    tradeDecision: null,
    createdAt: "2026-05-20T08:00:00.000Z",
    evaluationWindowEndsAt: "2026-05-20T12:00:00.000Z",
    resolvedAt: "2026-05-20T13:00:00.000Z",
    resolvedOutcome: outcome,
    promptVersion: "test",
    modelProvider: "deepseek",
  };
}
