import { describe, expect, it } from "vitest";
import { buildDecisionOpsSparseReleaseGate } from "@/lib/team/decisionOpsSparseReleaseGate";
import type { DecisionOpsSparseCandidatePolicyReport } from "@/lib/team/decisionOpsSparseCandidatePolicy";
import type { DecisionOpsSparseOperatorReport } from "@/lib/team/decisionOpsSparseOperatorReport";
import type { DecisionOpsSparseRuntimePlanReport } from "@/lib/team/decisionOpsSparseRuntimePlan";
import type { DecisionOpsSparseShadowTelemetryReport } from "@/lib/team/decisionOpsSparseShadowTelemetry";

const generatedAt = "2026-05-19T12:00:00.000Z";

function operator(
  overrides: Partial<DecisionOpsSparseOperatorReport> = {},
): DecisionOpsSparseOperatorReport {
  return {
    schemaVersion: 1,
    generatedAt,
    status: "shadow_telemetry_ready",
    headline: "Sparse diagnostics are ready for telemetry-only shadow work.",
    canProceedToShadowTelemetry: true,
    canChangeLiveFanout: false,
    canChangePublicBehavior: false,
    decisions: [],
    blockingReasons: [],
    nextActions: [],
    ...overrides,
  };
}

function telemetry(
  overrides: Partial<DecisionOpsSparseShadowTelemetryReport> = {},
): DecisionOpsSparseShadowTelemetryReport {
  return {
    schemaVersion: 1,
    generatedAt,
    status: "telemetry_ready",
    telemetryMode: "shadow_only",
    canRecordShadowTelemetry: true,
    liveFanoutChanged: false,
    publicBehaviorChanged: false,
    summary: {
      recordsEvaluated: 6,
      safeRecords: 6,
      riskyRecords: 0,
      avoidedCallRate: 0.5,
      missedContributions: 0,
      missedWarnings: 0,
      traceGaps: 0,
    },
    candidateTypes: [],
    roleRiskHighlights: [],
    recommendations: [],
    ...overrides,
  };
}

function policy(
  overrides: Partial<DecisionOpsSparseCandidatePolicyReport> = {},
): DecisionOpsSparseCandidatePolicyReport {
  return {
    schemaVersion: 1,
    generatedAt,
    status: "policy_ready",
    canChangeLiveFanout: false,
    publicBehaviorChanged: false,
    policies: [],
    blockingReasons: [],
    recommendations: [],
    ...overrides,
  };
}

function runtime(
  overrides: Partial<DecisionOpsSparseRuntimePlanReport> = {},
): DecisionOpsSparseRuntimePlanReport {
  return {
    schemaVersion: 1,
    generatedAt,
    status: "shadow_plan_ready",
    configuredMode: "shadow",
    executionMode: "diagnostics_only",
    willExecuteSparseRoles: false,
    willCallAdditionalModels: false,
    willChangePublicPayload: false,
    canChangeLiveFanout: false,
    candidatePlans: [],
    blockingReasons: [],
    nextActions: [],
    ...overrides,
  };
}

describe("buildDecisionOpsSparseReleaseGate", () => {
  it("allows only telemetry-only release when all sparse gates are green", () => {
    const report = buildDecisionOpsSparseReleaseGate({
      sparseOperatorReport: operator(),
      sparseTelemetry: telemetry(),
      sparseCandidatePolicy: policy(),
      sparseRuntimePlan: runtime(),
    });

    expect(report).toMatchObject({
      schemaVersion: 1,
      status: "ready_for_telemetry_only_release",
      telemetryOnlyReleaseAllowed: true,
      liveSparseReleaseAllowed: false,
      productionReleaseAllowed: false,
      nextStep: "ship_shadow_telemetry_only",
    });
  });

  it("blocks release when runtime is not in diagnostics-only shadow mode", () => {
    const report = buildDecisionOpsSparseReleaseGate({
      sparseOperatorReport: operator(),
      sparseTelemetry: telemetry(),
      sparseCandidatePolicy: policy(),
      sparseRuntimePlan: runtime({
        status: "disabled",
        configuredMode: "off",
        blockingReasons: ["sparse_config_gate_not_shadow_ready"],
      }),
    });

    expect(report).toMatchObject({
      status: "hold",
      telemetryOnlyReleaseAllowed: false,
      liveSparseReleaseAllowed: false,
      blockingReasons: ["sparse_runtime_plan_not_ready"],
    });
  });
});
