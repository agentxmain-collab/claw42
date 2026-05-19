import { describe, expect, it } from "vitest";
import { buildDecisionOpsSparseConfigGate } from "@/lib/team/decisionOpsSparseConfigGate";
import type { DecisionOpsSparseShadowHistoryReport } from "@/lib/team/decisionOpsSparseShadowHistory";

function history(
  overrides: Partial<DecisionOpsSparseShadowHistoryReport> = {},
): DecisionOpsSparseShadowHistoryReport {
  return {
    schemaVersion: 1,
    generatedAt: "2026-05-19T12:00:00.000Z",
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

describe("buildDecisionOpsSparseConfigGate", () => {
  it("defaults to disabled and keeps live fan-out unchanged even when history is ready", () => {
    const report = buildDecisionOpsSparseConfigGate({
      sparseShadowHistory: history(),
      env: {},
    });

    expect(report).toMatchObject({
      schemaVersion: 1,
      status: "disabled",
      configuredMode: "off",
      safeToEnableShadow: true,
      configGateOpen: false,
      runtimeEffect: {
        executionMode: "diagnostics_only",
        liveFanoutChangeAllowed: false,
        publicBehaviorChangeAllowed: false,
      },
    });
  });

  it("opens only the disabled shadow config gate when explicitly configured and history is safe", () => {
    const report = buildDecisionOpsSparseConfigGate({
      sparseShadowHistory: history(),
      env: {
        CLAW42_SPARSE_FANOUT_MODE: "shadow",
      },
    });

    expect(report).toMatchObject({
      status: "shadow_ready",
      configuredMode: "shadow",
      safeToEnableShadow: true,
      configGateOpen: true,
      runtimeEffect: {
        executionMode: "diagnostics_only",
        liveFanoutChangeAllowed: false,
      },
    });
    expect(report.recommendations[0]).toMatchObject({
      title: "Wire shadow telemetry before changing PM fan-out",
      executable: false,
    });
  });

  it("blocks shadow mode when sparse shadow history has recent risk", () => {
    const report = buildDecisionOpsSparseConfigGate({
      sparseShadowHistory: history({
        status: "shadow_risk_detected",
        safeToPrepareConfigGate: false,
        stability: {
          totalRecords: 6,
          totalBatches: 2,
          evaluatedBatches: 2,
          safeBatches: 1,
          riskyBatches: 1,
          insufficientBatches: 0,
          consecutiveSafeBatches: 0,
          partialRecordRemainder: 0,
        },
      }),
      env: {
        CLAW42_SPARSE_FANOUT_MODE: "shadow",
      },
    });

    expect(report).toMatchObject({
      status: "blocked_by_history",
      configuredMode: "shadow",
      safeToEnableShadow: false,
      configGateOpen: false,
      blockingReasons: ["sparse_shadow_history_not_ready"],
    });
  });

  it("fails closed on unknown sparse fan-out mode values", () => {
    const report = buildDecisionOpsSparseConfigGate({
      sparseShadowHistory: history(),
      env: {
        CLAW42_SPARSE_FANOUT_MODE: "live_sparse",
      },
    });

    expect(report).toMatchObject({
      status: "disabled",
      configuredMode: "off",
      configGateOpen: false,
      configIssues: [
        {
          name: "CLAW42_SPARSE_FANOUT_MODE",
          severity: "warning",
        },
      ],
      runtimeEffect: {
        liveFanoutChangeAllowed: false,
      },
    });
  });
});
