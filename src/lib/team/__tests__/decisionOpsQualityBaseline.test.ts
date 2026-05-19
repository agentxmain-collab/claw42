import { describe, expect, it } from "vitest";
import { buildDecisionOpsQualityBaseline } from "@/lib/team/decisionOpsQualityBaseline";
import type { DecisionRunRecord } from "@/lib/team/decisionRunLedger";
import type { DecisionQualityReport } from "@/lib/team/decisionQuality";
import type { ProviderTelemetrySummary } from "@/lib/team/providerTelemetry";
import type { StrategyDecisionRecord } from "@/lib/team/strategyDecisionRecord";
import type { CandidateType } from "@/lib/watch/decisionCandidate";

const now = Date.parse("2026-05-19T02:00:00.000Z");

function quality(overrides: Partial<DecisionQualityReport> = {}): DecisionQualityReport {
  return {
    schemaVersion: 1,
    score: 84,
    publishable: true,
    warningCount: 0,
    warnings: [],
    blockingWarnings: [],
    leakCount: 0,
    duplicateRationaleCount: 0,
    roleCoverage: { active: 12, contributorCount: 12, analystInputCount: 12 },
    directionDistribution: { long: 6, short: 3, neutral: 2, wait: 1 },
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
  id,
  score = 84,
  candidateType = "symbol",
  publishable = true,
  provider = "deepseek-chat",
  startedAt,
  qualityOverrides = {},
}: {
  id: string;
  score?: number;
  candidateType?: CandidateType;
  publishable?: boolean;
  provider?: string;
  startedAt: string;
  qualityOverrides?: Partial<DecisionQualityReport>;
}): { run: DecisionRunRecord; record: StrategyDecisionRecord } {
  const recordId = `pm:${id}`;
  return {
    run: {
      id,
      schemaVersion: 1,
      status: "succeeded",
      triggerSource: "cron",
      locale: "zh_CN",
      candidate: {
        candidateType,
        candidateKey: `${candidateType}:${id}`,
        displayTitle: `${id} analysis`,
        executable: candidateType === "symbol",
        symbol: candidateType === "symbol" ? id.toUpperCase() : undefined,
      },
      symbol: candidateType === "symbol" ? id.toUpperCase() : "MARKET",
      startedAt,
      completedAt: startedAt,
      stageStatus: {},
      analystRoundCount: 14,
      activeMemberIds: ["chart_analyst", "news_analyst", "pm"],
      abstainedMemberIds: [],
      decisionRecordId: recordId,
      publicTimelineEventId: `public:${recordId}`,
      quality: quality({ score, publishable, ...qualityOverrides }),
      error: null,
      skipReason: null,
    },
    record: {
      id: recordId,
      schemaVersion: 2,
      recordSource: "live",
      symbol: candidateType === "symbol" ? id.toUpperCase() : "MARKET",
      candidate: undefined,
      locale: "zh_CN",
      decisionOwnerId: "pm",
      contributorIds: [],
      analystInputs: [],
      sourceThreadId: null,
      tradeDecision: null,
      createdAt: startedAt,
      evaluationWindowEndsAt: null,
      resolvedAt: null,
      resolvedOutcome: null,
      promptVersion: "test",
      modelProvider: provider,
    },
  };
}

function telemetry(overrides: Partial<ProviderTelemetrySummary> = {}): ProviderTelemetrySummary {
  return {
    totalCalls: 20,
    providerCounts: { "deepseek-chat": 10, minimax: 10 },
    fallbackCalls: 0,
    failureCalls: 0,
    singleProviderConcentration: {
      provider: "deepseek-chat",
      count: 10,
      ratio: 0.5,
      threshold: 0.9,
      alert: false,
    },
    ...overrides,
  };
}

function fixtures() {
  return [
    run({
      id: "run-1",
      candidateType: "symbol",
      provider: "deepseek-chat",
      startedAt: "2026-05-19T01:00:00.000Z",
    }),
    run({
      id: "run-2",
      candidateType: "market_overview",
      provider: "minimax",
      startedAt: "2026-05-19T00:00:00.000Z",
    }),
    run({
      id: "run-3",
      candidateType: "hotspot",
      provider: "deepseek-chat",
      startedAt: "2026-05-18T23:00:00.000Z",
    }),
    run({
      id: "run-4",
      candidateType: "symbol",
      provider: "minimax",
      startedAt: "2026-05-18T22:00:00.000Z",
    }),
    run({
      id: "run-5",
      candidateType: "symbol",
      provider: "deepseek-chat",
      startedAt: "2026-05-18T21:00:00.000Z",
    }),
    run({
      id: "run-6",
      candidateType: "market_overview",
      provider: "minimax",
      startedAt: "2026-05-18T20:00:00.000Z",
    }),
  ];
}

