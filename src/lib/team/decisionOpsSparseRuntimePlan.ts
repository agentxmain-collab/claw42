import type { DecisionOpsSparseCandidatePolicyReport } from "@/lib/team/decisionOpsSparseCandidatePolicy";
import type { DecisionOpsSparseConfigGateReport } from "@/lib/team/decisionOpsSparseConfigGate";
import type { DecisionOpsSparseReadinessReport } from "@/lib/team/decisionOpsSparseReadiness";
import type { CandidateType } from "@/lib/watch/decisionCandidate";

export type DecisionOpsSparseRuntimePlanStatus = "disabled" | "blocked" | "shadow_plan_ready";

export interface DecisionOpsSparseRuntimeCandidatePlan {
  candidateType: CandidateType;
  runtimeMode: "full_team" | "shadow_sparse";
  liveSparseAllowed: false;
}

export interface DecisionOpsSparseRuntimePlanAction {
  title: string;
  description: string;
  executable: false;
}

export interface DecisionOpsSparseRuntimePlanReport {
  schemaVersion: 1;
  generatedAt: string;
  status: DecisionOpsSparseRuntimePlanStatus;
  configuredMode: DecisionOpsSparseConfigGateReport["configuredMode"];
  executionMode: "diagnostics_only";
  willExecuteSparseRoles: false;
  willCallAdditionalModels: false;
  willChangePublicPayload: false;
  canChangeLiveFanout: false;
  candidatePlans: DecisionOpsSparseRuntimeCandidatePlan[];
  blockingReasons: string[];
  nextActions: DecisionOpsSparseRuntimePlanAction[];
}

export function buildDecisionOpsSparseRuntimePlan({
  sparseReadiness,
  sparseConfigGate,
  sparseCandidatePolicy,
  now = Date.now(),
}: {
  sparseReadiness: DecisionOpsSparseReadinessReport;
  sparseConfigGate: DecisionOpsSparseConfigGateReport;
  sparseCandidatePolicy: DecisionOpsSparseCandidatePolicyReport;
  now?: number;
}): DecisionOpsSparseRuntimePlanReport {
  const blockingReasons = blockingReasonsFor({
    sparseReadiness,
    sparseConfigGate,
    sparseCandidatePolicy,
  });
  const status = statusFor({ sparseConfigGate, blockingReasons });

  return {
    schemaVersion: 1,
    generatedAt: new Date(now).toISOString(),
    status,
    configuredMode: sparseConfigGate.configuredMode,
    executionMode: "diagnostics_only",
    willExecuteSparseRoles: false,
    willCallAdditionalModels: false,
    willChangePublicPayload: false,
    canChangeLiveFanout: false,
    candidatePlans: sparseCandidatePolicy.policies.map((policy) => ({
      candidateType: policy.candidateType,
      runtimeMode: policy.recommendedRuntimeMode,
      liveSparseAllowed: false,
    })),
    blockingReasons,
    nextActions: nextActionsFor(status),
  };
}

function statusFor({
  sparseConfigGate,
  blockingReasons,
}: {
  sparseConfigGate: DecisionOpsSparseConfigGateReport;
  blockingReasons: readonly string[];
}): DecisionOpsSparseRuntimePlanStatus {
  if (sparseConfigGate.configuredMode === "off" || !sparseConfigGate.configGateOpen) {
    return "disabled";
  }
  if (blockingReasons.length > 0) return "blocked";
  return "shadow_plan_ready";
}

function blockingReasonsFor({
  sparseReadiness,
  sparseConfigGate,
  sparseCandidatePolicy,
}: {
  sparseReadiness: DecisionOpsSparseReadinessReport;
  sparseConfigGate: DecisionOpsSparseConfigGateReport;
  sparseCandidatePolicy: DecisionOpsSparseCandidatePolicyReport;
}) {
  const reasons: string[] = [];
  if (!sparseReadiness.canProceedToShadowTelemetry) {
    reasons.push(...sparseReadiness.blockingReasons);
  }
  if (!sparseConfigGate.configGateOpen) {
    reasons.push("sparse_config_gate_not_shadow_ready");
  }
  if (sparseCandidatePolicy.status !== "policy_ready") {
    reasons.push(...sparseCandidatePolicy.blockingReasons);
  }
  return Array.from(new Set(reasons));
}

function nextActionsFor(
  status: DecisionOpsSparseRuntimePlanStatus,
): DecisionOpsSparseRuntimePlanAction[] {
  if (status === "shadow_plan_ready") {
    return [
      {
        title: "Wire diagnostics-only sparse runtime telemetry",
        description:
          "Runtime may record the sparse plan selected for each candidate type without executing fewer roles.",
        executable: false,
      },
    ];
  }
  if (status === "disabled") {
    return [
      {
        title: "Keep sparse runtime disabled",
        description: "The config gate is not open for shadow runtime planning.",
        executable: false,
      },
    ];
  }
  return [
    {
      title: "Resolve sparse runtime blockers",
      description:
        "Readiness or candidate policy blockers must clear before runtime telemetry planning.",
      executable: false,
    },
  ];
}
