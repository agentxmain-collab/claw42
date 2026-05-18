import { describe, expect, it } from "vitest";
import { buildDecisionOpsReconciliation } from "@/lib/team/decisionOpsReconciliation";
import type { DecisionRunRecord } from "@/lib/team/decisionRunLedger";
import type { PmDecisionQueueReadiness } from "@/lib/team/pmDecisionJobQueue";
import type { PmDecisionJobRecord } from "@/lib/watch/pmDecisionJobLedger";
import type { PublicTimelineEvent } from "@/lib/watch/publicTimelineEvent";

const now = Date.parse("2026-05-18T12:00:00.000Z");

function queueReadiness(
  overrides: Partial<PmDecisionQueueReadiness> = {},
): PmDecisionQueueReadiness {
  return {
    schemaVersion: 1,
    enabled: true,
    mode: "queue",
    topic: "pm-decision-jobs",
    retentionSeconds: 86_400,
    visibilityTimeoutSeconds: 1_800,
    maxDeliveries: 5,
    reason: "PM_DECISION_QUEUE_ENABLED=true",
    ...overrides,
  };
}

function job(overrides: Partial<PmDecisionJobRecord> = {}): PmDecisionJobRecord {
  return {
    id: "pm-job:once:user_visit_trigger:zh_CN:BTC:5934384",
    schemaVersion: 1,
    kind: "once",
    status: "succeeded",
    triggerSource: "user_visit_trigger",
    locale: "zh_CN",
    idempotencyKey: "once:user_visit_trigger:zh_CN:BTC:5934384",
    candidate: {
      candidateType: "symbol",
      candidateKey: "BTC",
      displayTitle: "BTC 实时行情分析",
      executable: true,
      cadence: "intraday",
      score: 88,
      reasons: [{ kind: "market", label: "unit", detail: "unit test", score: 1 }],
      symbol: "BTC",
    },
    symbol: "BTC",
    createdAt: "2026-05-18T10:58:00.000Z",
    updatedAt: "2026-05-18T11:03:00.000Z",
    startedAt: "2026-05-18T11:00:00.000Z",
    completedAt: "2026-05-18T11:03:00.000Z",
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
    triggerSource: "user_visit_trigger",
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
    publicTimelineEventId: "pm-decision:pm:BTC:1779102000000",
    quality: {
      schemaVersion: 1,
      score: 86,
      publishable: true,
      warningCount: 0,
      warnings: [],
      blockingWarnings: [],
      leakCount: 0,
      duplicateRationaleCount: 0,
      roleCoverage: { active: 12, contributorCount: 12, analystInputCount: 12 },
      directionDistribution: { long: 7, short: 2, neutral: 2, wait: 1 },
      evidence: { citedEvidenceCount: 7, analystCitationCount: 11 },
      trade: {
        hasTradeCard: true,
        direction: "long",
        confidence: 0.74,
        actionable: true,
      },
    },
    error: null,
    skipReason: null,
    ...overrides,
  };
}

function pmEvent(overrides: Partial<PublicTimelineEvent> = {}): PublicTimelineEvent {
  return {
    id: "pm-decision:pm:BTC:1779102000000",
    ts: Date.parse("2026-05-18T11:03:00.000Z"),
    visibility: "public",
    importance: "high",
    sourceTrigger: "pm_decision",
    evidenceIds: [],
    locale: "zh_CN",
    payload: {
      kind: "pm_decision",
      recordId: "pm:BTC:1779102000000",
      symbol: "BTC",
      candidateType: "symbol",
      candidateKey: "BTC",
      displayTitle: "BTC 实时行情分析",
      executable: true,
      tradeDecision: null,
      rounds: [],
    },
    ...overrides,
  };
}

