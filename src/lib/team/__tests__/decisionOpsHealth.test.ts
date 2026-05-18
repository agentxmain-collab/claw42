import { describe, expect, it } from "vitest";
import { summarizeDecisionOpsHealth } from "@/lib/team/decisionOpsHealth";
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
        job({ id: "succeeded", status: "succeeded", completedAt: "2026-05-18T11:45:00.000Z" }),
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
      ],
    });

    expect(summary.generatedAt).toBe("2026-05-18T12:00:00.000Z");
    expect(summary.queue).toMatchObject({
      total: 5,
      queued: 2,
      running: 1,
      failed: 1,
      succeeded: 1,
      retryBacklog: 1,
      overdueRetry: 2,
      staleRunning: 1,
      oldestQueuedAgeMs: 20 * 60_000,
    });
    expect(summary.runs).toMatchObject({
      total: 2,
      succeeded: 1,
      skipped: 1,
      qualityBlocked: 1,
      p95DurationMs: 10 * 60_000,
    });
    expect(summary.alerts).toEqual(
      expect.arrayContaining(["queue_overdue_retry", "queue_stale_running", "quality_blocking"]),
    );
  });
});
