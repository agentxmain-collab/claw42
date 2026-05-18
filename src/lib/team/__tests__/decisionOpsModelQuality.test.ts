import { describe, expect, it } from "vitest";
import { buildDecisionOpsModelQuality } from "@/lib/team/decisionOpsModelQuality";
import type { DecisionOpsDeepDiagnostics } from "@/lib/team/decisionOpsDeepDiagnostics";
import type { DecisionOpsQualityGateReport } from "@/lib/team/decisionOpsQualityGate";
import type { ProviderTelemetrySummary } from "@/lib/team/providerTelemetry";

const now = Date.parse("2026-05-19T00:30:00.000Z");

function telemetry(overrides: Partial<ProviderTelemetrySummary> = {}): ProviderTelemetrySummary {
  return {
    totalCalls: 10,
    providerCounts: { "deepseek-chat": 5, minimax: 5 },
    fallbackCalls: 0,
    failureCalls: 0,
    singleProviderConcentration: {
      provider: "deepseek-chat",
      count: 5,
      ratio: 0.5,
      threshold: 0.9,
      alert: false,
    },
    ...overrides,
  };
}

function qualityGate(
  overrides: Partial<DecisionOpsQualityGateReport> = {},
): DecisionOpsQualityGateReport {
  return {
    schemaVersion: 1,
    generatedAt: "2026-05-19T00:30:00.000Z",
    status: "healthy",
    thresholds: {
      lowEvidenceCitationsBelow: 2,
      lowRoleCoverageBelow: 6,
      maxProviderFallbackRate: 0.25,
      maxProviderFailureRate: 0.05,
      minCandidateTypePublishableRate: 0.5,
    },
    publicRisk: {
      totalRuns: 4,
      scoredRuns: 4,
      publishableRuns: 4,
      blockedRuns: 0,
      averageScore: 84,
      publishableRate: 1,
      warningCounts: {},
      lowEvidenceRuns: 0,
      lowRoleCoverageRuns: 0,
      leakRuns: 0,
      duplicateRationaleRuns: 0,
    },
    byCandidateType: {
      symbol: emptyBucket(),
      market_overview: emptyBucket(),
      hotspot: emptyBucket(),
    },
    byProvider: {},
    providerTelemetry: {
      totalCalls: 10,
      fallbackRate: 0,
      failureRate: 0,
      concentration: telemetry().singleProviderConcentration,
    },
    issues: [],
    ...overrides,
  };
}

function deepDiagnostics(
  overrides: Partial<DecisionOpsDeepDiagnostics> = {},
): DecisionOpsDeepDiagnostics {
  return {
    schemaVersion: 1,
    generatedAt: "2026-05-19T00:30:00.000Z",
    quality: {
      scoredRuns: 4,
      publishableRuns: 4,
      blockedRuns: 0,
      averageScore: 84,
      warningCounts: {},
      blockingWarningCounts: {},
      lowEvidenceRuns: 0,
      lowRoleCoverageRuns: 0,
      leakRuns: 0,
      duplicateRationaleRuns: 0,
    },
    provider: {
      recordModelProviderCounts: { "deepseek-chat": 2, minimax: 2 },
      stageModelProviderCounts: { "deepseek-chat": 28, minimax: 28 },
      telemetry: telemetry(),
    },
    replayDryRun: {
      proposals: [],
    },
    regression: {
      recentWindowSize: 3,
      previousWindowSize: 3,
      recentAverageScore: 84,
      previousAverageScore: 83,
      delta: 1,
      status: "stable",
      recentRunIds: ["run:a", "run:b", "run:c"],
      previousRunIds: ["run:d", "run:e", "run:f"],
    },
    ...overrides,
  };
}

function emptyBucket(): DecisionOpsQualityGateReport["publicRisk"] {
  return {
    totalRuns: 0,
    scoredRuns: 0,
    publishableRuns: 0,
    blockedRuns: 0,
    averageScore: null,
    publishableRate: null,
    warningCounts: {},
    lowEvidenceRuns: 0,
    lowRoleCoverageRuns: 0,
    leakRuns: 0,
    duplicateRationaleRuns: 0,
  };
}

describe("buildDecisionOpsModelQuality", () => {
  it("stays healthy when public quality, provider mix, and regression are stable", () => {
    const report = buildDecisionOpsModelQuality({
      qualityGate: qualityGate(),
      deepDiagnostics: deepDiagnostics(),
      now,
    });

    expect(report).toMatchObject({
      schemaVersion: 1,
      status: "healthy",
      riskLevel: "low",
      primaryRisk: null,
      dimensions: {
        publicGuardrail: expect.objectContaining({ status: "healthy" }),
        providerMix: expect.objectContaining({ status: "healthy" }),
        regression: expect.objectContaining({ status: "healthy" }),
      },
      recommendations: [],
    });
  });

  it("makes public content leaks the top critical risk", () => {
    const report = buildDecisionOpsModelQuality({
      qualityGate: qualityGate({
        status: "critical",
        publicRisk: {
          ...qualityGate().publicRisk,
          leakRuns: 1,
          duplicateRationaleRuns: 1,
        },
        issues: [
          {
            type: "public_content_leak",
            severity: "critical",
            targetId: "public-risk",
            observedValue: 1,
            threshold: 0,
            message: "Public quality reports contain content leak findings.",
            action: "Inspect prompts and public guardrail output before increasing cadence.",
          },
        ],
      }),
      deepDiagnostics: deepDiagnostics({
        quality: {
          ...deepDiagnostics().quality,
          leakRuns: 1,
          duplicateRationaleRuns: 1,
        },
      }),
      now,
    });

    expect(report).toMatchObject({
      status: "critical",
      riskLevel: "high",
      primaryRisk: "public_content_leak",
      recommendations: [
        expect.objectContaining({
          title: "Stop public release expansion until leak output is inspected",
          executable: false,
        }),
      ],
    });
  });

  it("flags provider concentration and quality regression as model-quality risks", () => {
    const concentrated = telemetry({
      providerCounts: { "deepseek-chat": 10 },
      singleProviderConcentration: {
        provider: "deepseek-chat",
        count: 10,
        ratio: 1,
        threshold: 0.9,
        alert: true,
      },
    });
    const report = buildDecisionOpsModelQuality({
      qualityGate: qualityGate({
        status: "degraded",
        providerTelemetry: {
          totalCalls: 10,
          fallbackRate: 0.4,
          failureRate: 0,
          concentration: concentrated.singleProviderConcentration,
        },
        issues: [
          {
            type: "provider_concentration",
            severity: "degraded",
            targetId: "provider-telemetry",
            provider: "deepseek-chat",
            observedValue: 1,
            threshold: 0.9,
            message: "Provider mix is concentrated in one provider.",
            action: "Inspect provider routing before treating output diversity as stable.",
          },
        ],
      }),
      deepDiagnostics: deepDiagnostics({
        provider: {
          ...deepDiagnostics().provider,
          telemetry: concentrated,
        },
        regression: {
          ...deepDiagnostics().regression,
          recentAverageScore: 58,
          previousAverageScore: 76,
          delta: -18,
          status: "regressed",
        },
      }),
      now,
    });

    expect(report.status).toBe("degraded");
    expect(report.riskLevel).toBe("medium");
    expect(report.dimensions.providerMix).toMatchObject({
      status: "degraded",
      headline: "Provider mix is concentrated in deepseek-chat.",
    });
    expect(report.dimensions.regression).toMatchObject({
      status: "degraded",
      headline: "Recent quality score regressed by 18 points.",
    });
  });
});
