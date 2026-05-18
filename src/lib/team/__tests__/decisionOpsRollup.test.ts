import { describe, expect, it } from "vitest";
import { buildDecisionOpsRollup } from "@/lib/team/decisionOpsRollup";
import type { DecisionOpsDeepDiagnostics } from "@/lib/team/decisionOpsDeepDiagnostics";
import type { DecisionOpsFreshnessReport } from "@/lib/team/decisionOpsFreshness";
import type { DecisionOpsHealthSummary } from "@/lib/team/decisionOpsHealth";
import type { DecisionOpsReconciliationReport } from "@/lib/team/decisionOpsReconciliation";

const now = "2026-05-18T12:00:00.000Z";

function health(overrides: Partial<DecisionOpsHealthSummary> = {}): DecisionOpsHealthSummary {
  return {
    schemaVersion: 1,
    generatedAt: now,
    status: "healthy",
    queue: {
      total: 0,
      queued: 0,
      running: 0,
      succeeded: 0,
      failed: 0,
      retryBacklog: 0,
      overdueRetry: 0,
      exhaustedFailed: 0,
      staleRunning: 0,
      zeroOutputSuccess: 0,
      oldestQueuedAgeMs: null,
      oldestRunningAgeMs: null,
    },
    runs: {
      total: 0,
      running: 0,
      succeeded: 0,
      skipped: 0,
      failed: 0,
      qualityBlocked: 0,
      staleRunning: 0,
      oldestRunningAgeMs: null,
      p95DurationMs: null,
      latestStartedAt: null,
    },
    quality: {
      blockedPublications: 0,
      scoredRuns: 0,
      publishableRuns: 0,
      averageScore: null,
      warningCounts: {},
    },
    alerts: [],
    alertDetails: [],
    ...overrides,
  };
}

function reconciliation(
  overrides: Partial<DecisionOpsReconciliationReport> = {},
): DecisionOpsReconciliationReport {
  return {
    schemaVersion: 1,
    generatedAt: now,
    status: "healthy",
    counts: {
      jobs: 0,
      runs: 0,
      publicPmEvents: 0,
      succeededJobs: 0,
      succeededRuns: 0,
      issues: 0,
      repairProposals: 0,
    },
    issues: [],
    repairProposals: [],
    canary: {
      status: "ready",
      checks: [],
    },
    history: {
      windows: [],
    },
    ...overrides,
  };
}

function freshness(
  overrides: Partial<DecisionOpsFreshnessReport> = {},
): DecisionOpsFreshnessReport {
  return {
    schemaVersion: 1,
    generatedAt: now,
    status: "healthy",
    signals: {
      latestCronJobAt: now,
      latestCronJobAgeMs: 0,
      latestSucceededRunAt: now,
      latestSucceededRunAgeMs: 0,
      latestPublicPmEventAt: now,
      latestPublicPmEventAgeMs: 0,
    },
    thresholds: {
      degradedAfterMs: 4 * 60 * 60_000,
      criticalAfterMs: 8 * 60 * 60_000,
    },
    alerts: [],
    alertDetails: [],
    ...overrides,
  };
}

function deep(overrides: Partial<DecisionOpsDeepDiagnostics> = {}): DecisionOpsDeepDiagnostics {
  return {
    schemaVersion: 1,
    generatedAt: now,
    quality: {
      scoredRuns: 0,
      publishableRuns: 0,
      blockedRuns: 0,
      averageScore: null,
      warningCounts: {},
      blockingWarningCounts: {},
      lowEvidenceRuns: 0,
      lowRoleCoverageRuns: 0,
      leakRuns: 0,
      duplicateRationaleRuns: 0,
    },
    provider: {
      recordModelProviderCounts: {},
      stageModelProviderCounts: {},
      telemetry: null,
    },
    replayDryRun: {
      proposals: [],
    },
    regression: {
      recentWindowSize: 0,
      previousWindowSize: 0,
      recentAverageScore: null,
      previousAverageScore: null,
      delta: null,
      status: "insufficient_data",
      recentRunIds: [],
      previousRunIds: [],
    },
    ...overrides,
  };
}

describe("buildDecisionOpsRollup", () => {
  it("summarizes overall status, top three blocking issues, and non-executable runbook actions", () => {
    const rollup = buildDecisionOpsRollup({
      health: health({
        status: "critical",
        alertDetails: [
          {
            alert: "run_stale_running",
            severity: "critical",
            count: 2,
            action: "Inspect provider and queue logs.",
          },
          {
            alert: "quality_blocking",
            severity: "degraded",
            count: 5,
            action: "Inspect quality gate warnings.",
          },
        ],
      }),
      reconciliation: reconciliation({
        status: "degraded",
        issues: [
          {
            type: "run_succeeded_without_public_event",
            severity: "degraded",
            runId: "run:btc",
            recordId: "pm:btc",
            candidateKey: "BTC",
            symbol: "BTC",
            message: "Succeeded decision run has no matching public PM timeline event.",
            repairProposal: {
              action: "inspect_timeline_projection",
              executable: false,
              reason: "Inspect projection before replay.",
            },
          },
        ],
      }),
      freshness: freshness({
        status: "critical",
        alertDetails: [
          {
            alert: "public_pm_event_stale",
            severity: "critical",
            ageMs: 9 * 60 * 60_000,
            thresholdMs: 8 * 60 * 60_000,
            action: "Inspect public projection/backfill before changing PM execution.",
          },
        ],
      }),
      deepDiagnostics: deep({
        quality: {
          ...deep().quality,
          blockedRuns: 5,
          lowEvidenceRuns: 3,
        },
        provider: {
          recordModelProviderCounts: {},
          stageModelProviderCounts: {},
          telemetry: {
            totalCalls: 25,
            providerCounts: { "deepseek-chat": 25 },
            fallbackCalls: 6,
            failureCalls: 0,
            singleProviderConcentration: {
              provider: "deepseek-chat",
              count: 25,
              ratio: 1,
              threshold: 0.9,
              alert: true,
            },
          },
        },
        replayDryRun: {
          proposals: [
            {
              type: "quality_blocked_run",
              runId: "run:block",
              reason: "Public quality gate blocked the run.",
              executable: false,
            },
          ],
        },
      }),
    });

    expect(rollup).toMatchObject({
      schemaVersion: 1,
      status: "critical",
      counts: {
        criticalIssues: 2,
        degradedIssues: 5,
        runbookActions: 3,
      },
    });
    expect(rollup.topIssues).toHaveLength(3);
    expect(rollup.topIssues.map((issue) => issue.source)).toEqual([
      "freshness",
      "health",
      "health",
    ]);
    expect(rollup.runbookActions).toEqual([
      expect.objectContaining({
        source: "freshness",
        executable: false,
      }),
      expect.objectContaining({
        source: "health",
        executable: false,
      }),
      expect.objectContaining({
        source: "reconciliation",
        executable: false,
      }),
    ]);
  });

  it("stays healthy when all source diagnostics are healthy", () => {
    const rollup = buildDecisionOpsRollup({
      health: health(),
      reconciliation: reconciliation(),
      freshness: freshness(),
      deepDiagnostics: deep(),
    });

    expect(rollup).toMatchObject({
      status: "healthy",
      topIssues: [],
      runbookActions: [],
      counts: {
        criticalIssues: 0,
        degradedIssues: 0,
        runbookActions: 0,
      },
    });
  });
});
