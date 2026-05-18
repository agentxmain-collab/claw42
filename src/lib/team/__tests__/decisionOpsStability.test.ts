import { describe, expect, it } from "vitest";
import { buildDecisionOpsStability } from "@/lib/team/decisionOpsStability";
import type { DecisionRunRecord } from "@/lib/team/decisionRunLedger";
import type { PmDecisionJobRecord } from "@/lib/watch/pmDecisionJobLedger";
import type { PublicTimelineEvent } from "@/lib/watch/publicTimelineEvent";

const now = Date.parse("2026-05-19T12:00:00.000Z");

function job(overrides: Partial<PmDecisionJobRecord> = {}): PmDecisionJobRecord {
  return {
    id: "pm-job:cron:BTC",
    schemaVersion: 1,
    kind: "batch",
    status: "succeeded",
    triggerSource: "cron",
    locale: "zh_CN",
    idempotencyKey: "cron:zh_CN:BTC",
    candidate: null,
    symbol: "BTC",
    createdAt: "2026-05-19T09:00:00.000Z",
    updatedAt: "2026-05-19T09:05:00.000Z",
    startedAt: "2026-05-19T09:01:00.000Z",
    completedAt: "2026-05-19T09:05:00.000Z",
    attemptCount: 1,
    maxAttempts: 3,
    nextRunAt: null,
    lastError: null,
    outputCount: 1,
    decisionRecordIds: ["pm:BTC"],
    auditEventCount: 1,
    ...overrides,
  };
}

function run(overrides: Partial<DecisionRunRecord> = {}): DecisionRunRecord {
  return {
    id: "run:cron:BTC",
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
    startedAt: "2026-05-19T09:02:00.000Z",
    completedAt: "2026-05-19T09:05:00.000Z",
    stageStatus: {},
    analystRoundCount: 14,
    activeMemberIds: ["chart_analyst"],
    abstainedMemberIds: [],
    decisionRecordId: "pm:BTC",
    publicTimelineEventId: "pm-decision:pm:BTC",
    error: null,
    skipReason: null,
    ...overrides,
  };
}

function event(overrides: Partial<PublicTimelineEvent> = {}): PublicTimelineEvent {
  return {
    id: "pm-decision:pm:BTC",
    ts: Date.parse("2026-05-19T09:05:00.000Z"),
    visibility: "public",
    importance: "high",
    sourceTrigger: "pm_decision",
    evidenceIds: [],
    locale: "zh_CN",
    payload: {
      kind: "pm_decision",
      recordId: "pm:BTC",
      symbol: "BTC",
    },
    ...overrides,
  };
}

function hourlyIso(hoursAgo: number) {
  return new Date(now - hoursAgo * 60 * 60_000).toISOString();
}

describe("buildDecisionOpsStability", () => {
  it("stays healthy when 24h and 7d windows have enough cron, run, and public output coverage", () => {
    const jobs = Array.from({ length: 56 }, (_, index) =>
      job({
        id: `job:${index}`,
        createdAt: hourlyIso(index * 3),
        updatedAt: hourlyIso(index * 3),
        completedAt: hourlyIso(index * 3),
        decisionRecordIds: [`pm:${index}`],
      }),
    );
    const runs = Array.from({ length: 56 }, (_, index) =>
      run({
        id: `run:${index}`,
        startedAt: hourlyIso(index * 3),
        completedAt: hourlyIso(index * 3),
        decisionRecordId: `pm:${index}`,
        publicTimelineEventId: `pm-decision:pm:${index}`,
      }),
    );
    const events = Array.from({ length: 56 }, (_, index) =>
      event({
        id: `pm-decision:pm:${index}`,
        ts: Date.parse(hourlyIso(index * 3)),
        payload: {
          kind: "pm_decision",
          recordId: `pm:${index}`,
          symbol: "BTC",
        },
      }),
    );

    const report = buildDecisionOpsStability({ jobs, runs, publicEvents: events, now });

    expect(report).toMatchObject({
      schemaVersion: 1,
      status: "healthy",
      primaryIssue: null,
      windows: [
        expect.objectContaining({
          windowHours: 24,
          cronCoverageRate: 1,
          runSuccessRate: 1,
          publicOutputRate: 1,
        }),
        expect.objectContaining({
          windowHours: 168,
          cronCoverageRate: 1,
          runSuccessRate: 1,
          publicOutputRate: 1,
        }),
      ],
      issues: [],
    });
  });

  it("flags a cron cadence gap before queue or model changes are suggested", () => {
    const report = buildDecisionOpsStability({
      jobs: [job({ id: "job:only", createdAt: hourlyIso(1), completedAt: hourlyIso(1) })],
      runs: [run({ id: "run:only", startedAt: hourlyIso(1), completedAt: hourlyIso(1) })],
      publicEvents: [event({ id: "event:only", ts: Date.parse(hourlyIso(1)) })],
      now,
    });

    expect(report.status).toBe("degraded");
    expect(report.primaryIssue).toBe("cron_cadence_gap");
    expect(report.issues[0]).toMatchObject({
      type: "cron_cadence_gap",
      severity: "degraded",
      windowHours: 24,
      action: "Inspect scheduled cron delivery before changing PM execution cadence.",
    });
  });

  it("treats missing public output after successful runs as critical", () => {
    const report = buildDecisionOpsStability({
      jobs: [
        job({
          id: "job:1",
          createdAt: hourlyIso(1),
          completedAt: hourlyIso(1),
          decisionRecordIds: ["pm:BTC"],
        }),
      ],
      runs: [
        run({
          id: "run:1",
          startedAt: hourlyIso(1),
          completedAt: hourlyIso(1),
          decisionRecordId: "pm:BTC",
          publicTimelineEventId: null,
        }),
      ],
      publicEvents: [],
      now,
    });

    expect(report.status).toBe("critical");
    expect(report.primaryIssue).toBe("public_output_gap");
    expect(report.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "public_output_gap",
          severity: "critical",
          windowHours: 24,
        }),
      ]),
    );
  });

  it("flags stale running jobs as critical queue stability risk", () => {
    const report = buildDecisionOpsStability({
      jobs: [
        job({
          id: "job:stale",
          status: "running",
          createdAt: hourlyIso(2),
          updatedAt: hourlyIso(2),
          startedAt: hourlyIso(2),
          completedAt: null,
        }),
      ],
      runs: [],
      publicEvents: [],
      now,
    });

    expect(report.status).toBe("critical");
    expect(report.primaryIssue).toBe("stale_running_job");
    expect(report.issues[0]).toMatchObject({
      type: "stale_running_job",
      targetId: "job:stale",
      severity: "critical",
    });
  });
});
