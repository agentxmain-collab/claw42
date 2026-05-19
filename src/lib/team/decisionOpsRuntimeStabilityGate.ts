import type { DecisionOpsPublicOutputStabilityReport } from "@/lib/team/decisionOpsPublicOutputStability";
import type {
  DecisionOpsResidentPrewarmCoverageReport,
  DecisionOpsResidentPrewarmCoverageStatus,
} from "@/lib/team/decisionOpsResidentPrewarmCoverage";

export type DecisionOpsRuntimeStabilityGateStatus = "hold" | "ready_for_runtime_observe";

export interface DecisionOpsRuntimeStabilityGateAction {
  title: string;
  description: string;
  executable: false;
}

export interface DecisionOpsRuntimeStabilityGateReport {
  schemaVersion: 1;
  generatedAt: string;
  status: DecisionOpsRuntimeStabilityGateStatus;
  readyForLongRunningPreview: boolean;
  canChangeRefreshBehavior: false;
  publicBehaviorChanged: false;
  sourceStatuses: {
    residentCoverage: DecisionOpsResidentPrewarmCoverageStatus;
    outputStability: DecisionOpsPublicOutputStabilityReport["status"];
  };
  summary: {
    allGlobalLanesCovered: boolean;
    publicPmEvents: number;
    uniqueCandidateCards: number;
    duplicateCandidateCards: number;
    stageProgressGaps: number;
    unstableOrderEvents: number;
  };
  blockingReasons: string[];
  nextActions: DecisionOpsRuntimeStabilityGateAction[];
}

export function buildDecisionOpsRuntimeStabilityGate({
  residentCoverage,
  outputStability,
  now = Date.now(),
}: {
  residentCoverage: DecisionOpsResidentPrewarmCoverageReport;
  outputStability: DecisionOpsPublicOutputStabilityReport;
  now?: number;
}): DecisionOpsRuntimeStabilityGateReport {
  const blockingReasons = blockingReasonsFor({ residentCoverage, outputStability });
  const ready = blockingReasons.length === 0;

  return {
    schemaVersion: 1,
    generatedAt: new Date(now).toISOString(),
    status: ready ? "ready_for_runtime_observe" : "hold",
    readyForLongRunningPreview: ready,
    canChangeRefreshBehavior: false,
    publicBehaviorChanged: false,
    sourceStatuses: {
      residentCoverage: residentCoverage.status,
      outputStability: outputStability.status,
    },
    summary: {
      allGlobalLanesCovered: residentCoverage.allGlobalLanesCovered,
      publicPmEvents: outputStability.counts.publicPmEvents,
      uniqueCandidateCards: outputStability.counts.uniqueCandidateCards,
      duplicateCandidateCards: outputStability.counts.duplicateCandidateCards,
      stageProgressGaps: outputStability.counts.stageProgressGaps,
      unstableOrderEvents: outputStability.counts.unstableOrderEvents,
    },
    blockingReasons,
    nextActions: nextActionsFor(ready),
  };
}

function blockingReasonsFor({
  residentCoverage,
  outputStability,
}: {
  residentCoverage: DecisionOpsResidentPrewarmCoverageReport;
  outputStability: DecisionOpsPublicOutputStabilityReport;
}) {
  const reasons: string[] = [];
  if (residentCoverage.status !== "ready" || !residentCoverage.allGlobalLanesCovered) {
    reasons.push(...residentCoverage.blockingReasons, "resident_prewarm_not_ready");
  }
  if (outputStability.status !== "healthy") {
    reasons.push("public_output_stability_not_ready");
  }
  if (outputStability.counts.duplicateCandidateCards > 0) {
    reasons.push("duplicate_candidate_card");
  }
  if (outputStability.counts.stageProgressGaps > 0) {
    reasons.push("stage_progress_gap");
  }
  if (outputStability.counts.unstableOrderEvents > 0 || !outputStability.order.stable) {
    reasons.push("unstable_order");
  }
  if (outputStability.counts.publicPmEvents < outputStability.thresholds.minimumVisibleCards) {
    reasons.push("minimum_visible_cards_gap");
  }
  return Array.from(new Set(reasons));
}

function nextActionsFor(ready: boolean): DecisionOpsRuntimeStabilityGateAction[] {
  if (ready) return [];
  return [
    {
      title: "Hold runtime behavior changes until the public board is stable",
      description:
        "Global resident analysis, card dedupe, canonical ordering, and stage monotonicity must all be clean before changing refresh or release behavior.",
      executable: false,
    },
  ];
}
