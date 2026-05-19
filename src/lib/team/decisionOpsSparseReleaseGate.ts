import type { DecisionOpsSparseCandidatePolicyReport } from "@/lib/team/decisionOpsSparseCandidatePolicy";
import type { DecisionOpsSparseOperatorReport } from "@/lib/team/decisionOpsSparseOperatorReport";
import type { DecisionOpsSparseRuntimePlanReport } from "@/lib/team/decisionOpsSparseRuntimePlan";
import type { DecisionOpsSparseShadowTelemetryReport } from "@/lib/team/decisionOpsSparseShadowTelemetry";

export type DecisionOpsSparseReleaseGateStatus = "hold" | "ready_for_telemetry_only_release";
export type DecisionOpsSparseReleaseGateNextStep =
  | "hold_sparse_release"
  | "ship_shadow_telemetry_only";

export interface DecisionOpsSparseReleaseGateReport {
  schemaVersion: 1;
  generatedAt: string;
  status: DecisionOpsSparseReleaseGateStatus;
  telemetryOnlyReleaseAllowed: boolean;
  liveSparseReleaseAllowed: false;
  productionReleaseAllowed: false;
  nextStep: DecisionOpsSparseReleaseGateNextStep;
  blockingReasons: string[];
}

export function buildDecisionOpsSparseReleaseGate({
  sparseOperatorReport,
  sparseTelemetry,
  sparseCandidatePolicy,
  sparseRuntimePlan,
  now = Date.now(),
}: {
  sparseOperatorReport: DecisionOpsSparseOperatorReport;
  sparseTelemetry: DecisionOpsSparseShadowTelemetryReport;
  sparseCandidatePolicy: DecisionOpsSparseCandidatePolicyReport;
  sparseRuntimePlan: DecisionOpsSparseRuntimePlanReport;
  now?: number;
}): DecisionOpsSparseReleaseGateReport {
  const blockingReasons = blockingReasonsFor({
    sparseOperatorReport,
    sparseTelemetry,
    sparseCandidatePolicy,
    sparseRuntimePlan,
  });
  const telemetryOnlyReleaseAllowed = blockingReasons.length === 0;
  return {
    schemaVersion: 1,
    generatedAt: new Date(now).toISOString(),
    status: telemetryOnlyReleaseAllowed ? "ready_for_telemetry_only_release" : "hold",
    telemetryOnlyReleaseAllowed,
    liveSparseReleaseAllowed: false,
    productionReleaseAllowed: false,
    nextStep: telemetryOnlyReleaseAllowed ? "ship_shadow_telemetry_only" : "hold_sparse_release",
    blockingReasons,
  };
}

function blockingReasonsFor({
  sparseOperatorReport,
  sparseTelemetry,
  sparseCandidatePolicy,
  sparseRuntimePlan,
}: {
  sparseOperatorReport: DecisionOpsSparseOperatorReport;
  sparseTelemetry: DecisionOpsSparseShadowTelemetryReport;
  sparseCandidatePolicy: DecisionOpsSparseCandidatePolicyReport;
  sparseRuntimePlan: DecisionOpsSparseRuntimePlanReport;
}) {
  const reasons: string[] = [];
  if (!sparseOperatorReport.canProceedToShadowTelemetry) {
    reasons.push(...sparseOperatorReport.blockingReasons, "sparse_operator_report_not_ready");
  }
  if (!sparseTelemetry.canRecordShadowTelemetry) {
    reasons.push("sparse_shadow_telemetry_not_ready");
  }
  if (sparseCandidatePolicy.status !== "policy_ready") {
    reasons.push(...sparseCandidatePolicy.blockingReasons, "sparse_candidate_policy_not_ready");
  }
  if (sparseRuntimePlan.status !== "shadow_plan_ready") {
    reasons.push("sparse_runtime_plan_not_ready");
  }
  return Array.from(new Set(reasons));
}
