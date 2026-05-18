import { describe, expect, it } from "vitest";
import { buildDecisionOpsDeepDiagnostics } from "@/lib/team/decisionOpsDeepDiagnostics";
import type { DecisionRunRecord } from "@/lib/team/decisionRunLedger";
import type { StrategyDecisionRecord } from "@/lib/team/strategyDecisionRecord";
import type { PmDecisionJobRecord } from "@/lib/watch/pmDecisionJobLedger";

const now = Date.parse("2026-05-18T12:00:00.000Z");

function job(overrides: Partial<PmDecisionJobRecord> = {}): PmDecisionJobRecord {
  return {
    id: "pm-job:once:user_visit_trigger:zh_CN:BTC:5934384",
    schemaVersion: 1,
    kind: "once",
    status: "succeeded",
    triggerSource: "user_visit_trigger",
    locale: "zh_CN",
    idempotencyKey: "once:user_visit_trigger:zh_CN:BTC:5934384",
    candidate: null,
    symbol: "BTC",
    createdAt: "2026-05-18T10:58:00.000Z",
    updatedAt: "2026-05-18T11:03:00.000Z",
    startedAt: "2026-05-18T11:00:00.000Z",
    completedAt: "2026-05-18T11:03:00.000Z",
    attemptCount: 1,
    maxAttempts: 3,
    nextRunAt: null,
    lastError: null,
    outputCount: 1,
    decisionRecordIds: ["pm:BTC:1779102000000"],
    auditEventCount: 6,
    ...overrides,
  };
}

function run(overrides: Partial<DecisionRunRecord> = {}): DecisionRunRecord {
  return {
    id: "run:pm:BTC:1779102000000",
    schemaVersion: 1,
    status: "succeeded",
    triggerSource: "user_visit_trigger",
    locale: "zh_CN",
    candidate: {
      candidateType: "symbol",
      candidateKey: "BTC",
      displayTitle: "BTC 实时行情分析",
      executable: true,
      symbol: "BTC",
    },
    symbol: "BTC",
    startedAt: "2026-05-18T11:00:00.000Z",
    completedAt: "2026-05-18T11:03:00.000Z",
    stageStatus: {},
    analystRoundCount: 22,
    activeMemberIds: ["chart_analyst"],
    abstainedMemberIds: [],
    decisionRecordId: "pm:BTC:1779102000000",
    publicTimelineEventId: "pm-decision:pm:BTC:1779102000000",
    quality: {
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
    },
    error: null,
    skipReason: null,
    ...overrides,
  };
}

function record(overrides: Partial<StrategyDecisionRecord> = {}): StrategyDecisionRecord {
  return {
    id: "pm:BTC:1779102000000",
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
    stageTrace: [
      {
        stageId: "analyst_inputs",
        label: "analyst inputs",
        status: "done",
        observedAt: "2026-05-18T11:01:00.000Z",
        modelProvider: "minimax",
      },
    ],
    ...overrides,
  };
}

describe("buildDecisionOpsDeepDiagnostics", () => {
  it("summarizes quality warnings and provider/model distribution", () => {
    const diagnostics = buildDecisionOpsDeepDiagnostics({
      jobs: [job()],
      runs: [
        run(),
        run({
          id: "run:block",
          status: "skipped",
          skipReason: "public_quality_gate_failed",
          quality: {
            ...run().quality!,
            score: 40,
            publishable: false,
            warningCount: 2,
            warnings: ["low_quality_score", "thin_evidence"],
            blockingWarnings: ["low_quality_score"],
            evidence: { citedEvidenceCount: 1, analystCitationCount: 1 },
          },
        }),
      ],
      records: [record(), record({ id: "pm:ETH:1", modelProvider: "deepseek-chat" })],
      providerTelemetry: {
        totalCalls: 3,
        providerCounts: { "deepseek-chat": 3 },
        fallbackCalls: 1,
        failureCalls: 0,
        singleProviderConcentration: {
          provider: "deepseek-chat",
          count: 3,
          ratio: 1,
          threshold: 0.9,
          alert: true,
        },
      },
      now,
    });

    expect(diagnostics.quality).toMatchObject({
      scoredRuns: 2,
      publishableRuns: 1,
      blockedRuns: 1,
      averageScore: 63,
      warningCounts: {
        low_quality_score: 1,
        thin_evidence: 1,
      },
      lowEvidenceRuns: 1,
    });
    expect(diagnostics.provider).toMatchObject({
      recordModelProviderCounts: { "deepseek-chat": 2 },
      stageModelProviderCounts: { minimax: 2 },
      telemetry: {
        totalCalls: 3,
        fallbackCalls: 1,
        singleProviderConcentration: {
          alert: true,
          provider: "deepseek-chat",
        },
      },
    });
  });

  it("returns non-executable replay dry-run proposals for blocked output paths", () => {
    const diagnostics = buildDecisionOpsDeepDiagnostics({
      jobs: [job({ id: "job:zero", outputCount: 0, decisionRecordIds: [] })],
      runs: [
        run({
          id: "run:block",
          status: "skipped",
          decisionRecordId: null,
          publicTimelineEventId: null,
          skipReason: "public_quality_gate_failed",
          quality: {
            ...run().quality!,
            score: 42,
            publishable: false,
            warningCount: 1,
            warnings: ["low_quality_score"],
            blockingWarnings: ["low_quality_score"],
          },
        }),
      ],
      records: [],
      now,
    });

    expect(diagnostics.replayDryRun.proposals).toEqual([
      expect.objectContaining({
        type: "job_zero_output",
        jobId: "job:zero",
        executable: false,
      }),
      expect.objectContaining({
        type: "quality_blocked_run",
        runId: "run:block",
        executable: false,
      }),
    ]);
  });

  it("builds a recent-vs-previous quality regression snapshot", () => {
    const diagnostics = buildDecisionOpsDeepDiagnostics({
      jobs: [],
      runs: [
        run({
          id: "run:recent-1",
          startedAt: "2026-05-18T11:00:00.000Z",
          quality: { ...run().quality!, score: 80 },
        }),
        run({
          id: "run:recent-2",
          startedAt: "2026-05-18T10:00:00.000Z",
          quality: { ...run().quality!, score: 70 },
        }),
        run({
          id: "run:recent-3",
          startedAt: "2026-05-18T09:00:00.000Z",
          quality: { ...run().quality!, score: 60 },
        }),
        run({
          id: "run:prev-1",
          startedAt: "2026-05-18T08:00:00.000Z",
          quality: { ...run().quality!, score: 90 },
        }),
        run({
          id: "run:prev-2",
          startedAt: "2026-05-18T07:00:00.000Z",
          quality: { ...run().quality!, score: 90 },
        }),
        run({
          id: "run:prev-3",
          startedAt: "2026-05-18T06:00:00.000Z",
          quality: { ...run().quality!, score: 90 },
        }),
      ],
      records: [],
      now,
    });

    expect(diagnostics.regression).toMatchObject({
      recentWindowSize: 3,
      recentAverageScore: 70,
      previousAverageScore: 90,
      delta: -20,
      status: "regressed",
    });
  });
});
