import {
  buildDecisionOpsSparseShadow,
  type DecisionOpsSparseShadowCallModel,
  type DecisionOpsSparseShadowStatus,
} from "@/lib/team/decisionOpsSparseShadow";
import type { StrategyDecisionRecord } from "@/lib/team/strategyDecisionRecord";

export type DecisionOpsSparseShadowHistoryStatus =
  | "insufficient_shadow_batches"
  | "shadow_risk_detected"
  | "ready_for_config_gate";

export interface DecisionOpsSparseShadowHistoryBatchOutcome {
  batchIndex: number;
  recordIds: string[];
  newestRecordAt: string | null;
  oldestRecordAt: string | null;
  status: DecisionOpsSparseShadowStatus;
  safeToTrial: boolean;
  callModel: DecisionOpsSparseShadowCallModel;
  riskCounts: {
    missedContributions: number;
    missedWarnings: number;
    traceGaps: number;
  };
}

export interface DecisionOpsSparseShadowHistoryRecommendation {
  title: string;
  description: string;
  executable: false;
}

export interface DecisionOpsSparseShadowHistoryReport {
  schemaVersion: 1;
  generatedAt: string;
  status: DecisionOpsSparseShadowHistoryStatus;
  safeToPrepareConfigGate: boolean;
  parameters: {
    batchSize: number;
    minimumSafeBatches: number;
  };
  stability: {
    totalRecords: number;
    totalBatches: number;
    evaluatedBatches: number;
    safeBatches: number;
    riskyBatches: number;
    insufficientBatches: number;
    consecutiveSafeBatches: number;
    partialRecordRemainder: number;
  };
  batchOutcomes: DecisionOpsSparseShadowHistoryBatchOutcome[];
  recommendations: DecisionOpsSparseShadowHistoryRecommendation[];
}

const DEFAULT_BATCH_SIZE = 3;
const DEFAULT_MINIMUM_SAFE_BATCHES = 2;

export function buildDecisionOpsSparseShadowHistory({
  records,
  now = Date.now(),
  batchSize = DEFAULT_BATCH_SIZE,
  minimumSafeBatches = DEFAULT_MINIMUM_SAFE_BATCHES,
}: {
  records: readonly StrategyDecisionRecord[];
  now?: number;
  batchSize?: number;
  minimumSafeBatches?: number;
}): DecisionOpsSparseShadowHistoryReport {
  const normalizedBatchSize = normalizeBatchSize(batchSize);
  const normalizedMinimumSafeBatches = Math.max(1, Math.floor(minimumSafeBatches));
  const sortedRecords = [...records].sort(compareRecordsNewestFirst);
  const batches = completeBatches(sortedRecords, normalizedBatchSize);
  const batchOutcomes = batches.map((batch, index) =>
    batchOutcome({
      batch,
      batchIndex: index + 1,
      now,
    }),
  );
  const stability = stabilityFor({
    totalRecords: sortedRecords.length,
    batchOutcomes,
    partialRecordRemainder: sortedRecords.length % normalizedBatchSize,
  });
  const status = statusFor({
    stability,
    minimumSafeBatches: normalizedMinimumSafeBatches,
  });

  return {
    schemaVersion: 1,
    generatedAt: new Date(now).toISOString(),
    status,
    safeToPrepareConfigGate: status === "ready_for_config_gate",
    parameters: {
      batchSize: normalizedBatchSize,
      minimumSafeBatches: normalizedMinimumSafeBatches,
    },
    stability,
    batchOutcomes,
    recommendations: recommendationsFor({
      status,
      stability,
      minimumSafeBatches: normalizedMinimumSafeBatches,
    }),
  };
}

function completeBatches(records: readonly StrategyDecisionRecord[], batchSize: number) {
  const batches: StrategyDecisionRecord[][] = [];
  for (let index = 0; index + batchSize <= records.length; index += batchSize) {
    batches.push(records.slice(index, index + batchSize));
  }
  return batches;
}

