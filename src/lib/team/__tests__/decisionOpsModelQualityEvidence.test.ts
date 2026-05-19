import { describe, expect, it } from "vitest";
import {
  buildDecisionOpsModelQualityEvidence,
  type DecisionOpsModelQualityEvidenceReport,
} from "@/lib/team/decisionOpsModelQualityEvidence";
import type { DecisionOpsModelQualityReport } from "@/lib/team/decisionOpsModelQuality";
import type { DecisionOpsQualityBaselineReport } from "@/lib/team/decisionOpsQualityBaseline";

const generatedAt = "2026-05-19T12:00:00.000Z";

function baseline(
  overrides: Partial<DecisionOpsQualityBaselineReport> = {},
): DecisionOpsQualityBaselineReport {
  return {
    schemaVersion: 1,
    generatedAt,
    status: "healthy",
    primaryIssue: null,
    thresholds: {
      minimumScoredRuns: 6,
      minimumCandidateTypeScoredRuns: 1,
      minimumPublishableRate: 0.8,
      minimumAverageScore: 70,
      regressionDropThreshold: 8,
      providerConcentrationMax: 0.9,
    },
    baseline: {
      ready: true,
      scoredRuns: 9,
      candidateTypesCovered: 3,
      providerCount: 2,
    },
    sample: {
      totalRuns: 9,
      scoredRuns: 9,
      publishableRuns: 9,
      averageScore: 86,
      publishableRate: 1,
      leakRuns: 0,
      duplicateRationaleRuns: 0,
      warningCounts: {},
    },
    byCandidateType: {
      market_overview: emptyBucket(3),
      hotspot: emptyBucket(3),
      symbol: emptyBucket(3),
    },
    byProvider: {},
    trend: {
      recentWindowSize: 5,
      previousWindowSize: 4,
      recentAverageScore: 86,
      previousAverageScore: 82,
      delta: 4,
      status: "stable",
      recentRunIds: [],
      previousRunIds: [],
    },
    issues: [],
    actions: [],
    ...overrides,
  };
}

function emptyBucket(scoredRuns: number) {
  return {
    totalRuns: scoredRuns,
    scoredRuns,
    publishableRuns: scoredRuns,
    averageScore: 86,
    publishableRate: 1,
    leakRuns: 0,
    duplicateRationaleRuns: 0,
    warningCounts: {},
  };
}

function modelQuality(
  overrides: Partial<DecisionOpsModelQualityReport> = {},
): DecisionOpsModelQualityReport {
  return {
    schemaVersion: 1,
    generatedAt,
    status: "healthy",
    riskLevel: "low",
    primaryRisk: null,
    dimensions: {
      publicGuardrail: {
        status: "healthy",
        headline: "clean",
        evidence: { leakRuns: 0 },
      },
      evidenceDepth: {
        status: "healthy",
        headline: "deep",
        evidence: { lowEvidenceRuns: 0 },
      },
      roleCoverage: {
        status: "healthy",
        headline: "covered",
        evidence: { lowRoleCoverageRuns: 0 },
      },
      providerMix: {
        status: "healthy",
        headline: "mixed",
        evidence: { totalCalls: 20 },
      },
      regression: {
        status: "healthy",
        headline: "stable",
        evidence: { delta: 4 },
      },
    },
    issueCounts: {},
    recommendations: [],
    ...overrides,
  };
}

describe("buildDecisionOpsModelQualityEvidence", () => {
  it("marks model quality ready when baseline and dimensions are clean", () => {
    const report = buildDecisionOpsModelQualityEvidence({
      qualityBaseline: baseline(),
      modelQuality: modelQuality(),
    });

    expect(report).toMatchObject({
      schemaVersion: 1,
      status: "ready",
      evidenceReady: true,
      canIncreaseModelCost: false,
      canReduceModelFanout: false,
      blockingReasons: [],
    } satisfies Partial<DecisionOpsModelQualityEvidenceReport>);
  });

  it("blocks when public guardrails detect leaks", () => {
    const report = buildDecisionOpsModelQualityEvidence({
      qualityBaseline: baseline({
        status: "critical",
        primaryIssue: "public_content_leak",
        sample: {
          ...baseline().sample,
          leakRuns: 1,
        },
        issues: [
          {
            type: "public_content_leak",
            severity: "critical",
            targetId: "public-baseline",
            observedValue: 1,
            threshold: 0,
            message: "leak",
            action: "hold",
          },
        ],
      }),
      modelQuality: modelQuality({
        status: "critical",
        riskLevel: "high",
        primaryRisk: "public_content_leak",
      }),
    });

    expect(report).toMatchObject({
      status: "hold",
      evidenceReady: false,
      blockingReasons: [
        "model_quality_not_ready",
        "quality_baseline_not_ready",
        "public_content_leak",
      ],
    });
  });

  it("waits when candidate-type samples are incomplete", () => {
    const report = buildDecisionOpsModelQualityEvidence({
      qualityBaseline: baseline({
        status: "degraded",
        baseline: {
          ready: false,
          scoredRuns: 5,
          candidateTypesCovered: 2,
          providerCount: 1,
        },
        primaryIssue: "candidate_type_sample_gap",
      }),
      modelQuality: modelQuality(),
    });

    expect(report).toMatchObject({
      status: "collecting_evidence",
      evidenceReady: false,
      blockingReasons: ["quality_baseline_not_ready", "candidate_type_sample_gap"],
    });
  });
});
