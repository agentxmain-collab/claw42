import { describe, expect, it } from "vitest";
import { buildDecisionOpsFreshness } from "@/lib/team/decisionOpsFreshness";
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

describe("buildDecisionOpsFreshness", () => {
  it("stays healthy when cron, successful run, and public output are recent", () => {
    const freshness = buildDecisionOpsFreshness({
      jobs: [job()],
      runs: [run()],
      publicEvents: [pmEvent()],
      now,
    });

    expect(freshness).toMatchObject({
      schemaVersion: 1,
      status: "healthy",
      alerts: [],
      signals: {
        latestCronJobAt: "2026-05-18T11:00:00.000Z",
        latestSucceededRunAt: "2026-05-18T11:05:00.000Z",
        latestPublicPmEventAt: "2026-05-18T11:05:00.000Z",
      },
    });
  });

  it("raises critical freshness alerts when the long-running cron chain stalls", () => {
    const freshness = buildDecisionOpsFreshness({
      jobs: [
        job({
          id: "old-cron",
          createdAt: "2026-05-18T03:00:00.000Z",
          updatedAt: "2026-05-18T03:01:00.000Z",
          completedAt: "2026-05-18T03:05:00.000Z",
        }),
      ],
      runs: [],
      publicEvents: [
        pmEvent({
          id: "old-event",
          ts: Date.parse("2026-05-18T01:00:00.000Z"),
        }),
      ],
      now,
    });

    expect(freshness.status).toBe("critical");
    expect(freshness.alerts).toEqual(
      expect.arrayContaining([
        "cron_job_stale",
        "no_recent_successful_run",
        "public_pm_event_stale",
      ]),
    );
    expect(freshness.alertDetails).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          alert: "cron_job_stale",
          severity: "critical",
          ageMs: 9 * 60 * 60_000,
        }),
        expect.objectContaining({
          alert: "no_recent_successful_run",
          severity: "critical",
          ageMs: null,
        }),
      ]),
    );
  });
});
