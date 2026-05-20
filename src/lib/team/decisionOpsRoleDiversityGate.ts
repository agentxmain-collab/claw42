import type { AnalystDirection, StrategyDecisionRecord } from "@/lib/team/strategyDecisionRecord";

export type DecisionOpsRoleDiversityGateStatus = "ready" | "degraded" | "critical";

export interface DecisionOpsRoleDiversityGateAction {
  title: string;
  description: string;
  executable: false;
}

export interface DecisionOpsRoleDiversityGateReport {
  schemaVersion: 1;
  generatedAt: string;
  status: DecisionOpsRoleDiversityGateStatus;
  roleDiversityReady: boolean;
  productionReleaseAllowed: false;
  publicBehaviorChanged: false;
  thresholds: {
    minimumEvaluatedRecords: number;
    maximumDirectionDominance: number;
    minimumUniqueSummaryRate: number;
    maximumWaitRate: number;
  };
  counts: {
    totalRecords: number;
    evaluatedRecords: number;
    evaluatedRoleInputs: number;
  };
  metrics: {
    directionDominance: number;
    uniqueSummaryRate: number;
    waitRate: number;
  };
  directionCounts: Partial<Record<AnalystDirection, number>>;
  blockingReasons: string[];
  actions: DecisionOpsRoleDiversityGateAction[];
}

const MINIMUM_EVALUATED_RECORDS = 2;
const MAXIMUM_DIRECTION_DOMINANCE = 0.75;
const MINIMUM_UNIQUE_SUMMARY_RATE = 0.65;
const MAXIMUM_WAIT_RATE = 0.75;

export function buildDecisionOpsRoleDiversityGate({
  records,
  now = Date.now(),
}: {
  records: readonly StrategyDecisionRecord[];
  now?: number;
}): DecisionOpsRoleDiversityGateReport {
  const evaluatedRecords = records.filter(
    (record) => record.recordSource !== "legacy" && record.analystInputs.length > 0,
  );
  const inputs = evaluatedRecords.flatMap((record) => record.analystInputs);
  const directionCounts = countDirections(inputs.map((input) => input.direction));
  const directionDominance = ratio(Math.max(0, ...Object.values(directionCounts)), inputs.length);
  const uniqueSummaryRate = ratio(
    new Set(inputs.map((input) => normalizeText(input.oneLineSummary ?? input.rationale))).size,
    inputs.length,
  );
  const waitRate = ratio(
    inputs.filter((input) => input.direction === "wait").length,
    inputs.length,
  );
  const blockingReasons = blockingReasonsFor({
    evaluatedRecordCount: evaluatedRecords.length,
    directionDominance,
    uniqueSummaryRate,
    waitRate,
  });
  const status = statusFor({ blockingReasons, directionDominance, uniqueSummaryRate, waitRate });

  return {
    schemaVersion: 1,
    generatedAt: new Date(now).toISOString(),
    status,
    roleDiversityReady: status === "ready",
    productionReleaseAllowed: false,
    publicBehaviorChanged: false,
    thresholds: {
      minimumEvaluatedRecords: MINIMUM_EVALUATED_RECORDS,
      maximumDirectionDominance: MAXIMUM_DIRECTION_DOMINANCE,
      minimumUniqueSummaryRate: MINIMUM_UNIQUE_SUMMARY_RATE,
      maximumWaitRate: MAXIMUM_WAIT_RATE,
    },
    counts: {
      totalRecords: records.length,
      evaluatedRecords: evaluatedRecords.length,
      evaluatedRoleInputs: inputs.length,
    },
    metrics: {
      directionDominance,
      uniqueSummaryRate,
      waitRate,
    },
    directionCounts,
    blockingReasons,
    actions: actionsFor(status),
  };
}

function blockingReasonsFor({
  evaluatedRecordCount,
  directionDominance,
  uniqueSummaryRate,
  waitRate,
}: {
  evaluatedRecordCount: number;
  directionDominance: number;
  uniqueSummaryRate: number;
  waitRate: number;
}) {
  const reasons: string[] = [];
  if (evaluatedRecordCount < MINIMUM_EVALUATED_RECORDS) {
    reasons.push("insufficient_role_diversity_samples");
  }
  if (directionDominance > MAXIMUM_DIRECTION_DOMINANCE) {
    reasons.push("role_direction_monoculture");
  }
  if (uniqueSummaryRate < MINIMUM_UNIQUE_SUMMARY_RATE) {
    reasons.push("role_summary_duplication");
  }
  if (waitRate > MAXIMUM_WAIT_RATE) {
    reasons.push("pm_wait_bias_high");
  }
  return reasons;
}

function statusFor({
  blockingReasons,
  directionDominance,
  uniqueSummaryRate,
  waitRate,
}: {
  blockingReasons: readonly string[];
  directionDominance: number;
  uniqueSummaryRate: number;
  waitRate: number;
}) {
  if (blockingReasons.length === 0) return "ready";
  if (directionDominance > 0.9 || uniqueSummaryRate < 0.4 || waitRate > 0.9) return "critical";
  return "degraded";
}

function countDirections(directions: readonly AnalystDirection[]) {
  return directions.reduce<Partial<Record<AnalystDirection, number>>>((counts, direction) => {
    counts[direction] = (counts[direction] ?? 0) + 1;
    return counts;
  }, {});
}

function normalizeText(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function ratio(numerator: number, denominator: number) {
  if (denominator <= 0) return 0;
  return Number((numerator / denominator).toFixed(3));
}

function actionsFor(
  status: DecisionOpsRoleDiversityGateStatus,
): DecisionOpsRoleDiversityGateAction[] {
  if (status === "ready") return [];
  return [
    {
      title: "Hold model-quality expansion until roles diverge",
      description:
        "Analyst directions and summaries must show distinct role work before increasing cadence or making quality claims.",
      executable: false,
    },
  ];
}
