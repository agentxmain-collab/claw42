import type { DecisionOpsSparseShadowTelemetryReport } from "@/lib/team/decisionOpsSparseShadowTelemetry";
import type { CandidateType } from "@/lib/watch/decisionCandidate";

export type DecisionOpsSparseCandidatePolicyStatus = "policy_ready" | "policy_blocked";
export type DecisionOpsSparseCandidateRuntimeMode = "full_team" | "shadow_sparse";

export interface DecisionOpsSparseCandidatePolicy {
  candidateType: CandidateType;
  recommendedRuntimeMode: DecisionOpsSparseCandidateRuntimeMode;
  liveSparseAllowed: false;
  reason: string;
}

export interface DecisionOpsSparseCandidatePolicyAction {
  title: string;
  description: string;
  executable: false;
}

export interface DecisionOpsSparseCandidatePolicyReport {
  schemaVersion: 1;
  generatedAt: string;
  status: DecisionOpsSparseCandidatePolicyStatus;
  canChangeLiveFanout: false;
  publicBehaviorChanged: false;
  policies: DecisionOpsSparseCandidatePolicy[];
  blockingReasons: string[];
  recommendations: DecisionOpsSparseCandidatePolicyAction[];
}

const CANDIDATE_TYPES: CandidateType[] = ["market_overview", "hotspot", "symbol"];

export function buildDecisionOpsSparseCandidatePolicy({
  sparseTelemetry,
  now = Date.now(),
}: {
  sparseTelemetry: DecisionOpsSparseShadowTelemetryReport;
  now?: number;
}): DecisionOpsSparseCandidatePolicyReport {
  const status: DecisionOpsSparseCandidatePolicyStatus = sparseTelemetry.canRecordShadowTelemetry
    ? "policy_ready"
    : "policy_blocked";
  return {
    schemaVersion: 1,
    generatedAt: new Date(now).toISOString(),
    status,
    canChangeLiveFanout: false,
    publicBehaviorChanged: false,
    policies: CANDIDATE_TYPES.map((candidateType) =>
      policyFor({
        candidateType,
        sparseTelemetry,
        blocked: status === "policy_blocked",
      }),
    ),
    blockingReasons: status === "policy_blocked" ? ["sparse_shadow_telemetry_not_safe"] : [],
    recommendations: recommendationsFor(status),
  };
}

function policyFor({
  candidateType,
  sparseTelemetry,
  blocked,
}: {
  candidateType: CandidateType;
  sparseTelemetry: DecisionOpsSparseShadowTelemetryReport;
  blocked: boolean;
}): DecisionOpsSparseCandidatePolicy {
  const candidateTelemetry = sparseTelemetry.candidateTypes.find(
    (entry) => entry.candidateType === candidateType,
  );
  if (candidateType === "market_overview") {
    return {
      candidateType,
      recommendedRuntimeMode: "full_team",
      liveSparseAllowed: false,
      reason: "Market overview is high-value global analysis; keep full-team coverage.",
    };
  }
  if (blocked || candidateTelemetry?.riskyRecords) {
    return {
      candidateType,
      recommendedRuntimeMode: "full_team",
      liveSparseAllowed: false,
      reason: "Sparse shadow telemetry is not safe enough for this candidate type.",
    };
  }
  return {
    candidateType,
    recommendedRuntimeMode: "shadow_sparse",
    liveSparseAllowed: false,
    reason: "Candidate type may be measured in shadow sparse mode only.",
  };
}

function recommendationsFor(
  status: DecisionOpsSparseCandidatePolicyStatus,
): DecisionOpsSparseCandidatePolicyAction[] {
  if (status === "policy_ready") {
    return [
      {
        title: "Keep market overview full-team; measure hotspot and symbol sparsity in shadow",
        description:
          "The candidate policy separates high-value global analysis from lower-risk candidate types without enabling live sparse fan-out.",
        executable: false,
      },
    ];
  }
  return [
    {
      title: "Keep all candidate types full-team",
      description: "Candidate policy is blocked until sparse shadow telemetry is risk-free.",
      executable: false,
    },
  ];
}
