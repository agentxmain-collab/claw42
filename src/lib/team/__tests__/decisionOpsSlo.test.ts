import { describe, expect, it } from "vitest";
import { buildDecisionOpsSlo } from "@/lib/team/decisionOpsSlo";
import type { DecisionRunRecord } from "@/lib/team/decisionRunLedger";
import type { PmDecisionJobRecord } from "@/lib/watch/pmDecisionJobLedger";
import type { PublicTimelineEvent } from "@/lib/watch/publicTimelineEvent";

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

function pmEvent(overrides: Partial<PublicTimelineEvent> = {}): PublicTimelineEvent {
  return {
    id: "pm-decision:pm:BTC:1779102000000",
    ts: Date.parse("2026-05-18T11:05:00.000Z"),
    visibility: "public",
    importance: "high",
    sourceTrigger: "pm_decision",
    evidenceIds: [],
    locale: "zh_CN",
    payload: {
      kind: "pm_decision",
      recordId: "pm:BTC:1779102000000",
      symbol: "BTC",
    },
    ...overrides,
  };
}

describe("buildDecisionOpsSlo", () => {
  it("stays healthy when queue, run, and public projection SLOs are met", () => {
    const slo = buildDecisionOpsSlo({
      jobs: [job()],
      runs: [run()],
      publicEvents: [pmEvent()],
      now,
    });

    expect(slo).toMatchObject({
      schemaVersion: 1,
      status: "healthy",
      violations: [],
      windows: [
        expect.objectContaining({
          windowHours: 24,
          runSuccessRate: 1,
          zeroOutputRate: 0,
          publicProjectionRate: 1,
        }),
        expect.objectContaining({
          windowHours: 168,
          runSuccessRate: 1,
          zeroOutputRate: 0,
          publicProjectionRate: 1,
        }),
      ],
    });
  });

  it("flags stuck queue/run states, bad output paths, and unstable history windows", () => {
    const slo = buildDecisionOpsSlo({
      jobs: [
        job({
          id: "job:stale-running",
          status: "running",
          startedAt: "2026-05-18T11:00:00.000Z",
          completedAt: null,
          nextRunAt: null,
        }),
        job({
          id: "job:overdue-retry",
          status: "failed",
          nextRunAt: "2026-05-18T11:55:00.000Z",
          attemptCount: 1,
        }),
        job({
          id: "job:exhausted",
          status: "failed",
          nextRunAt: null,
          attemptCount: 3,
          maxAttempts: 3,
        }),
        job({
          id: "job:zero",
          status: "succeeded",
          outputCount: 0,
          decisionRecordIds: [],
        }),
      ],
      runs: [
        run({
          id: "run:stale",
          status: "running",
          startedAt: "2026-05-18T11:00:00.000Z",
          completedAt: null,
          decisionRecordId: null,
          publicTimelineEventId: null,
        }),
        run({
          id: "run:failed",
          status: "failed",
          error: "provider timeout",
          decisionRecordId: null,
          publicTimelineEventId: null,
        }),
        run({
          id: "run:missing-public",
          decisionRecordId: "pm:ETH:1779102000000",
          publicTimelineEventId: "pm-decision:pm:ETH:1779102000000",
        }),
      ],
      publicEvents: [],
      now,
    });

    expect(slo.status).toBe("critical");
    expect(slo.violations.map((violation) => violation.type)).toEqual(
      expect.arrayContaining([
        "job_stale_running",
        "job_retry_overdue",
        "job_retry_exhausted",
        "job_success_zero_output",
        "run_stale_running",
        "run_failed",
        "run_succeeded_without_public_event",
        "window_run_success_rate_low",
        "window_zero_output_rate_high",
        "window_public_projection_rate_low",
      ]),
    );
    expect(slo.windows[0]).toMatchObject({
      windowHours: 24,
      jobs: 4,
      runs: 3,
      publicPmEvents: 0,
      runSuccessRate: 1 / 3,
      zeroOutputRate: 1,
      publicProjectionRate: 0,
    });
  });
});
