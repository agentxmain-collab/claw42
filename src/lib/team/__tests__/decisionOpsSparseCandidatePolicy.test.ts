import { describe, expect, it } from "vitest";
import { buildDecisionOpsSparseCandidatePolicy } from "@/lib/team/decisionOpsSparseCandidatePolicy";
import type { DecisionOpsSparseShadowTelemetryReport } from "@/lib/team/decisionOpsSparseShadowTelemetry";

const generatedAt = "2026-05-19T12:00:00.000Z";

function telemetry(): DecisionOpsSparseShadowTelemetryReport {
  return {
    schemaVersion: 1,
    generatedAt,
    status: "telemetry_ready",
    telemetryMode: "shadow_only",
    canRecordShadowTelemetry: true,
    liveFanoutChanged: false,
    publicBehaviorChanged: false,
    summary: {
      recordsEvaluated: 9,
      safeRecords: 9,
      riskyRecords: 0,
      avoidedCallRate: 0.41,
      missedContributions: 0,
      missedWarnings: 0,
      traceGaps: 0,
    },
    candidateTypes: [
      {
        candidateType: "market_overview",
        recordsEvaluated: 3,
        safeRecords: 3,
        riskyRecords: 0,
        avoidedCallRate: 0.05,
        riskCounts: { missedContributions: 0, missedWarnings: 0, traceGaps: 0 },
        recommendation: "keep_full_team",
      },
      {
        candidateType: "hotspot",
        recordsEvaluated: 3,
        safeRecords: 3,
        riskyRecords: 0,
        avoidedCallRate: 0.35,
        riskCounts: { missedContributions: 0, missedWarnings: 0, traceGaps: 0 },
        recommendation: "candidate_ready_for_shadow",
      },
      {
        candidateType: "symbol",
        recordsEvaluated: 3,
        safeRecords: 3,
        riskyRecords: 0,
        avoidedCallRate: 0.6,
        riskCounts: { missedContributions: 0, missedWarnings: 0, traceGaps: 0 },
        recommendation: "candidate_ready_for_shadow",
      },
    ],
    roleRiskHighlights: [],
    recommendations: [],
  };
}

describe("buildDecisionOpsSparseCandidatePolicy", () => {
  it("keeps market overview high-cost/full-team while allowing guarded shadow policy for hotspot and symbol", () => {
    const report = buildDecisionOpsSparseCandidatePolicy({ sparseTelemetry: telemetry() });

    expect(report).toMatchObject({
      schemaVersion: 1,
      status: "policy_ready",
      canChangeLiveFanout: false,
      publicBehaviorChanged: false,
    });
    expect(report.policies).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          candidateType: "market_overview",
          recommendedRuntimeMode: "full_team",
          liveSparseAllowed: false,
        }),
        expect.objectContaining({
          candidateType: "hotspot",
          recommendedRuntimeMode: "shadow_sparse",
          liveSparseAllowed: false,
        }),
        expect.objectContaining({
          candidateType: "symbol",
          recommendedRuntimeMode: "shadow_sparse",
          liveSparseAllowed: false,
        }),
      ]),
    );
  });

  it("holds candidate policy when telemetry is not safe", () => {
    const unsafe = telemetry();
    unsafe.status = "risk_detected";
    unsafe.canRecordShadowTelemetry = false;
    unsafe.candidateTypes[1] = {
      ...unsafe.candidateTypes[1],
      riskyRecords: 1,
      riskCounts: { missedContributions: 1, missedWarnings: 0, traceGaps: 0 },
      recommendation: "keep_full_team",
    };

    const report = buildDecisionOpsSparseCandidatePolicy({ sparseTelemetry: unsafe });

    expect(report).toMatchObject({
      status: "policy_blocked",
      blockingReasons: ["sparse_shadow_telemetry_not_safe"],
    });
    expect(report.policies.find((policy) => policy.candidateType === "hotspot")).toMatchObject({
      recommendedRuntimeMode: "full_team",
      liveSparseAllowed: false,
    });
  });
});
