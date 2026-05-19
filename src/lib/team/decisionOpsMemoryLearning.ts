import type { StrategyDecisionRecord } from "@/lib/team/strategyDecisionRecord";

export type DecisionOpsMemoryLearningStatus = "ready" | "warming" | "critical";

export interface DecisionOpsMemoryLearningAction {
  title: string;
  description: string;
  executable: false;
}

export interface DecisionOpsMemoryLearningReport {
  schemaVersion: 1;
  generatedAt: string;
  status: DecisionOpsMemoryLearningStatus;
  memoryLoopLearningReady: boolean;
  thresholds: {
    minimumResolvedRecords: number;
    minimumMemoryLoopNoteCoverage: number;
  };
  counts: {
    totalRecords: number;
    resolvedNonLegacyRecords: number;
    resolvedRecordsWithMemoryLoopNote: number;
    distinctResolvedSymbols: number;
    sampleSizeCautionRecords: number;
  };
  ratios: {
    memoryNoteCoverage: number;
  };
  blockingReasons: string[];
  actions: DecisionOpsMemoryLearningAction[];
}

const MINIMUM_RESOLVED_RECORDS = 5;
const MINIMUM_MEMORY_NOTE_COVERAGE = 0.2;

export function buildDecisionOpsMemoryLearning({
  records,
  now = Date.now(),
}: {
  records: readonly StrategyDecisionRecord[];
  now?: number;
}): DecisionOpsMemoryLearningReport {
  const resolvedRecords = records.filter(isResolvedNonLegacyRecord);
  const resolvedWithMemoryNote = resolvedRecords.filter(hasMemoryLoopNote);
  const memoryNoteCoverage = ratio(resolvedWithMemoryNote.length, resolvedRecords.length);
  const sampleSizeCautionRecords =
    resolvedRecords.length < MINIMUM_RESOLVED_RECORDS ? resolvedRecords.length : 0;
  const blockingReasons = blockingReasonsFor({
    resolvedRecords: resolvedRecords.length,
    memoryNoteCoverage,
  });
  const ready = blockingReasons.length === 0;

  return {
    schemaVersion: 1,
    generatedAt: new Date(now).toISOString(),
    status: ready ? "ready" : resolvedRecords.length > 0 ? "warming" : "critical",
    memoryLoopLearningReady: ready,
    thresholds: {
      minimumResolvedRecords: MINIMUM_RESOLVED_RECORDS,
      minimumMemoryLoopNoteCoverage: MINIMUM_MEMORY_NOTE_COVERAGE,
    },
    counts: {
      totalRecords: records.length,
      resolvedNonLegacyRecords: resolvedRecords.length,
      resolvedRecordsWithMemoryLoopNote: resolvedWithMemoryNote.length,
      distinctResolvedSymbols: new Set(resolvedRecords.map((record) => record.symbol)).size,
      sampleSizeCautionRecords,
    },
    ratios: {
      memoryNoteCoverage,
    },
    blockingReasons,
    actions: actionsFor(blockingReasons),
  };
}

function isResolvedNonLegacyRecord(record: StrategyDecisionRecord) {
  return record.recordSource !== "legacy" && Boolean(record.resolvedAt && record.resolvedOutcome);
}

function hasMemoryLoopNote(record: StrategyDecisionRecord) {
  return record.analystInputs.some(
    (input) =>
      input.memberId === "memory_loop" &&
      Boolean(
        input.oneLineSummary?.trim() || input.detailedRationale?.trim() || input.rationale?.trim(),
      ),
  );
}

function blockingReasonsFor({
  resolvedRecords,
  memoryNoteCoverage,
}: {
  resolvedRecords: number;
  memoryNoteCoverage: number;
}) {
  const reasons: string[] = [];
  if (resolvedRecords === 0) {
    reasons.push("memory_loop_no_resolved_non_legacy_records");
    return reasons;
  }
  if (resolvedRecords < MINIMUM_RESOLVED_RECORDS) {
    reasons.push("memory_loop_sample_size_caution");
  }
  if (memoryNoteCoverage < MINIMUM_MEMORY_NOTE_COVERAGE) {
    reasons.push("memory_loop_note_coverage_low");
  }
  return reasons;
}

function actionsFor(blockingReasons: readonly string[]): DecisionOpsMemoryLearningAction[] {
  if (blockingReasons.length === 0) return [];
  return [
    {
      title: "Keep memory loop in observe mode",
      description:
        "Resolved non-legacy records and usable memory-loop notes must accumulate before memory learning can be treated as a product claim.",
      executable: false,
    },
  ];
}

function ratio(numerator: number, denominator: number) {
  if (denominator <= 0) return 0;
  return Number((numerator / denominator).toFixed(3));
}
