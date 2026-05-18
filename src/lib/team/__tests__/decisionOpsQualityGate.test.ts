import { describe, expect, it } from "vitest";
import { buildDecisionOpsQualityGate } from "@/lib/team/decisionOpsQualityGate";
import type { DecisionRunRecord } from "@/lib/team/decisionRunLedger";
import type { DecisionQualityReport } from "@/lib/team/decisionQuality";
import type { StrategyDecisionRecord } from "@/lib/team/strategyDecisionRecord";
import type { CandidateType } from "@/lib/watch/decisionCandidate";

const now = Date.parse("2026-05-18T12:00:00.000Z");

function quality(overrides: Partial<DecisionQualityReport> = {}): DecisionQualityReport {
  return {
    schemaVersion: 1,
    score: 86,
    publishable: true,
    warningCount: 0,
    warnings: [],
    blockingWarnings: [],
    leakCount: 0,
    duplicateRationaleCount: 0,
    roleCoverage: { active: 12, contributorCount: 12, analystInputCount: 12 },
    directionDistribution: { long: 7, short: 2, neutral: 2, wait: 1 },
    evidence: { citedEvidenceCount: 7, analystCitationCount: 11 },
    trade: {
      hasTradeCard: true,
      direction: "long",
      confidence: 0.74,
      actionable: true,
    },
    ...overrides,
  };
}

function run({
  candidateType = "symbol",
  quality: qualityOverride,
  ...overrides
}: Partial<DecisionRunRecord> & {
  candidateType?: CandidateType;
  quality?: DecisionQualityReport;
} = {}): DecisionRunRecord {
  const symbol =
    candidateType === "symbol" ? (overrides.symbol ?? "BTC") : candidateType.toUpperCase();
  return {
    id: `run:${candidateType}:${symbol}:1779102000000`,
    schemaVersion: 1,
    status: "succeeded",
    triggerSource: "cron",
    locale: "zh_CN",
    candidate: {
      candidateType,
      candidateKey: symbol,
      displayTitle: `${symbol} 实时行情分析`,
      executable: candidateType === "symbol",
      symbol: candidateType === "symbol" ? symbol : undefined,
    },
    symbol,
    startedAt: "2026-05-18T11:00:00.000Z",
    completedAt: "2026-05-18T11:03:00.000Z",
    stageStatus: {},
    analystRoundCount: 22,
    activeMemberIds: ["chart_analyst"],
    abstainedMemberIds: [],
    decisionRecordId: `pm:${candidateType}:${symbol}:1779102000000`,
    publicTimelineEventId: `pm-decision:pm:${candidateType}:${symbol}:1779102000000`,
    quality: qualityOverride ?? quality(),
    error: null,
    skipReason: null,
    ...overrides,
  };
}

function record(overrides: Partial<StrategyDecisionRecord> = {}): StrategyDecisionRecord {
  return {
    id: "pm:symbol:BTC:1779102000000",
    schemaVersion: 2,
    recordSource: "live",
    symbol: "BTC",
    locale: "zh_CN",
    decisionOwnerId: "pm",
    contributorIds: ["chart_analyst"],
    analystInputs: [],
    sourceThreadId: null,
    tradeDecision: null,
    createdAt: "2026-05-18T11:03:00.000Z",
    evaluationWindowEndsAt: null,
    resolvedAt: null,
    resolvedOutcome: null,
    promptVersion: "test",
    modelProvider: "deepseek-chat",
    stageTrace: [],
    ...overrides,
  };
}

describe("buildDecisionOpsQualityGate", () => {
  it("flags public quality risk and splits buckets by candidate type and provider", () => {
    const report = buildDecisionOpsQualityGate({
      runs: [
        run(),
        run({
          id: "run:market",
          candidateType: "market_overview",
          decisionRecordId: "pm:market:1779102000000",
          quality: quality({
            score: 42,
            publishable: false,
            warningCount: 4,
            warnings: [
              "public_content_leak",
              "duplicate_public_rationale",
              "thin_evidence",
              "low_role_coverage",
            ],
            blockingWarnings: ["public_content_leak", "low_quality_score"],
            leakCount: 1,
            duplicateRationaleCount: 2,
            roleCoverage: { active: 4, contributorCount: 4, analystInputCount: 4 },
            evidence: { citedEvidenceCount: 1, analystCitationCount: 1 },
          }),
        }),
        run({
          id: "run:hotspot",
          candidateType: "hotspot",
          decisionRecordId: "pm:hotspot:1779102000000",
          quality: quality({
            score: 48,
            publishable: false,
            warningCount: 2,
            warnings: ["thin_evidence", "low_role_coverage"],
            blockingWarnings: ["low_quality_score"],
            roleCoverage: { active: 5, contributorCount: 5, analystInputCount: 5 },
            evidence: { citedEvidenceCount: 1, analystCitationCount: 1 },
          }),
        }),
      ],
      records: [
        record({ id: "pm:symbol:BTC:1779102000000", modelProvider: "deepseek-chat" }),
        record({ id: "pm:market:1779102000000", modelProvider: "minimax" }),
        record({ id: "pm:hotspot:1779102000000", modelProvider: "deepseek-chat" }),
      ],
      providerTelemetry: {
        totalCalls: 10,
        providerCounts: { "deepseek-chat": 10 },
        fallbackCalls: 4,
        failureCalls: 1,
        singleProviderConcentration: {
          provider: "deepseek-chat",
          count: 10,
          ratio: 1,
          threshold: 0.9,
          alert: true,
        },
      },
      now,
    });

    expect(report.status).toBe("critical");
    expect(report.publicRisk).toMatchObject({
      scoredRuns: 3,
      publishableRuns: 1,
      leakRuns: 1,
      duplicateRationaleRuns: 1,
      lowEvidenceRuns: 2,
      lowRoleCoverageRuns: 2,
    });
    expect(report.byCandidateType.market_overview).toMatchObject({
      totalRuns: 1,
      scoredRuns: 1,
      publishableRuns: 0,
      averageScore: 42,
      publishableRate: 0,
      leakRuns: 1,
      duplicateRationaleRuns: 1,
    });
    expect(report.byProvider["deepseek-chat"]).toMatchObject({
      totalRuns: 2,
      scoredRuns: 2,
      publishableRuns: 1,
      averageScore: 67,
    });
    expect(report.providerTelemetry).toMatchObject({
      totalCalls: 10,
      fallbackRate: 0.4,
      failureRate: 0.1,
      concentration: {
        provider: "deepseek-chat",
        alert: true,
      },
    });
    expect(report.issues.map((issue) => issue.type)).toEqual(
      expect.arrayContaining([
        "public_content_leak",
        "duplicate_rationale",
        "low_evidence",
        "low_role_coverage",
        "provider_concentration",
        "provider_fallback_rate_high",
        "provider_failure_rate_high",
        "candidate_type_low_publishable_rate",
      ]),
    );
  });

  it("stays healthy for publishable, provider-diverse output", () => {
    const report = buildDecisionOpsQualityGate({
      runs: [run(), run({ id: "run:eth", symbol: "ETH", decisionRecordId: "pm:symbol:ETH:1" })],
      records: [
        record({ id: "pm:symbol:BTC:1779102000000", modelProvider: "deepseek-chat" }),
        record({ id: "pm:symbol:ETH:1", modelProvider: "minimax" }),
      ],
      providerTelemetry: {
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
      },
      now,
    });

    expect(report).toMatchObject({
      schemaVersion: 1,
      status: "healthy",
      issues: [],
      publicRisk: {
        scoredRuns: 2,
        publishableRuns: 2,
        leakRuns: 0,
      },
    });
  });
});
