import { describe, expect, it } from "vitest";
import {
  buildDecisionOpsHealthDetails,
  summarizeDecisionOpsHealth,
} from "@/lib/team/decisionOpsHealth";
import type { DecisionRunRecord } from "@/lib/team/decisionRunLedger";
import type { PmDecisionJobRecord } from "@/lib/watch/pmDecisionJobLedger";

const now = Date.parse("2026-05-18T12:00:00.000Z");

function job(overrides: Partial<PmDecisionJobRecord> = {}): PmDecisionJobRecord {
  return {
    id: "pm-job:once:user_visit_trigger:zh_CN:BTC:5934384",
    schemaVersion: 1,
    kind: "once",
    status: "queued",
    triggerSource: "user_visit_trigger",
    locale: "zh_CN",
    idempotencyKey: "once:user_visit_trigger:zh_CN:BTC:5934384",
    candidate: null,
    symbol: "BTC",
    createdAt: "2026-05-18T11:40:00.000Z",
    updatedAt: "2026-05-18T11:40:00.000Z",
    startedAt: null,
    completedAt: null,
    attemptCount: 0,
    maxAttempts: 3,
    nextRunAt: "2026-05-18T11:40:00.000Z",
    lastError: null,
    outputCount: 0,
    decisionRecordIds: [],
    auditEventCount: 0,
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
    startedAt: "2026-05-18T11:00:00.000Z",
    completedAt: "2026-05-18T11:03:00.000Z",
    stageStatus: {
      analyst_inputs: "done",
      research_lead: "done",
      trade_decision: "done",
      risk_lead: "done",
      record_write: "done",
      public_timeline: "done",
    },
    analystRoundCount: 22,
    activeMemberIds: ["chart_analyst"],
    abstainedMemberIds: [],
    decisionRecordId: "pm:BTC:1779102000000",
    publicTimelineEventId: "public:pm:BTC:1779102000000",
    error: null,
    skipReason: null,
    ...overrides,
  };
}

describe("summarizeDecisionOpsHealth", () => {
  it("summarizes queue backlog, stale running jobs, overdue retries, and run latency", () => {
    const summary = summarizeDecisionOpsHealth({
      now,
      jobs: [
        job({ id: "queued-fresh", status: "queued", nextRunAt: "2026-05-18T12:05:00.000Z" }),
        job({ id: "queued-overdue", status: "queued", nextRunAt: "2026-05-18T11:59:00.000Z" }),
        job({
          id: "running-stale",
          status: "running",
          startedAt: "2026-05-18T11:00:00.000Z",
          attemptCount: 1,
          nextRunAt: null,
        }),
        job({ id: "failed-retry", status: "failed", nextRunAt: "2026-05-18T11:58:00.000Z" }),
        job({ id: "failed-exhausted", status: "failed", attemptCount: 3, nextRunAt: null }),
        job({ id: "succeeded", status: "succeeded", completedAt: "2026-05-18T11:45:00.000Z" }),
        job({
          id: "succeeded-zero-output",
          status: "succeeded",
          outputCount: 0,
          auditEventCount: 4,
          completedAt: "2026-05-18T11:50:00.000Z",
        }),
      ],
      runs: [
        run(),
        run({
          id: "run-blocked",
          status: "skipped",
          startedAt: "2026-05-18T10:00:00.000Z",
          completedAt: "2026-05-18T10:10:00.000Z",
          skipReason: "public_quality_gate_failed",
          quality: {
            schemaVersion: 1,
            score: 42,
            publishable: false,
            warningCount: 1,
            warnings: ["low_quality_score"],
            blockingWarnings: ["low_quality_score"],
            leakCount: 0,
            duplicateRationaleCount: 0,
            roleCoverage: { active: 2, contributorCount: 2, analystInputCount: 2 },
            directionDistribution: { long: 0, short: 0, neutral: 1, wait: 1 },
            evidence: { citedEvidenceCount: 0, analystCitationCount: 0 },
            trade: {
              hasTradeCard: false,
              direction: null,
              confidence: null,
              actionable: false,
            },
          },
        }),
        run({
          id: "run-stale-running",
          status: "running",
          startedAt: "2026-05-18T11:00:00.000Z",
          completedAt: null,
          decisionRecordId: null,
          publicTimelineEventId: null,
        }),
      ],
    });

    expect(summary.generatedAt).toBe("2026-05-18T12:00:00.000Z");
    expect(summary.status).toBe("critical");
    expect(summary.queue).toMatchObject({
      total: 7,
      queued: 2,
      running: 1,
      failed: 2,
      succeeded: 2,
      retryBacklog: 1,
      overdueRetry: 2,
      exhaustedFailed: 1,
      staleRunning: 1,
      zeroOutputSuccess: 2,
      oldestQueuedAgeMs: 20 * 60_000,
    });
    expect(summary.runs).toMatchObject({
      total: 3,
      running: 1,
      succeeded: 1,
      skipped: 1,
      qualityBlocked: 1,
      staleRunning: 1,
      oldestRunningAgeMs: 60 * 60_000,
      p95DurationMs: 10 * 60_000,
    });
    expect(summary.quality).toMatchObject({
      scoredRuns: 1,
      publishableRuns: 0,
      averageScore: 42,
    });
    expect(summary.alerts).toEqual(
      expect.arrayContaining([
        "queue_overdue_retry",
        "queue_stale_running",
        "queue_exhausted",
        "job_zero_output",
        "run_stale_running",
        "quality_blocking",
      ]),
    );
    expect(summary.alertDetails).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          alert: "queue_exhausted",
          severity: "critical",
          count: 1,
        }),
        expect.objectContaining({
          alert: "quality_blocking",
          severity: "degraded",
          count: 1,
        }),
        expect.objectContaining({
          alert: "job_zero_output",
          severity: "degraded",
          count: 2,
        }),
        expect.objectContaining({
          alert: "run_stale_running",
          severity: "critical",
          count: 1,
        }),
      ]),
    );
  });

  it("builds bounded operator details for recent jobs and runs", () => {
    const details = buildDecisionOpsHealthDetails({
      jobs: [job({ id: "job-newer", updatedAt: "2026-05-18T11:55:00.000Z" }), job()],
      runs: [
        run({
          id: "run-newer",
          startedAt: "2026-05-18T11:50:00.000Z",
          quality: {
            schemaVersion: 1,
            score: 88,
            publishable: true,
            warningCount: 0,
            warnings: [],
            blockingWarnings: [],
            leakCount: 0,
            duplicateRationaleCount: 0,
            roleCoverage: { active: 3, contributorCount: 3, analystInputCount: 3 },
            directionDistribution: { long: 2, short: 0, neutral: 1, wait: 0 },
            evidence: { citedEvidenceCount: 3, analystCitationCount: 3 },
            trade: {
              hasTradeCard: true,
              direction: "long",
              confidence: 0.72,
              actionable: true,
            },
          },
        }),
        run({ id: "run-older", startedAt: "2026-05-18T11:00:00.000Z" }),
      ],
      limit: 1,
    });

    expect(details).toMatchObject({
      schemaVersion: 1,
      recentJobs: [
        {
          id: "job-newer",
          status: "queued",
          triggerSource: "user_visit_trigger",
          outputCount: 0,
        },
      ],
      recentRuns: [
        {
          id: "run-newer",
          status: "succeeded",
          triggerSource: "cron",
          quality: {
            score: 88,
            publishable: true,
            blockingWarnings: [],
          },
        },
      ],
    });
  });
});
