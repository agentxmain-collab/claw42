import { describe, expect, it } from "vitest";
import { buildDecisionOpsCausalRunbook } from "@/lib/team/decisionOpsCausalRunbook";
import type { DecisionOpsChainRunbook } from "@/lib/team/decisionOpsChainRunbook";
import type { DecisionOpsPublicOutputStabilityReport } from "@/lib/team/decisionOpsPublicOutputStability";
import type { DecisionOpsQualityBaselineReport } from "@/lib/team/decisionOpsQualityBaseline";
import type { DecisionOpsQueueRecoveryPolicy } from "@/lib/team/decisionOpsQueueRecoveryPolicy";
import type { DecisionOpsStabilityReport } from "@/lib/team/decisionOpsStability";

const now = Date.parse("2026-05-19T08:00:00.000Z");

function runbook(overrides: Partial<DecisionOpsChainRunbook> = {}): DecisionOpsChainRunbook {
  return {
    schemaVersion: 1,
    generatedAt: "2026-05-19T08:00:00.000Z",
    status: "healthy",
    rootCause: "public_output_recent",
    publicBoardState: "has_recent_public_output",
    summary: "Cron, PM run, and public timeline output are fresh.",
    evidence: {
      latestCronJobAt: "2026-05-19T06:00:00.000Z",
      latestSuccessfulRunAt: "2026-05-19T06:05:00.000Z",
      latestPublicPmEventAt: "2026-05-19T06:05:00.000Z",
      cronIssueCodes: [],
      freshnessAlerts: [],
      healthAlerts: [],
    },
    chain: [],
    runbookActions: [],
    ...overrides,
  };
}

function recovery(
  overrides: Partial<DecisionOpsQueueRecoveryPolicy> = {},
): DecisionOpsQueueRecoveryPolicy {
  return {
    schemaVersion: 1,
    generatedAt: "2026-05-19T08:00:00.000Z",
    status: "healthy",
    mode: "observe",
    shouldPauseNewTriggers: false,
    autoRecoveryAllowed: false,
    primaryAction: null,
    evidence: {
      rootCause: "public_output_recent",
      publicBoardState: "has_recent_public_output",
      queueMode: "inline",
      cronIssueCodes: [],
      healthAlerts: [],
      exhaustedCronJobs: 0,
      staleRunningCronJobs: 0,
      overdueCronRetries: 0,
      zeroOutputCronJobs: 0,
    },
    recoverySteps: [],
    ...overrides,
  };
}

function stability(
  overrides: Partial<DecisionOpsStabilityReport> = {},
): DecisionOpsStabilityReport {
  return {
    schemaVersion: 1,
    generatedAt: "2026-05-19T08:00:00.000Z",
    status: "healthy",
    primaryIssue: null,
    thresholds: {
      expectedCronIntervalMs: 10_800_000,
      minCronCoverageRate: 0.75,
      minRunSuccessRate: 0.8,
      minPublicOutputRate: 0.8,
      staleRunningJobAfterMs: 1_800_000,
    },
    windows: [],
    issues: [],
    actions: [],
    ...overrides,
  };
}

function outputStability(
  overrides: Partial<DecisionOpsPublicOutputStabilityReport> = {},
): DecisionOpsPublicOutputStabilityReport {
  return {
    schemaVersion: 1,
    generatedAt: "2026-05-19T08:00:00.000Z",
    status: "healthy",
    primaryIssue: null,
    thresholds: {
      minimumVisibleCards: 2,
      maximumDuplicateCandidateCards: 0,
      maximumStageProgressGaps: 0,
    },
    counts: {
      publicPmEvents: 3,
      uniqueCandidateCards: 3,
      duplicateCandidateCards: 0,
      unstableOrderEvents: 0,
      stageProgressGaps: 0,
      missingStageTraceEvents: 0,
    },
    byCandidateType: { symbol: 1, market_overview: 1, hotspot: 1 },
    byPublicStatus: { done: 2, active: 1, pending: 0 },
    order: {
      stable: true,
      eventIds: ["pm:BTC", "pm:market", "pm:hotspot"],
      expectedEventIds: ["pm:BTC", "pm:market", "pm:hotspot"],
    },
    duplicateCandidateKeys: [],
    issues: [],
    actions: [],
    ...overrides,
  };
}

function qualityBaseline(
  overrides: Partial<DecisionOpsQualityBaselineReport> = {},
): DecisionOpsQualityBaselineReport {
  return {
    schemaVersion: 1,
    generatedAt: "2026-05-19T08:00:00.000Z",
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
      averageScore: 82,
      publishableRate: 1,
      leakRuns: 0,
      duplicateRationaleRuns: 0,
      warningCounts: {},
    },
    byCandidateType: {
      symbol: {
        totalRuns: 3,
        scoredRuns: 3,
        publishableRuns: 3,
        averageScore: 82,
        publishableRate: 1,
        leakRuns: 0,
        duplicateRationaleRuns: 0,
        warningCounts: {},
      },
      market_overview: {
        totalRuns: 3,
        scoredRuns: 3,
        publishableRuns: 3,
        averageScore: 84,
        publishableRate: 1,
        leakRuns: 0,
        duplicateRationaleRuns: 0,
        warningCounts: {},
      },
      hotspot: {
        totalRuns: 3,
        scoredRuns: 3,
        publishableRuns: 3,
        averageScore: 80,
        publishableRate: 1,
        leakRuns: 0,
        duplicateRationaleRuns: 0,
        warningCounts: {},
      },
    },
    byProvider: {},
    trend: {
      recentWindowSize: 5,
      previousWindowSize: 4,
      recentAverageScore: 82,
      previousAverageScore: 81,
      delta: 1,
      status: "stable",
      recentRunIds: [],
      previousRunIds: [],
    },
    issues: [],
    actions: [],
    ...overrides,
  };
}