describe("buildDecisionOpsReconciliation", () => {
  it("flags succeeded jobs that have no matching run and keeps repair proposals read-only", () => {
    const report = buildDecisionOpsReconciliation({
      jobs: [job()],
      runs: [],
      publicEvents: [],
      queueReadiness: queueReadiness(),
      now,
    });

    expect(report.status).toBe("degraded");
    expect(report.counts).toMatchObject({
      jobs: 1,
      runs: 0,
      publicPmEvents: 0,
      issues: 1,
    });
    expect(report.issues).toEqual([
      expect.objectContaining({
        type: "job_succeeded_without_run",
        severity: "degraded",
        jobId: job().id,
        recordId: "pm:BTC:1779102000000",
        candidateKey: "BTC",
        repairProposal: expect.objectContaining({
          action: "inspect_run",
          executable: false,
        }),
      }),
    ]);
    expect(report.repairProposals.every((proposal) => proposal.executable === false)).toBe(true);
  });

  it("flags succeeded runs whose public timeline event is missing", () => {
    const report = buildDecisionOpsReconciliation({
      jobs: [job()],
      runs: [run()],
      publicEvents: [],
      queueReadiness: queueReadiness(),
      now,
    });

    expect(report.status).toBe("degraded");
    expect(report.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "run_succeeded_without_public_event",
          runId: run().id,
          recordId: "pm:BTC:1779102000000",
          publicTimelineEventId: "pm-decision:pm:BTC:1779102000000",
          repairProposal: expect.objectContaining({
            action: "inspect_timeline_projection",
            executable: false,
          }),
        }),
      ]),
    );
  });

  it("marks the canary chain ready when queue, job, run, and public timeline all line up", () => {
    const report = buildDecisionOpsReconciliation({
      jobs: [job()],
      runs: [run()],
      publicEvents: [pmEvent()],
      queueReadiness: queueReadiness(),
      now,
    });

    expect(report.status).toBe("healthy");
    expect(report.canary.status).toBe("ready");
    expect(report.canary.checks).toEqual([
      expect.objectContaining({ name: "queue_readiness", status: "ready" }),
      expect.objectContaining({ name: "job_success", status: "ready" }),
      expect.objectContaining({ name: "run_success", status: "ready" }),
      expect.objectContaining({ name: "public_timeline", status: "ready" }),
    ]);
  });

  it("rolls up 24h and 7d history health with stable rates", () => {
    const olderThan24h = "2026-05-16T11:00:00.000Z";
    const report = buildDecisionOpsReconciliation({
      jobs: [
        job({ id: "job-24h-ok", outputCount: 1, completedAt: "2026-05-18T11:03:00.000Z" }),
        job({
          id: "job-24h-zero",
          outputCount: 0,
          decisionRecordIds: [],
          completedAt: "2026-05-18T10:03:00.000Z",
        }),
        job({ id: "job-7d-ok", outputCount: 1, completedAt: olderThan24h }),
      ],
      runs: [
        run({ id: "run-24h-ok", completedAt: "2026-05-18T11:03:00.000Z" }),
        run({
          id: "run-24h-blocked",
          status: "skipped",
          completedAt: "2026-05-18T10:03:00.000Z",
          decisionRecordId: null,
          publicTimelineEventId: null,
          skipReason: "public_quality_gate_failed",
          quality: {
            ...run().quality!,
            score: 40,
            publishable: false,
            warningCount: 1,
            warnings: ["low_quality_score"],
            blockingWarnings: ["low_quality_score"],
          },
        }),
        run({ id: "run-7d-ok", completedAt: olderThan24h, startedAt: "2026-05-16T10:57:00.000Z" }),
      ],
      publicEvents: [
        pmEvent({ id: "event-24h", ts: Date.parse("2026-05-18T11:03:00.000Z") }),
        pmEvent({
          id: "event-7d",
          ts: Date.parse(olderThan24h),
        }),
      ],
      queueReadiness: queueReadiness(),
      now,
    });

    expect(report.history.windows).toEqual([
      expect.objectContaining({
        windowHours: 24,
        jobs: 2,
        runs: 2,
        publicPmEvents: 1,
        zeroOutputRate: 0.5,
        qualityBlockRate: 0.5,
        averageQualityScore: 63,
      }),
      expect.objectContaining({
        windowHours: 168,
        jobs: 3,
        runs: 3,
        publicPmEvents: 2,
        zeroOutputRate: 0.333,
        qualityBlockRate: 0.333,
        averageQualityScore: 71,
      }),
    ]);
  });
});
