import { describe, expect, it } from "vitest";
import { buildDecisionOpsSparseOperatorReport } from "@/lib/team/decisionOpsSparseOperatorReport";
import type { DecisionOpsSparseReadinessReport } from "@/lib/team/decisionOpsSparseReadiness";
import type { DecisionOpsSparseShadowTelemetryReport } from "@/lib/team/decisionOpsSparseShadowTelemetry";

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

describe("buildDecisionOpsSparseOperatorReport", () => {
  it("summarizes a telemetry-only release path for operators", () => {
    const report = buildDecisionOpsSparseOperatorReport({
      sparseReadiness: readiness(),
      sparseTelemetry: telemetry(),
    });

    expect(report).toMatchObject({
      schemaVersion: 1,
      status: "shadow_telemetry_ready",
      headline: "Sparse diagnostics are ready for telemetry-only shadow work.",
      canProceedToShadowTelemetry: true,
      canChangeLiveFanout: false,
      canChangePublicBehavior: false,
    });
    expect(report.decisions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ area: "readiness", status: "pass" }),
        expect.objectContaining({ area: "telemetry", status: "pass" }),
        expect.objectContaining({ area: "runtime_boundary", status: "pass" }),
      ]),
    );
  });

  it("holds when telemetry reports sparse shadow risk", () => {
    const report = buildDecisionOpsSparseOperatorReport({
      sparseReadiness: readiness(),
      sparseTelemetry: telemetry({
        status: "risk_detected",
        canRecordShadowTelemetry: false,
        summary: {
          recordsEvaluated: 2,
          safeRecords: 1,
          riskyRecords: 1,
          avoidedCallRate: 0.5,
          missedContributions: 1,
          missedWarnings: 0,
          traceGaps: 0,
        },
      }),
    });

    expect(report).toMatchObject({
      status: "hold",
      canProceedToShadowTelemetry: false,
      blockingReasons: ["sparse_shadow_telemetry_risk_detected"],
    });
  });
});
