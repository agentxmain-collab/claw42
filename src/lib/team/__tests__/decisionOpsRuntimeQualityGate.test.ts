import { describe, expect, it } from "vitest";
import {
  buildDecisionOpsRuntimeQualityGate,
  type DecisionOpsRuntimeQualityGateReport,
} from "@/lib/team/decisionOpsRuntimeQualityGate";
import type { DecisionOpsModelQualityEvidenceReport } from "@/lib/team/decisionOpsModelQualityEvidence";
import type { DecisionOpsRuntimeStabilityGateReport } from "@/lib/team/decisionOpsRuntimeStabilityGate";
import type { DecisionOpsSparseReleaseGateReport } from "@/lib/team/decisionOpsSparseReleaseGate";

const generatedAt = "2026-05-19T12:00:00.000Z";

function runtimeStability(
  overrides: Partial<DecisionOpsRuntimeStabilityGateReport> = {},
): DecisionOpsRuntimeStabilityGateReport {
  return {
    schemaVersion: 1,
    generatedAt,
    status: "ready_for_runtime_observe",
    readyForLongRunningPreview: true,
    canChangeRefreshBehavior: false,
    publicBehaviorChanged: false,
    sourceStatuses: {
      residentCoverage: "ready",
      outputStability: "healthy",
    },
    summary: {
      allGlobalLanesCovered: true,
      publicPmEvents: 3,
      uniqueCandidateCards: 3,
      duplicateCandidateCards: 0,
      stageProgressGaps: 0,
      unstableOrderEvents: 0,
    },
    blockingReasons: [],
    nextActions: [],
    ...overrides,
  };
}

function modelEvidence(
  overrides: Partial<DecisionOpsModelQualityEvidenceReport> = {},
): DecisionOpsModelQualityEvidenceReport {
  return {
    schemaVersion: 1,
    generatedAt,
    status: "ready",
    evidenceReady: true,
    canIncreaseModelCost: false,
    canReduceModelFanout: false,
    sourceStatuses: {
      qualityBaseline: "healthy",
      modelQuality: "healthy",
    },
    summary: {
      scoredRuns: 9,
      candidateTypesCovered: 3,
      publishableRate: 1,
      averageScore: 86,
      primaryRisk: null,
    },
    blockingReasons: [],
    nextActions: [],
    ...overrides,
  };
}

function sparseRelease(
  overrides: Partial<DecisionOpsSparseReleaseGateReport> = {},
): DecisionOpsSparseReleaseGateReport {
  return {
    schemaVersion: 1,
    generatedAt,
    status: "hold",
    telemetryOnlyReleaseAllowed: false,
    liveSparseReleaseAllowed: false,
    productionReleaseAllowed: false,
    nextStep: "hold_sparse_release",
    blockingReasons: ["sparse_runtime_plan_not_ready"],
    ...overrides,
  };
}

describe("buildDecisionOpsRuntimeQualityGate", () => {
  it("allows long-running full-team preview observe when runtime and model quality are ready", () => {
    const report = buildDecisionOpsRuntimeQualityGate({
      runtimeStability: runtimeStability(),
      modelQualityEvidence: modelEvidence(),
      sparseReleaseGate: sparseRelease(),
    });

    expect(report).toMatchObject({
      schemaVersion: 1,
      status: "ready_for_full_team_observe",
      longRunningPreviewAllowed: true,
      sparseTelemetryAllowed: false,
      liveSparseReleaseAllowed: false,
      productionReleaseAllowed: false,
      blockingReasons: ["sparse_runtime_plan_not_ready"],
    } satisfies Partial<DecisionOpsRuntimeQualityGateReport>);
  });

  it("adds sparse telemetry observe only when the B105 release gate is green", () => {
    const report = buildDecisionOpsRuntimeQualityGate({
      runtimeStability: runtimeStability(),
      modelQualityEvidence: modelEvidence(),
      sparseReleaseGate: sparseRelease({
        status: "ready_for_telemetry_only_release",
        telemetryOnlyReleaseAllowed: true,
        nextStep: "ship_shadow_telemetry_only",
        blockingReasons: [],
      }),
    });

    expect(report).toMatchObject({
      status: "ready_for_sparse_telemetry_observe",
      longRunningPreviewAllowed: true,
      sparseTelemetryAllowed: true,
      liveSparseReleaseAllowed: false,
      productionReleaseAllowed: false,
      blockingReasons: [],
    });
  });

  it("holds when runtime stability or model evidence is not ready", () => {
    const report = buildDecisionOpsRuntimeQualityGate({
      runtimeStability: runtimeStability({
        status: "hold",
        readyForLongRunningPreview: false,
        blockingReasons: ["resident_prewarm_not_ready"],
      }),
      modelQualityEvidence: modelEvidence({
        status: "hold",
        evidenceReady: false,
        blockingReasons: ["public_content_leak"],
      }),
      sparseReleaseGate: sparseRelease(),
    });

    expect(report).toMatchObject({
      status: "hold",
      longRunningPreviewAllowed: false,
      sparseTelemetryAllowed: false,
      blockingReasons: [
        "resident_prewarm_not_ready",
        "runtime_stability_not_ready",
        "public_content_leak",
        "model_quality_evidence_not_ready",
        "sparse_runtime_plan_not_ready",
      ],
    });
  });
});