describe("buildDecisionOpsQualityBaseline", () => {
  it("marks the baseline ready when clean scored runs cover all candidate types", () => {
    const rows = fixtures();
    const report = buildDecisionOpsQualityBaseline({
      runs: rows.map((item) => item.run),
      records: rows.map((item) => item.record),
      providerTelemetry: telemetry(),
      now,
    });

    expect(report).toMatchObject({
      schemaVersion: 1,
      status: "healthy",
      primaryIssue: null,
      baseline: {
        ready: true,
        scoredRuns: 6,
        candidateTypesCovered: 3,
        providerCount: 2,
      },
      sample: {
        scoredRuns: 6,
        publishableRuns: 6,
        publishableRate: 1,
        averageScore: 84,
      },
      byCandidateType: {
        symbol: expect.objectContaining({ scoredRuns: 3 }),
        market_overview: expect.objectContaining({ scoredRuns: 2 }),
        hotspot: expect.objectContaining({ scoredRuns: 1 }),
      },
      byProvider: {
        "deepseek-chat": expect.objectContaining({ scoredRuns: 3 }),
        minimax: expect.objectContaining({ scoredRuns: 3 }),
      },
      actions: [],
    });
  });

  it("keeps baseline in observe mode when samples are too thin", () => {
    const rows = fixtures().slice(0, 2);
    const report = buildDecisionOpsQualityBaseline({
      runs: rows.map((item) => item.run),
      records: rows.map((item) => item.record),
      providerTelemetry: telemetry(),
      now,
    });

    expect(report.status).toBe("degraded");
    expect(report.baseline.ready).toBe(false);
    expect(report.primaryIssue).toBe("candidate_type_sample_gap");
    expect(report.issues.map((issue) => issue.type)).toEqual(
      expect.arrayContaining(["candidate_type_sample_gap", "insufficient_scored_runs"]),
    );
    expect(report.actions).toEqual([
      expect.objectContaining({
        title: "Collect more clean scored samples",
        executable: false,
      }),
    ]);
  });

  it("makes public content leak the critical top issue", () => {
    const rows = fixtures();
    rows[0].run.quality = quality({
      score: 45,
      publishable: false,
      leakCount: 1,
      warnings: ["public_content_leak"],
      blockingWarnings: ["public_content_leak"],
    });

    const report = buildDecisionOpsQualityBaseline({
      runs: rows.map((item) => item.run),
      records: rows.map((item) => item.record),
      providerTelemetry: telemetry(),
      now,
    });

    expect(report.status).toBe("critical");
    expect(report.primaryIssue).toBe("public_content_leak");
    expect(report.issues[0]).toMatchObject({
      type: "public_content_leak",
      severity: "critical",
      targetId: "public-baseline",
    });
  });

  it("flags recent score regression against the reference window", () => {
    const rows = [
      ...[68, 67, 69, 68, 70].map((score, index) =>
        run({
          id: `recent-${index}`,
          score,
          candidateType: index === 0 ? "hotspot" : "symbol",
          startedAt: `2026-05-19T0${index}:00:00.000Z`,
        }),
      ),
      ...[85, 86, 84, 85, 86].map((score, index) =>
        run({
          id: `previous-${index}`,
          score,
          candidateType: index === 0 ? "market_overview" : "symbol",
          provider: "minimax",
          startedAt: `2026-05-18T1${index}:00:00.000Z`,
        }),
      ),
    ];

    const report = buildDecisionOpsQualityBaseline({
      runs: rows.map((item) => item.run),
      records: rows.map((item) => item.record),
      providerTelemetry: telemetry(),
      now,
    });

    expect(report.status).toBe("degraded");
    expect(report.primaryIssue).toBe("recent_score_regression");
    expect(report.trend).toMatchObject({
      recentWindowSize: 5,
      previousWindowSize: 5,
      recentAverageScore: 68,
      previousAverageScore: 85,
      delta: -17,
      status: "regressed",
    });
  });

  it("keeps provider concentration visible without turning actions executable", () => {
    const rows = fixtures();
    const report = buildDecisionOpsQualityBaseline({
      runs: rows.map((item) => item.run),
      records: rows.map((item) => item.record),
      providerTelemetry: telemetry({
        providerCounts: { "deepseek-chat": 20 },
        singleProviderConcentration: {
          provider: "deepseek-chat",
          count: 20,
          ratio: 1,
          threshold: 0.9,
          alert: true,
        },
      }),
      now,
    });

    expect(report.status).toBe("degraded");
    expect(report.issues).toContainEqual(
      expect.objectContaining({
        type: "provider_concentration",
        observedValue: 1,
        threshold: 0.9,
      }),
    );
    expect(report.actions.every((action) => action.executable === false)).toBe(true);
  });
});
