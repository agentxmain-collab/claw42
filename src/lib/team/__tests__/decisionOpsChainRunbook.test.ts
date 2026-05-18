import { describe, expect, it } from "vitest";
import { buildDecisionOpsChainRunbook } from "@/lib/team/decisionOpsChainRunbook";
import type { DecisionOpsCronAudit } from "@/lib/team/decisionOpsCronAudit";
import type { DecisionOpsFreshnessReport } from "@/lib/team/decisionOpsFreshness";
import type { DecisionOpsHealthSummary } from "@/lib/team/decisionOpsHealth";

const now = Date.parse("2026-05-18T12:00:00.000Z");

function cronAudit(overrides: Partial<DecisionOpsCronAudit> = {}): DecisionOpsCronAudit {
  return {
    schemaVersion: 1,
    generatedAt: "2026-05-18T12:00:00.000Z",
    status: "healthy",
    schedule: {
      path: "/api/cron/strategy-replay",
      expression: "0 */3 * * *",
      expectedIntervalMs: 3 * 60 * 60_000,
      degradedAfterMs: 4 * 60 * 60_000,
      criticalAfterMs: 8 * 60 * 60_000,
    },
    queue: {
      enabled: false,
      mode: "inline",
      topic: "pm-decision-jobs",
      visibilityTimeoutMs: 30 * 60_000,
      maxDeliveries: 5,
      cronJobs: {
        total: 1,
        queued: 0,
        running: 0,
        succeeded: 1,
        failed: 0,
        retryBacklog: 0,
        overdueRetry: 0,
        exhaustedFailed: 0,
        staleRunning: 0,
        zeroOutputSuccess: 0,
      },
    },
    latest: {
      cronJob: {
        id: "pm-job:cron",
        status: "succeeded",
        createdAt: "2026-05-18T11:00:00.000Z",
        updatedAt: "2026-05-18T11:05:00.000Z",
        startedAt: "2026-05-18T11:01:00.000Z",
        completedAt: "2026-05-18T11:05:00.000Z",
        ageMs: 55 * 60_000,
        outputCount: 1,
        attemptCount: 1,
        maxAttempts: 3,
        nextRunAt: null,
        lastError: null,
      },
      cronRun: {
        id: "run:cron",
        status: "succeeded",
        startedAt: "2026-05-18T11:02:00.000Z",
        completedAt: "2026-05-18T11:05:00.000Z",
        ageMs: 55 * 60_000,
        symbol: "BTC",
        candidateKey: "BTC",
        decisionRecordId: "pm:BTC",
        publicTimelineEventId: "pm-decision:pm:BTC",
        error: null,
        skipReason: null,
      },
    },
    issues: [],
    ...overrides,
  };
}

