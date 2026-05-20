import type { DecisionOpsMemoryLearningReport } from "@/lib/team/decisionOpsMemoryLearning";
import type { StrategyDecisionRecord } from "@/lib/team/strategyDecisionRecord";

export type DecisionOpsMemoryProductizationGateStatus = "observe_only" | "private_claim_ready";

export interface DecisionOpsMemoryProductizationGateAction {
  title: string;
  description: string;
  executable: false;
}

export interface DecisionOpsMemoryProductizationGateReport {
  schemaVersion: 1;
  generatedAt: string;
  status: DecisionOpsMemoryProductizationGateStatus;
  memoryProductizationReady: boolean;
  publicWinRateClaimAllowed: false;
  productionReleaseAllowed: false;
  publicBehaviorChanged: false;
  thresholds: {
    minimumResolvedRecords: number;
    minimumMemoryContrastCoverage: number;
    minimumDistinctResolvedSymbols: number;
  };
  sourceStatus: DecisionOpsMemoryLearningReport["status"];
  counts: {
    totalRecords: number;
    resolvedNonLegacyRecords: number;
    memoryContrastRecords: number;
    distinctResolvedSymbols: number;
  };
  ratios: {
    memoryContrastCoverage: number;
  };
  blockingReasons: string[];
  actions: DecisionOpsMemoryProductizationGateAction[];
}

const MINIMUM_RESOLVED_RECORDS = 5;
const MINIMUM_MEMORY_CONTRAST_COVERAGE = 0.6;
const MINIMUM_DISTINCT_RESOLVED_SYMBOLS = 3;
const MEMORY_CONTRAST_PATTERN =
  /(历史|样本|复盘|相似|類似|resolved|historical|sample|outcome|cross-symbol|lesson|similar)/i;

export function buildDecisionOpsMemoryProductizationGate({
  memoryLearning,
  records,
  now = Date.now(),
}: {
  memoryLearning: DecisionOpsMemoryLearningReport;
  records: readonly StrategyDecisionRecord[];
  now?: number;
}): DecisionOpsMemoryProductizationGateReport {
  const resolvedRecords = records.filter(isResolvedNonLegacyRecord);
  const memoryContrastRecords = resolvedRecords.filter(hasMemoryContrast);
  const memoryContrastCoverage = ratio(memoryContrastRecords.length, resolvedRecords.length);
  const distinctResolvedSymbols = new Set(resolvedRecords.map((record) => record.symbol)).size;
  const blockingReasons = blockingReasonsFor({
    memoryLearning,
    resolvedRecords: resolvedRecords.length,
    memoryContrastCoverage,
    distinctResolvedSymbols,
  });
  const ready = blockingReasons.length === 0;

  return {
    schemaVersion: 1,
    generatedAt: new Date(now).toISOString(),
    status: ready ? "private_claim_ready" : "observe_only",
    memoryProductizationReady: ready,
    publicWinRateClaimAllowed: false,
    productionReleaseAllowed: false,
    publicBehaviorChanged: false,
    thresholds: {
      minimumResolvedRecords: MINIMUM_RESOLVED_RECORDS,
      minimumMemoryContrastCoverage: MINIMUM_MEMORY_CONTRAST_COVERAGE,
      minimumDistinctResolvedSymbols: MINIMUM_DISTINCT_RESOLVED_SYMBOLS,
    },
    sourceStatus: memoryLearning.status,
    counts: {
      totalRecords: records.length,
      resolvedNonLegacyRecords: resolvedRecords.length,
      memoryContrastRecords: memoryContrastRecords.length,
      distinctResolvedSymbols,
    },
    ratios: {
      memoryContrastCoverage,
    },
    blockingReasons,
    actions: actionsFor(ready),
  };
}

function isResolvedNonLegacyRecord(record: StrategyDecisionRecord) {
  return record.recordSource !== "legacy" && Boolean(record.resolvedAt && record.resolvedOutcome);
}

function hasMemoryContrast(record: StrategyDecisionRecord) {
  return record.analystInputs
    .filter((input) => input.memberId === "memory_loop")
    .some((input) =>
      MEMORY_CONTRAST_PATTERN.test(
        [input.oneLineSummary, input.detailedRationale, input.rationale].filter(Boolean).join(" "),
      ),
    );
}

function blockingReasonsFor({
  memoryLearning,
  resolvedRecords,
  memoryContrastCoverage,
  distinctResolvedSymbols,
}: {
  memoryLearning: DecisionOpsMemoryLearningReport;
  resolvedRecords: number;
  memoryContrastCoverage: number;
  distinctResolvedSymbols: number;
}) {
  const reasons: string[] = [];
  if (!memoryLearning.memoryLoopLearningReady || memoryLearning.status !== "ready") {
    reasons.push("memory_learning_source_not_ready");
  }
  if (resolvedRecords < MINIMUM_RESOLVED_RECORDS) {
    reasons.push("memory_product_sample_size_low");
  }
  if (memoryContrastCoverage < MINIMUM_MEMORY_CONTRAST_COVERAGE) {
    reasons.push("memory_contrast_coverage_low");
  }
  if (distinctResolvedSymbols < MINIMUM_DISTINCT_RESOLVED_SYMBOLS) {
    reasons.push("memory_distinct_symbol_count_low");
  }
  return reasons;
}

function ratio(numerator: number, denominator: number) {
  if (denominator <= 0) return 0;
  return Number((numerator / denominator).toFixed(3));
}

function actionsFor(ready: boolean): DecisionOpsMemoryProductizationGateAction[] {
  if (ready) {
    return [
      {
        title: "Use memory learning as a private operator claim only",
        description:
          "Resolved samples and historical contrast are strong enough for internal review. Public win-rate claims remain locked.",
        executable: false,
      },
    ];
  }
  return [
    {
      title: "Keep memory learning in observe mode",
      description:
        "Accumulate resolved samples, distinct symbols, and memory-loop contrast before turning memory into a product claim.",
      executable: false,
    },
  ];
}
