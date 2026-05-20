import { describe, expect, it } from "vitest";
import { buildDecisionOpsResidentQueueCanary } from "@/lib/team/decisionOpsResidentQueueCanary";
import type { DecisionRunRecord } from "@/lib/team/decisionRunLedger";
import type { PmDecisionJobRecord } from "@/lib/watch/pmDecisionJobLedger";
import type { PublicTimelineEvent } from "@/lib/watch/publicTimelineEvent";
import type { CandidateType } from "@/lib/watch/decisionCandidate";

describe("buildDecisionOpsResidentQueueCanary", () => {
  it("marks resident lanes ready only when job, run, and public timeline all line up", () => {
    const report = buildDecisionOpsResidentQueueCanary({
      jobs: [
        job("market_overview", "market_overview:utc:zh_CN:2026-05-20T06", ["record-market"]),
        job("hotspot", "hotspot:utc:zh_CN:2026-05-20T06:market", ["record-hotspot"]),
      ],
      runs: [
        run("market_overview", "market_overview:utc:zh_CN:2026-05-20T06", "record-market"),
        run("hotspot", "hotspot:utc:zh_CN:2026-05-20T06:market", "record-hotspot"),
      ],
      publicEvents: [
        publicEvent("market_overview", "market_overview:utc:zh_CN:2026-05-20T06", "record-market"),
        publicEvent("hotspot", "hotspot:utc:zh_CN:2026-05-20T06:market", "record-hotspot"),
      ],
      now: Date.parse("2026-05-20T07:00:00.000Z"),
    });

    expect(report).toMatchObject({
      status: "ready",
      allResidentClosedLoopReady: true,
      summary: {
        readyLanes: 2,
        degradedLanes: 0,
        blockedLanes: 0,
      },
      blockingReasons: [],
    });
  });

  it("keeps queued resident work degraded instead of marking the lane broken", () => {
    const report = buildDecisionOpsResidentQueueCanary({
      jobs: [
        job("market_overview", "market_overview:utc:zh_CN:2026-05-20T06", [], {
          status: "queued",
          outputCount: 0,
        }),
        job("hotspot", "hotspot:utc:zh_CN:2026-05-20T06:market", ["record-hotspot"]),
      ],
      runs: [run("hotspot", "hotspot:utc:zh_CN:2026-05-20T06:market", "record-hotspot")],
      publicEvents: [
        publicEvent("hotspot", "hotspot:utc:zh_CN:2026-05-20T06:market", "record-hotspot"),
      ],
      now: Date.parse("2026-05-20T07:00:00.000Z"),
    });

    expect(report).toMatchObject({
      status: "degraded",
      allResidentClosedLoopReady: false,
      lanes: {
        marketOverview: {
          status: "degraded",
          issue: "job_pending",
          jobStatus: "queued",
        },
        hotspot: {
          status: "ready",
          issue: null,
        },
      },
      blockingReasons: ["resident_market_overview_job_pending"],
    });
  });

  it("pinpoints a succeeded zero-output job before blaming public projection", () => {
    const report = buildDecisionOpsResidentQueueCanary({
      jobs: [
        job("market_overview", "market_overview:utc:zh_CN:2026-05-20T06", [], {
          outputCount: 0,
        }),
      ],
      runs: [],
      publicEvents: [],
      now: Date.parse("2026-05-20T07:00:00.000Z"),
    });

    expect(report).toMatchObject({
      status: "blocked",
      lanes: {
        marketOverview: {
          status: "blocked",
          issue: "job_zero_output",
          jobOutputCount: 0,
        },
        hotspot: {
          status: "blocked",
          issue: "job_missing",
        },
      },
      blockingReasons: ["resident_market_overview_job_zero_output", "resident_hotspot_job_missing"],
    });
  });

  it("flags projection breaks after a successful resident run writes a decision record", () => {
    const report = buildDecisionOpsResidentQueueCanary({
      jobs: [job("hotspot", "hotspot:utc:zh_CN:2026-05-20T06:market", ["record-hotspot"])],
      runs: [run("hotspot", "hotspot:utc:zh_CN:2026-05-20T06:market", "record-hotspot")],
      publicEvents: [],
      now: Date.parse("2026-05-20T07:00:00.000Z"),
    });

    expect(report.lanes.hotspot).toMatchObject({
      status: "blocked",
      issue: "public_event_missing",
      decisionRecordId: "record-hotspot",
    });
  });
});

function job(
  candidateType: CandidateType,
  candidateKey: string,
  decisionRecordIds: string[],
  overrides: Partial<PmDecisionJobRecord> = {},
): PmDecisionJobRecord {
  return {
    id: `pm-job:${candidateKey}`,
    schemaVersion: 1,
    kind: "once",
    status: "succeeded",
    triggerSource: "cron",
    locale: "zh_CN",
    idempotencyKey: `once:cron:zh_CN:${candidateKey}:5935680`,
    candidate: {
      candidateType,
      candidateKey,
      displayTitle: candidateType,
      executable: false,
      cadence: candidateType === "market_overview" ? "daily" : "event",
      score: 1,
      reasons: [],
    },
    symbol: null,
    createdAt: "2026-05-20T06:00:00.000Z",
    updatedAt: "2026-05-20T06:03:00.000Z",
    startedAt: "2026-05-20T06:01:00.000Z",
    completedAt: "2026-05-20T06:03:00.000Z",
    attemptCount: 1,
    maxAttempts: 3,
    nextRunAt: null,
    lastError: null,
    outputCount: decisionRecordIds.length,
    decisionRecordIds,
    auditEventCount: 6,
    ...overrides,
  };
}

function run(
  candidateType: CandidateType,
  candidateKey: string,
  decisionRecordId: string,
  overrides: Partial<DecisionRunRecord> = {},
): DecisionRunRecord {
  return {
    id: `run:${candidateKey}`,
    schemaVersion: 1,
    status: "succeeded",
    triggerSource: "cron",
    locale: "zh_CN",
    candidate: {
      candidateType,
      candidateKey,
      displayTitle: candidateType,
      executable: false,
    },
    symbol: candidateType === "symbol" ? candidateKey : "MARKET",
    startedAt: "2026-05-20T06:01:00.000Z",
    completedAt: "2026-05-20T06:03:00.000Z",
    stageStatus: {},
    analystRoundCount: 14,
    activeMemberIds: ["chart_analyst"],
    abstainedMemberIds: [],
    decisionRecordId,
    publicTimelineEventId: `pm-decision:${decisionRecordId}`,
    quality: undefined,
    error: null,
    skipReason: null,
    ...overrides,
  };
}

function publicEvent(
  candidateType: CandidateType,
  candidateKey: string,
  recordId: string,
): PublicTimelineEvent {
  return {
    id: `pm-decision:${recordId}`,
    ts: Date.parse("2026-05-20T06:03:00.000Z"),
    visibility: "public",
    importance: "high",
    sourceTrigger: "pm_decision",
    evidenceIds: [],
    locale: "zh_CN",
    payload: {
      kind: "pm_decision",
      recordId,
      symbol: candidateType === "symbol" ? candidateKey : "MARKET",
      candidateType,
      candidateKey,
      displayTitle: candidateType,
      executable: false,
      tradeDecision: null,
    },
  };
}
