import { describe, expect, it } from "vitest";
import { buildDecisionOpsQueueRecoveryPolicy } from "@/lib/team/decisionOpsQueueRecoveryPolicy";
import type { DecisionOpsChainRunbook } from "@/lib/team/decisionOpsChainRunbook";
import type { DecisionOpsCronAudit } from "@/lib/team/decisionOpsCronAudit";
import type { DecisionOpsHealthSummary } from "@/lib/team/decisionOpsHealth";

const now = Date.parse("2026-05-18T12:00:00.000Z");

function runbook(overrides: Partial<DecisionOpsChainRunbook> = {}): DecisionOpsChainRunbook {
  return {
    schemaVersion: 1,
    generatedAt: "2026-05-18T12:00:00.000Z",
    status: "healthy",
    rootCause: "public_output_recent",
    publicBoardState: "has_recent_public_output",
    summary: "Cron, PM run, and public timeline output are fresh.",
    evidence: {
      latestCronJobAt: "2026-05-18T11:00:00.000Z",
      latestSuccessfulRunAt: "2026-05-18T11:05:00.000Z",
      latestPublicPmEventAt: "2026-05-18T11:05:00.000Z",
      cronIssueCodes: [],
      freshnessAlerts: [],
      healthAlerts: [],
    },
    chain: [],
    runbookActions: [],
    ...overrides,
  };
}

function cronAudit(overrides: Partial<DecisionOpsCronAudit> = {}): DecisionOpsCronAudit {
  return {
    schemaVersion: 1,
    generatedAt: "2026-05-18T12:00:00.000Z",
    status: "healthy",
    schedule: {
      path: "/api/cron/strategy-replay",
      expression: "0 */3 * * *",
      expectedIntervalMs: 10_800_000,
      degradedAfterMs: 14_400_000,
      criticalAfterMs: 28_800_000,
    },
    queue: {
      enabled: false,
      mode: "inline",
      topic: "pm-decision-jobs",
      visibilityTimeoutMs: 1_800_000,
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
      cronJob: null,
      cronRun: null,
    },
    issues: [],
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

describe("buildDecisionOpsQueueRecoveryPolicy", () => {
  it("keeps healthy chains in observe mode with no manual action", () => {
    const policy = buildDecisionOpsQueueRecoveryPolicy({
      runbook: runbook(),
      cronAudit: cronAudit(),
      health: health(),
      now,
    });

    expect(policy).toMatchObject({
      schemaVersion: 1,
      status: "healthy",
      mode: "observe",
      shouldPauseNewTriggers: false,
      autoRecoveryAllowed: false,
      primaryAction: null,
      recoverySteps: [],
    });
  });

  it("requires manual intervention for exhausted scheduled job retries", () => {
    const policy = buildDecisionOpsQueueRecoveryPolicy({
      runbook: runbook({
        status: "critical",
        rootCause: "job_queue_stalled",
        publicBoardState: "no_public_output",
      }),
      cronAudit: cronAudit({
        status: "critical",
        queue: {
          ...cronAudit().queue,
          cronJobs: {
            ...cronAudit().queue.cronJobs,
            failed: 1,
            retryBacklog: 0,
            exhaustedFailed: 1,
          },
        },
        issues: [
          {
            type: "cron_job_retry_exhausted",
            severity: "critical",
            targetId: "pm-job:cron",
            ageMs: 30 * 60_000,
            message: "Scheduled PM job exhausted all retry attempts.",
            action: "Inspect lastError and provider telemetry before replaying the job.",
          },
        ],
      }),
      health: health({
        status: "critical",
        queue: {
          ...health().queue,
          failed: 1,
          exhaustedFailed: 1,
        },
        alerts: ["queue_exhausted"],
      }),
      now,
    });

    expect(policy).toMatchObject({
      status: "critical",
      mode: "manual_intervention",
      shouldPauseNewTriggers: true,
      autoRecoveryAllowed: false,
      primaryAction: "Inspect exhausted cron jobs before any replay.",
      recoverySteps: [
        expect.objectContaining({
          title: "Inspect exhausted cron jobs before any replay",
          executable: false,
        }),
      ],
    });
  });

  it("routes zero-output and quality blocks to investigation before replay", () => {
    const policy = buildDecisionOpsQueueRecoveryPolicy({
      runbook: runbook({
        status: "degraded",
        rootCause: "quality_or_zero_output_stalled",
        publicBoardState: "no_public_output",
      }),
      cronAudit: cronAudit({
        status: "degraded",
        queue: {
          ...cronAudit().queue,
          cronJobs: {
            ...cronAudit().queue.cronJobs,
            zeroOutputSuccess: 1,
          },
        },
        issues: [
          {
            type: "cron_job_zero_output",
            severity: "degraded",
            targetId: "pm-job:cron",
            ageMs: 20 * 60_000,
            message: "Scheduled PM job succeeded without writing decision records.",
            action: "Inspect run skipReason, quality gate, and public projection before replay.",
          },
        ],
      }),
      health: health({
        status: "degraded",
        queue: {
          ...health().queue,
          zeroOutputSuccess: 1,
        },
        alerts: ["job_zero_output"],
      }),
      now,
    });

    expect(policy).toMatchObject({
      status: "degraded",
      mode: "investigate_before_replay",
      shouldPauseNewTriggers: false,
      autoRecoveryAllowed: false,
      primaryAction: "Inspect quality gate and zero-output guards before replay.",
    });
  });
});