describe("buildDecisionOpsCausalRunbook", () => {
  it("stays healthy when chain, queue stability, public output, and quality baseline are clean", () => {
    const report = buildDecisionOpsCausalRunbook({
      runbook: runbook(),
      recoveryPolicy: recovery(),
      stability: stability(),
      outputStability: outputStability(),
      qualityBaseline: qualityBaseline(),
      now,
    });

    expect(report).toMatchObject({
      schemaVersion: 1,
      status: "healthy",
      primaryLayer: null,
      primaryIssue: null,
      alert: {
        shouldNotify: false,
        dedupeKey: null,
      },
      diagnosis: expect.arrayContaining([
        expect.objectContaining({ layer: "schedule_to_public_chain", status: "healthy" }),
        expect.objectContaining({ layer: "queue_and_cron_stability", status: "healthy" }),
        expect.objectContaining({ layer: "public_output_surface", status: "healthy" }),
        expect.objectContaining({ layer: "model_quality_baseline", status: "healthy" }),
        expect.objectContaining({ layer: "recovery_policy", status: "healthy" }),
      ]),
      actions: [],
    });
  });

  it("keeps cron delivery as the primary cause when an empty board is downstream of the chain", () => {
    const report = buildDecisionOpsCausalRunbook({
      runbook: runbook({
        status: "critical",
        rootCause: "cron_delivery_stalled",
        publicBoardState: "no_public_output",
        summary:
          "The public board is empty because scheduled cron delivery has not reached the PM job ledger.",
        runbookActions: [
          {
            title: "Verify Vercel cron delivery",
            description: "Check Vercel cron delivery and route authorization.",
            executable: false,
          },
        ],
      }),
      recoveryPolicy: recovery(),
      stability: stability(),
      outputStability: outputStability({
        status: "critical",
        primaryIssue: "empty_public_output",
        counts: {
          ...outputStability().counts,
          publicPmEvents: 0,
          uniqueCandidateCards: 0,
        },
      }),
      qualityBaseline: qualityBaseline(),
      now,
    });

    expect(report.status).toBe("critical");
    expect(report.primaryLayer).toBe("schedule_to_public_chain");
    expect(report.primaryIssue).toBe("cron_delivery_stalled");
    expect(report.alert).toMatchObject({
      severity: "critical",
      shouldNotify: true,
      dedupeKey: "ops-causal:schedule_to_public_chain:cron_delivery_stalled",
    });
    expect(report.actions[0]).toMatchObject({
      title: "Verify Vercel cron delivery",
      executable: false,
    });
  });

  it("routes duplicate or unstable cards to the public output surface when the chain is fresh", () => {
    const report = buildDecisionOpsCausalRunbook({
      runbook: runbook(),
      recoveryPolicy: recovery(),
      stability: stability(),
      outputStability: outputStability({
        status: "critical",
        primaryIssue: "duplicate_candidate_card",
        counts: {
          ...outputStability().counts,
          duplicateCandidateCards: 1,
        },
        duplicateCandidateKeys: ["zh_CN:market_overview:2026-05-19"],
        actions: [
          {
            title: "Inspect candidate dedupe",
            description: "Check hydration and projection dedupe before replay.",
            executable: false,
          },
        ],
      }),
      qualityBaseline: qualityBaseline(),
      now,
    });

    expect(report.status).toBe("critical");
    expect(report.primaryLayer).toBe("public_output_surface");
    expect(report.primaryIssue).toBe("duplicate_candidate_card");
    expect(report.alert.dedupeKey).toBe(
      "ops-causal:public_output_surface:duplicate_candidate_card",
    );
    expect(report.diagnosis.find((step) => step.layer === "public_output_surface")).toMatchObject({
      status: "critical",
      issue: "duplicate_candidate_card",
      evidence: {
        publicPmEvents: 3,
        duplicateCandidateCards: 1,
        stageProgressGaps: 0,
      },
    });
  });

  it("prioritizes queue and cron stability before model baseline drift", () => {
    const report = buildDecisionOpsCausalRunbook({
      runbook: runbook(),
      recoveryPolicy: recovery(),
      stability: stability({
        status: "critical",
        primaryIssue: "stale_running_job",
        issues: [
          {
            type: "stale_running_job",
            severity: "critical",
            windowHours: null,
            targetId: "job:stale",
            observedValue: 3_600_000,
            threshold: 1_800_000,
            message: "PM job stayed running beyond the stability threshold.",
            action: "Inspect queue consumer and provider logs before increasing trigger pressure.",
          },
        ],
        actions: [
          {
            title: "Inspect stale running PM jobs",
            description: "Check queue consumer and provider logs first.",
            executable: false,
          },
        ],
      }),
      outputStability: outputStability(),
      qualityBaseline: qualityBaseline({
        status: "degraded",
        primaryIssue: "candidate_type_sample_gap",
      }),
      now,
    });

    expect(report.status).toBe("critical");
    expect(report.primaryLayer).toBe("queue_and_cron_stability");
    expect(report.primaryIssue).toBe("stale_running_job");
    expect(report.actions[0]).toMatchObject({
      title: "Inspect stale running PM jobs",
      executable: false,
    });
  });
});
