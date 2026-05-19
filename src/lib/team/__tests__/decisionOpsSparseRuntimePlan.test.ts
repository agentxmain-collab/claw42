import { describe, expect, it } from "vitest";
import { buildDecisionOpsSparseRuntimePlan } from "@/lib/team/decisionOpsSparseRuntimePlan";
import type { DecisionOpsSparseCandidatePolicyReport } from "@/lib/team/decisionOpsSparseCandidatePolicy";
import type { DecisionOpsSparseConfigGateReport } from "@/lib/team/decisionOpsSparseConfigGate";
import type { DecisionOpsSparseReadinessReport } from "@/lib/team/decisionOpsSparseReadiness";

const generatedAt = "2026-05-19T12:00:00.000Z";

function readiness(
  overrides: Partial<DecisionOpsSparseReadinessReport> = {},
): DecisionOpsSparseReadinessReport {
  return {
    schemaVersion: 1,
    generatedAt,
    status: "ready_for_shadow_telemetry",
    readinessLevel: "ready",
    canProceedToShadowTelemetry: true,
    canChangeLiveFanout: false,
    canChangePublicBehavior: false,
    sourceStatuses: {
      sparseExecution: "ready_for_sparse_trial",
      sparseShadow: "ready_for_shadow_trial",
      sparseShadowHistory: "ready_for_config_gate",
      sparseConfigGate: "shadow_ready",
    },
    summary: {
      tracedRecords: 6,
      traceCoverageRate: 1,
      consecutiveSafeBatches: 2,
      avoidedCallRate: 0.5,
      missedContributions: 0,
      missedWarnings: 0,
      traceGaps: 0,
    },
    blockingReasons: [],
    nextActions: [],
    ...overrides,
  };
}

function config(
  overrides: Partial<DecisionOpsSparseConfigGateReport> = {},
): DecisionOpsSparseConfigGateReport {
  return {
    schemaVersion: 1,
    generatedAt,
    status: "shadow_ready",
    configuredMode: "shadow",
    safeToEnableShadow: true,
    configGateOpen: true,
    sourceHistoryStatus: "ready_for_config_gate",
    runtimeEffect: {
      executionMode: "diagnostics_only",
      liveFanoutChangeAllowed: false,
      publicBehaviorChangeAllowed: false,
    },
    blockingReasons: [],
    configIssues: [],
    recommendations: [],
    ...overrides,
  };
}

function policy(): DecisionOpsSparseCandidatePolicyReport {
  return {
    schemaVersion: 1,
    generatedAt,
    status: "policy_ready",
    canChangeLiveFanout: false,
    publicBehaviorChanged: false,
    policies: [
      {
        candidateType: "market_overview",
        recommendedRuntimeMode: "full_team",
        liveSparseAllowed: false,
        reason: "global analysis stays full team",
      },
      {
        candidateType: "hotspot",
        recommendedRuntimeMode: "shadow_sparse",
        liveSparseAllowed: false,
        reason: "safe for shadow",
      },
      {
        candidateType: "symbol",
        recommendedRuntimeMode: "shadow_sparse",
        liveSparseAllowed: false,
        reason: "safe for shadow",
      },
    ],
    blockingReasons: [],
    recommendations: [],
  };
}

describe("buildDecisionOpsSparseRuntimePlan", () => {
  it("creates a diagnostics-only shadow runtime plan without executing sparse roles live", () => {
    const report = buildDecisionOpsSparseRuntimePlan({
      sparseReadiness: readiness(),
      sparseConfigGate: config(),
      sparseCandidatePolicy: policy(),
    });

    expect(report).toMatchObject({
      schemaVersion: 1,
      status: "shadow_plan_ready",
      configuredMode: "shadow",
      executionMode: "diagnostics_only",
      willExecuteSparseRoles: false,
      willCallAdditionalModels: false,
      willChangePublicPayload: false,
      canChangeLiveFanout: false,
    });
    expect(report.candidatePlans).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ candidateType: "market_overview", runtimeMode: "full_team" }),
        expect.objectContaining({ candidateType: "hotspot", runtimeMode: "shadow_sparse" }),
      ]),
    );
  });

  it("stays disabled when the config gate is off", () => {
    const report = buildDecisionOpsSparseRuntimePlan({
      sparseReadiness: readiness({
        status: "ready_for_shadow_config",
        readinessLevel: "waiting",
        canProceedToShadowTelemetry: false,
        blockingReasons: ["sparse_config_gate_not_shadow_ready"],
      }),
      sparseConfigGate: config({
        status: "disabled",
        configuredMode: "off",
        configGateOpen: false,
      }),
      sparseCandidatePolicy: policy(),
    });

    expect(report).toMatchObject({
      status: "disabled",
      configuredMode: "off",
      willExecuteSparseRoles: false,
      blockingReasons: ["sparse_config_gate_not_shadow_ready"],
    });
  });
});