function batchOutcome({
  batch,
  batchIndex,
  now,
}: {
  batch: readonly StrategyDecisionRecord[];
  batchIndex: number;
  now: number;
}): DecisionOpsSparseShadowHistoryBatchOutcome {
  const shadow = buildDecisionOpsSparseShadow({
    records: batch,
    now,
  });
  return {
    batchIndex,
    recordIds: batch.map((record) => record.id),
    newestRecordAt: batch[0]?.createdAt ?? null,
    oldestRecordAt: batch[batch.length - 1]?.createdAt ?? null,
    status: shadow.status,
    safeToTrial: shadow.safeToTrial,
    callModel: shadow.callModel,
    riskCounts: shadow.riskCounts,
  };
}

function stabilityFor({
  totalRecords,
  batchOutcomes,
  partialRecordRemainder,
}: {
  totalRecords: number;
  batchOutcomes: readonly DecisionOpsSparseShadowHistoryBatchOutcome[];
  partialRecordRemainder: number;
}): DecisionOpsSparseShadowHistoryReport["stability"] {
  const safeBatches = batchOutcomes.filter((batch) => batch.safeToTrial).length;
  const riskyBatches = batchOutcomes.filter(
    (batch) => batch.status === "shadow_risk_detected",
  ).length;
  const insufficientBatches = batchOutcomes.filter(
    (batch) => batch.status === "insufficient_trace_data",
  ).length;
  return {
    totalRecords,
    totalBatches: batchOutcomes.length,
    evaluatedBatches: batchOutcomes.length,
    safeBatches,
    riskyBatches,
    insufficientBatches,
    consecutiveSafeBatches: consecutiveSafeBatches(batchOutcomes),
    partialRecordRemainder,
  };
}

function consecutiveSafeBatches(
  batchOutcomes: readonly DecisionOpsSparseShadowHistoryBatchOutcome[],
) {
  let count = 0;
  for (const batch of batchOutcomes) {
    if (!batch.safeToTrial) break;
    count += 1;
  }
  return count;
}

function statusFor({
  stability,
  minimumSafeBatches,
}: {
  stability: DecisionOpsSparseShadowHistoryReport["stability"];
  minimumSafeBatches: number;
}): DecisionOpsSparseShadowHistoryStatus {
  if (stability.totalBatches < minimumSafeBatches || stability.insufficientBatches > 0) {
    return "insufficient_shadow_batches";
  }
  if (stability.riskyBatches > 0) return "shadow_risk_detected";
  if (stability.consecutiveSafeBatches >= minimumSafeBatches) return "ready_for_config_gate";
  return "insufficient_shadow_batches";
}

function recommendationsFor({
  status,
  stability,
  minimumSafeBatches,
}: {
  status: DecisionOpsSparseShadowHistoryStatus;
  stability: DecisionOpsSparseShadowHistoryReport["stability"];
  minimumSafeBatches: number;
}): DecisionOpsSparseShadowHistoryRecommendation[] {
  if (status === "ready_for_config_gate") {
    return [
      {
        title: "Prepare a disabled sparse fan-out config gate",
        description:
          "Recent shadow batches are safe. The next change can add a disabled runtime gate without changing live PM fan-out.",
        executable: false,
      },
    ];
  }
  if (status === "shadow_risk_detected") {
    return [
      {
        title: "Keep full PM fan-out until shadow risk is zero",
        description: `${stability.riskyBatches} shadow batch still has missed contributor or warning risk.`,
        executable: false,
      },
    ];
  }
  return [
    {
      title: "Collect more complete shadow batches",
      description: `Need ${minimumSafeBatches} consecutive safe batches before preparing a disabled sparse fan-out config gate.`,
      executable: false,
    },
  ];
}

function compareRecordsNewestFirst(a: StrategyDecisionRecord, b: StrategyDecisionRecord) {
  const timeDelta = timestampFor(b.createdAt) - timestampFor(a.createdAt);
  if (timeDelta !== 0) return timeDelta;
  return a.id.localeCompare(b.id);
}

function timestampFor(value: string) {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeBatchSize(value: number) {
  if (!Number.isFinite(value)) return DEFAULT_BATCH_SIZE;
  return Math.max(3, Math.min(20, Math.floor(value)));
}
