import { describe, expect, it } from "vitest";
import { buildDecisionOpsSparseReadiness } from "@/lib/team/decisionOpsSparseReadiness";
import type { DecisionOpsSparseConfigGateReport } from "@/lib/team/decisionOpsSparseConfigGate";
import type { DecisionOpsSparseExecutionReport } from "@/lib/team/decisionOpsSparseExecution";
import type { DecisionOpsSparseShadowReport } from "@/lib/team/decisionOpsSparseShadow";
import type { DecisionOpsSparseShadowHistoryReport } from "@/lib/team/decisionOpsSparseShadowHistory";

const generatedAt = "2026-05-19T12:00:00.000Z";

function sparseExecution(
  overrides: Partial<DecisionOpsSparseExecutionReport> = {},
): DecisionOpsSparseExecutionReport {
  return {
    schemaVersion: 1,
    generatedAt,
    status: "ready_for_sparse_trial",
    traceCoverage: {
      totalRecords: 6,
      recordsWithTrace: 6,
      missingTraceRecords: 0,
      coverageRate: 1,
      minimumTracedRecordsForPolicy: 3,
    },
    callModel: {
      fullTeamCalls: 84,
      observedSparseCalls: 42,
      avoidedCalls: 42,
      avoidedCallRate: 0.5,
      fullTeamSize: 14,
    },
    roles: [],
    recommendations: [],
    ...overrides,
  };
}

function sparseShadow(
  overrides: Partial<DecisionOpsSparseShadowReport> = {},
): DecisionOpsSparseShadowReport {
  return {
    schemaVersion: 1,
    generatedAt,
    status: "ready_for_shadow_trial",
    safeToTrial: true,
    sourceSparseStatus: "ready_for_sparse_trial",
    callModel: {
      fullTeamCalls: 84,
      shadowCalls: 42,
      avoidedCalls: 42,
      avoidedCallRate: 0.5,
    },
    riskCounts: {
      missedContributions: 0,
      missedWarnings: 0,
      traceGaps: 0,
    },
    roleOutcomes: [],
    recordOutcomes: [],
    recommendations: [],
    ...overrides,
  };
}

function sparseShadowHistory(
  overrides: Partial<DecisionOpsSparseShadowHistoryReport> = {},
): DecisionOpsSparseShadowHistoryReport {
  return {
    schemaVersion: 1,
    generatedAt,
    status: "ready_for_config_gate",
    safeToPrepareConfigGate: true,
    parameters: {
      batchSize: 3,
      minimumSafeBatches: 2,
    },
    stability: {
      totalRecords: 6,
      totalBatches: 2,
      evaluatedBatches: 2,
      safeBatches: 2,
      riskyBatches: 0,
      insufficientBatches: 0,
      consecutiveSafeBatches: 2,
      partialRecordRemainder: 0,
    },
    batchOutcomes: [],
    recommendations: [],
    ...overrides,
  };
}

function sparseConfigGate(
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

describe("buildDecisionOpsSparseReadiness", () => {
  it("marks the system ready for shadow telemetry when all sparse diagnostics are green", () => {
    const report = buildDecisionOpsSparseReadiness({
      sparseExecution: sparseExecution(),
      sparseShadow: sparseShadow(),
      sparseShadowHistory: sparseShadowHistory(),
      sparseConfigGate: sparseConfigGate(),
    });

    expect(report).toMatchObject({
      schemaVersion: 1,
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
        consecutiveSafeBatches: 2,
        avoidedCallRate: 0.5,
        missedContributions: 0,
        missedWarnings: 0,
        traceGaps: 0,
      },
    });
    expect(report.nextActions[0]).toMatchObject({
      title: "Add shadow telemetry without changing live fan-out",
      executable: false,
    });
  });

  it("waits for the config gate when history is safe but mode is still off", () => {
    const report = buildDecisionOpsSparseReadiness({
      sparseExecution: sparseExecution(),
      sparseShadow: sparseShadow(),
      sparseShadowHistory: sparseShadowHistory(),
      sparseConfigGate: sparseConfigGate({
        status: "disabled",
        configuredMode: "off",
        configGateOpen: false,
      }),
    });

    expect(report).toMatchObject({
      status: "ready_for_shadow_config",
      readinessLevel: "waiting",
      canProceedToShadowTelemetry: false,
      blockingReasons: ["sparse_config_gate_not_shadow_ready"],
    });
  });

  it("blocks when sparse shadow detects missed contribution risk", () => {
    const report = buildDecisionOpsSparseReadiness({
      sparseExecution: sparseExecution(),
      sparseShadow: sparseShadow({
        status: "shadow_risk_detected",
        safeToTrial: false,
        riskCounts: {
          missedContributions: 1,
          missedWarnings: 0,
          traceGaps: 0,
        },
      }),
      sparseShadowHistory: sparseShadowHistory({
        status: "shadow_risk_detected",
        safeToPrepareConfigGate: false,
      }),
      sparseConfigGate: sparseConfigGate({
        status: "blocked_by_history",
        safeToEnableShadow: false,
        configGateOpen: false,
        blockingReasons: ["sparse_shadow_history_not_ready"],
      }),
    });

    expect(report).toMatchObject({
      status: "blocked_by_shadow_risk",
      readinessLevel: "blocked",
      canProceedToShadowTelemetry: false,
      blockingReasons: expect.arrayContaining([
        "sparse_shadow_not_safe",
        "sparse_shadow_history_not_ready",
      ]),
    });
  });

  it("keeps collecting trace when sparse execution does not have enough data", () => {
    const report = buildDecisionOpsSparseReadiness({
      sparseExecution: sparseExecution({
        status: "insufficient_trace_data",
        traceCoverage: {
          totalRecords: 2,
          recordsWithTrace: 1,
          missingTraceRecords: 1,
          coverageRate: 0.5,
          minimumTracedRecordsForPolicy: 3,
        },
      }),
      sparseShadow: sparseShadow({
        status: "insufficient_trace_data",
        safeToTrial: false,
      }),
      sparseShadowHistory: sparseShadowHistory({
        status: "insufficient_shadow_batches",
        safeToPrepareConfigGate: false,
      }),
      sparseConfigGate: sparseConfigGate({
        status: "blocked_by_history",
        safeToEnableShadow: false,
        configGateOpen: false,
      }),
    });

    expect(report).toMatchObject({
      status: "collecting_trace",
      readinessLevel: "waiting",
      canProceedToShadowTelemetry: false,
      summary: {
        tracedRecords: 1,
      },
    });
  });
});