function freshness(
  overrides: Partial<DecisionOpsFreshnessReport> = {},
): DecisionOpsFreshnessReport {
  return {
    schemaVersion: 1,
    generatedAt: "2026-05-18T12:00:00.000Z",
    status: "healthy",
    signals: {
      latestCronJobAt: "2026-05-18T11:00:00.000Z",
      latestCronJobAgeMs: 60 * 60_000,
      latestSucceededRunAt: "2026-05-18T11:05:00.000Z",
      latestSucceededRunAgeMs: 55 * 60_000,
      latestPublicPmEventAt: "2026-05-18T11:05:00.000Z",
      latestPublicPmEventAgeMs: 55 * 60_000,
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

function health(overrides: Partial<DecisionOpsHealthSummary> = {}): DecisionOpsHealthSummary {
  return {
    schemaVersion: 1,
    generatedAt: "2026-05-18T12:00:00.000Z",
    status: "healthy",
    queue: {
      total: 1,
      queued: 0,
      running: 0,
      succeeded: 1,
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
      total: 1,
      running: 0,
      succeeded: 1,
      skipped: 0,
      failed: 0,
      qualityBlocked: 0,
      staleRunning: 0,
      oldestRunningAgeMs: null,
      p95DurationMs: 180_000,
      latestStartedAt: "2026-05-18T11:02:00.000Z",
    },
    quality: {
      blockedPublications: 0,
      scoredRuns: 1,
      publishableRuns: 1,
      averageScore: 82,
      warningCounts: {},
    },
    alerts: [],
    alertDetails: [],
    ...overrides,
  };
}

describe("buildDecisionOpsChainRunbook", () => {
  it("explains that the public board has recent output when every link is fresh", () => {
    const runbook = buildDecisionOpsChainRunbook({
      cronAudit: cronAudit(),
      freshness: freshness(),
      health: health(),
      now,
    });

    expect(runbook).toMatchObject({
      schemaVersion: 1,
      status: "healthy",
      rootCause: "public_output_recent",
      publicBoardState: "has_recent_public_output",
      summary: "Cron, PM run, and public timeline output are fresh.",
      chain: [
        expect.objectContaining({ link: "cron_delivery", status: "ready" }),
        expect.objectContaining({ link: "job_ledger", status: "ready" }),
        expect.objectContaining({ link: "pm_runner", status: "ready" }),
        expect.objectContaining({ link: "public_timeline", status: "ready" }),
      ],
      runbookActions: [],
    });
  });

  it("pinpoints cron delivery when no scheduled job has appeared recently", () => {
    const runbook = buildDecisionOpsChainRunbook({
      cronAudit: cronAudit({
        status: "critical",
        latest: { cronJob: null, cronRun: null },
        issues: [
          {
            type: "no_cron_job",
            severity: "critical",
            targetId: "cron-job-ledger",
            ageMs: null,
            message: "No scheduled PM cron job exists in the job ledger.",
            action: "Verify Vercel cron delivery and /api/cron/strategy-replay authorization.",
          },
          {
            type: "no_cron_run",
            severity: "critical",
            targetId: "cron-run-ledger",
            ageMs: null,
            message: "No scheduled PM run exists in the run ledger.",
            action: "Verify scheduled jobs are reaching the PM decision runner.",
          },
        ],
      }),
      freshness: freshness({
        status: "critical",
        signals: {
          ...freshness().signals,
          latestCronJobAt: null,
          latestCronJobAgeMs: null,
          latestSucceededRunAt: null,
          latestSucceededRunAgeMs: null,
          latestPublicPmEventAt: null,
          latestPublicPmEventAgeMs: null,
        },
      }),
      health: health(),
      now,
    });

    expect(runbook.status).toBe("critical");
    expect(runbook.rootCause).toBe("cron_delivery_stalled");
    expect(runbook.publicBoardState).toBe("no_public_output");
    expect(runbook.chain[0]).toMatchObject({
      link: "cron_delivery",
      status: "blocked",
      issueCodes: ["no_cron_job"],
    });
    expect(runbook.runbookActions[0]).toMatchObject({
      title: "Verify Vercel cron delivery",
      executable: false,
    });
  });

  it("pinpoints public projection when scheduled PM succeeds without a card", () => {
    const runbook = buildDecisionOpsChainRunbook({
      cronAudit: cronAudit({
        status: "critical",
        latest: {
          ...cronAudit().latest,
          cronRun: {
            ...cronAudit().latest.cronRun!,
            publicTimelineEventId: null,
          },
        },
        issues: [
          {
            type: "cron_run_missing_public_output",
            severity: "critical",
            targetId: "run:cron",
            ageMs: 55 * 60_000,
            message:
              "Latest scheduled PM run wrote a decision record without a public timeline event.",
            action: "Inspect public projection and hydration before touching PM execution.",
          },
        ],
      }),
      freshness: freshness({
        status: "critical",
        signals: {
          ...freshness().signals,
          latestPublicPmEventAt: null,
          latestPublicPmEventAgeMs: null,
        },
      }),
      health: health(),
      now,
    });

    expect(runbook.status).toBe("critical");
    expect(runbook.rootCause).toBe("public_projection_stalled");
    expect(runbook.publicBoardState).toBe("no_public_output");
    expect(runbook.chain[3]).toMatchObject({
      link: "public_timeline",
      status: "blocked",
      issueCodes: ["cron_run_missing_public_output"],
    });
    expect(runbook.runbookActions[0]).toMatchObject({
      title: "Inspect public projection before replay",
      executable: false,
    });
  });
});
