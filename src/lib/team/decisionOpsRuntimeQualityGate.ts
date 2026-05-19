import type { DecisionOpsModelQualityEvidenceReport } from "@/lib/team/decisionOpsModelQualityEvidence";
import type { DecisionOpsRuntimeStabilityGateReport } from "@/lib/team/decisionOpsRuntimeStabilityGate";
import type { DecisionOpsSparseReleaseGateReport } from "@/lib/team/decisionOpsSparseReleaseGate";

export type DecisionOpsRuntimeQualityGateStatus =
  | "hold"
  | "ready_for_full_team_observe"
  | "ready_for_sparse_telemetry_observe";

export interface DecisionOpsRuntimeQualityGateAction {
  title: string;
  description: string;
  executable: false;
}

export interface DecisionOpsRuntimeQualityGateReport {
  schemaVersion: 1;
  generatedAt: string;
  status: DecisionOpsRuntimeQualityGateStatus;
  longRunningPreviewAllowed: boolean;
  sparseTelemetryAllowed: boolean;
  liveSparseReleaseAllowed: false;
  productionReleaseAllowed: false;
  sourceStatuses: {
    runtimeStability: DecisionOpsRuntimeStabilityGateReport["status"];
    modelQualityEvidence: DecisionOpsModelQualityEvidenceReport["status"];
    sparseReleaseGate: DecisionOpsSparseReleaseGateReport["status"];
  };
  blockingReasons: string[];
  nextActions: DecisionOpsRuntimeQualityGateAction[];
}

export function buildDecisionOpsRuntimeQualityGate({
  runtimeStability,
  modelQualityEvidence,
  sparseReleaseGate,
  now = Date.now(),
}: {
  runtimeStability: DecisionOpsRuntimeStabilityGateReport;
  modelQualityEvidence: DecisionOpsModelQualityEvidenceReport;
  sparseReleaseGate: DecisionOpsSparseReleaseGateReport;
  now?: number;
}): DecisionOpsRuntimeQualityGateReport {
  const hardBlockingReasons = hardBlockingReasonsFor({ runtimeStability, modelQualityEvidence });
  const sparseBlockingReasons = sparseReleaseGate.telemetryOnlyReleaseAllowed
    ? []
    : sparseReleaseGate.blockingReasons;
  const longRunningPreviewAllowed = hardBlockingReasons.length === 0;
  const sparseTelemetryAllowed =
    longRunningPreviewAllowed && sparseReleaseGate.telemetryOnlyReleaseAllowed;
  const status = statusFor({ longRunningPreviewAllowed, sparseTelemetryAllowed });

  return {
    schemaVersion: 1,
    generatedAt: new Date(now).toISOString(),
    status,
    longRunningPreviewAllowed,
    sparseTelemetryAllowed,
    liveSparseReleaseAllowed: false,
    productionReleaseAllowed: false,
    sourceStatuses: {
      runtimeStability: runtimeStability.status,
      modelQualityEvidence: modelQualityEvidence.status,
      sparseReleaseGate: sparseReleaseGate.status,
    },
    blockingReasons: Array.from(new Set([...hardBlockingReasons, ...sparseBlockingReasons])),
    nextActions: nextActionsFor(status),
  };
}

function hardBlockingReasonsFor({
  runtimeStability,
  modelQualityEvidence,
}: {
  runtimeStability: DecisionOpsRuntimeStabilityGateReport;
  modelQualityEvidence: DecisionOpsModelQualityEvidenceReport;
}) {
  const reasons: string[] = [];
  if (!runtimeStability.readyForLongRunningPreview) {
    reasons.push(...runtimeStability.blockingReasons, "runtime_stability_not_ready");
  }
  if (!modelQualityEvidence.evidenceReady) {
    reasons.push(...modelQualityEvidence.blockingReasons, "model_quality_evidence_not_ready");
  }
  return reasons;
}

function statusFor({
  longRunningPreviewAllowed,
  sparseTelemetryAllowed,
}: {
  longRunningPreviewAllowed: boolean;
  sparseTelemetryAllowed: boolean;
}): DecisionOpsRuntimeQualityGateStatus {
  if (!longRunningPreviewAllowed) return "hold";
  return sparseTelemetryAllowed
    ? "ready_for_sparse_telemetry_observe"
    : "ready_for_full_team_observe";
}

function nextActionsFor(
  status: DecisionOpsRuntimeQualityGateStatus,
): DecisionOpsRuntimeQualityGateAction[] {
  if (status === "ready_for_sparse_telemetry_observe") {
    return [
      {
        title: "Observe sparse telemetry without changing live fan-out",
        description:
          "Runtime stability and model quality are clean enough for shadow telemetry only. Production and live sparse release remain locked.",
        executable: false,
      },
    ];
  }
  if (status === "ready_for_full_team_observe") {
    return [
      {
        title: "Continue long-running full-team preview observation",
        description:
          "The public board and model-quality evidence are stable, but sparse telemetry gates are not green yet.",
        executable: false,
      },
    ];
  }
  return [
    {
      title: "Hold B-line release expansion",
      description:
        "Resolve resident prewarm, public output stability, or model-quality evidence before continuing runtime changes.",
      executable: false,
    },
  ];
}
