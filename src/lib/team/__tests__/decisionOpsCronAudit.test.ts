import { describe, expect, it } from "vitest";
import { buildDecisionOpsCronAudit } from "@/lib/team/decisionOpsCronAudit";
import type { DecisionRunRecord } from "@/lib/team/decisionRunLedger";
import type { PmDecisionQueueReadiness } from "@/lib/team/pmDecisionJobQueue";
import type { PmDecisionJobRecord } from "@/lib/watch/pmDecisionJobLedger";

const now = Date.parse("2026-05-18T12:00:00.000Z");

function job(overrides: Partial<PmDecisionJobRecord> = {}): PmDecisionJobRecord {
  return {
    id: "pm-job:batch:cron:zh_CN:auto:5934384",
    schemaVersion: 1,
    kind: "batch",
    status: "succeeded",
    triggerSource: "cron",
    locale: "zh_CN",
    idempotencyKey: "batch:cron:zh_CN:auto:5934384",
    candidate: null,
    symbol: null,
    createdAt: "2026-05-18T11:00:00.000Z",
    updatedAt: "2026-05-18T11:05:00.000Z",
    startedAt: "2026-05-18T11:01:00.000Z",
    completedAt: "2026-05-18T11:05:00.000Z",
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
    triggerSource: "cron",
    locale: "zh_CN",
    candidate: {
      candidateType: "symbol",
      candidateKey: "BTC",
      displayTitle: "BTC 实时行情分析",
      executable: true,
      symbol: "BTC",
    },
    symbol: "BTC",
    startedAt: "2026-05-18T11:02:00.000Z",
    completedAt: "2026-05-18T11:05:00.000Z",
    stageStatus: {},
    analystRoundCount: 22,
    activeMemberIds: ["chart_analyst"],
    abstainedMemberIds: [],
    decisionRecordId: "pm:BTC:1779102000000",
    publicTimelineEventId: "pm-decision:pm:BTC:1779102000000",
    error: null,
    skipReason: null,
    ...overrides,
  };
}

function queueReadiness(
  overrides: Partial<PmDecisionQueueReadiness> = {},
): PmDecisionQueueReadiness {
  return {
    schemaVersion: 1,
    enabled: false,
    mode: "inline",
    topic: "pm-decision-jobs",
    retentionSeconds: 86_400,
    visibilityTimeoutSeconds: 1_800,
    maxDeliveries: 5,
    reason: "PM_DECISION_QUEUE_ENABLED is not true",
    ...overrides,
  };
}

describe("buildDecisionOpsCronAudit", () => {
  it("reports cron schedule, queue mode, and latest cron job/run when the chain is recent", () => {
    const audit = buildDecisionOpsCronAudit({
      jobs: [job()],
      runs: [run()],
      queueReadiness: queueReadiness(),
      now,
    });

    expect(audit).toMatchObject({
      schemaVersion: 1,
      status: "healthy",
      schedule: {
        path: "/api/cron/strategy-replay",
        expression: "0 */3 * * *",
        expectedIntervalMs: 3 * 60 * 60_000,
      },
      queue: {
        mode: "inline",
        topic: "pm-decision-jobs",
        cronJobs: {
          total: 1,
          succeeded: 1,
          failed: 0,
          overdueRetry: 0,
          staleRunning: 0,
        },
      },
      latest: {
        cronJob: expect.objectContaining({
          id: "pm-job:batch:cron:zh_CN:auto:5934384",
          status: "succeeded",
          ageMs: 55 * 60_000,
          outputCount: 1,
        }),
        cronRun: expect.objectContaining({
          id: "run:pm:BTC:1779102000000",
          status: "succeeded",
          ageMs: 55 * 60_000,
          publicTimelineEventId: "pm-decision:pm:BTC:1779102000000",
        }),
      },
      issues: [],
    });
  });

  it("surfaces stale cron delivery and missing run output as actionable critical issues", () => {
    const audit = buildDecisionOpsCronAudit({
      jobs: [
        job({
          id: "pm-job:old-cron",
          createdAt: "2026-05-18T03:00:00.000Z",
          updatedAt: "2026-05-18T03:01:00.000Z",
          completedAt: "2026-05-18T03:05:00.000Z",
        }),
      ],
      runs: [],
      queueReadiness: queueReadiness({ enabled: true, mode: "queue" }),
      now,
    });

    expect(audit.status).toBe("critical");
    expect(audit.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "cron_job_stale",
          severity: "critical",
          targetId: "pm-job:old-cron",
          ageMs: 9 * 60 * 60_000,
        }),
        expect.objectContaining({
          type: "no_cron_run",
          severity: "critical",
          targetId: "cron-run-ledger",
        }),
      ]),
    );
  });

  it("flags retry backlog and queue lease problems only for scheduled cron jobs", () => {
    const audit = buildDecisionOpsCronAudit({
      jobs: [
        job({
          id: "pm-job:cron-overdue",
          status: "failed",
          attemptCount: 1,
          nextRunAt: "2026-05-18T11:55:00.000Z",
          lastError: "provider timeout",
        }),
        job({
          id: "pm-job:cron-running",
          status: "running",
          startedAt: "2026-05-18T11:00:00.000Z",
          completedAt: null,
          nextRunAt: null,
        }),
        job({
          id: "pm-job:user-overdue",
          triggerSource: "user_visit_trigger",
          status: "failed",
          nextRunAt: "2026-05-18T11:55:00.000Z",
        }),
      ],
      runs: [run()],
      queueReadiness: queueReadiness({ enabled: true, mode: "queue" }),
      now,
    });

    expect(audit.status).toBe("critical");
    expect(audit.queue.cronJobs).toMatchObject({
      total: 2,
      running: 1,
      failed: 1,
      overdueRetry: 1,
      staleRunning: 1,
    });
    expect(audit.issues.map((issue) => issue.type)).toEqual(
      expect.arrayContaining(["cron_job_retry_overdue", "cron_job_stale_running"]),
    );
    expect(audit.issues.map((issue) => issue.targetId)).not.toContain("pm-job:user-overdue");
  });
});
