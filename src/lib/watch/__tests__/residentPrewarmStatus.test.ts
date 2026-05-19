import { describe, expect, it } from "vitest";
import type { StrategyDecisionRecord } from "@/lib/team/strategyDecisionRecord";
import type { PmDecisionJobRecord } from "@/lib/watch/pmDecisionJobLedger";
import { deriveResidentPrewarmStatus } from "@/lib/watch/residentPrewarmStatus";

const now = Date.parse("2026-05-19T12:00:00.000Z");

function record(
  candidateType: "market_overview" | "hotspot",
  createdAt: string,
): StrategyDecisionRecord {
  return {
    id: `pm:${candidateType}:${createdAt}`,
    schemaVersion: 2,
    recordSource: "paper",
    symbol: candidateType === "market_overview" ? "MARKET" : "HOTSPOT",
    candidate: {
      candidateType,
      candidateKey: `${candidateType}:utc:zh_CN:${createdAt}`,
      displayTitle: candidateType === "market_overview" ? "今日大盘综述" : "热点异动追踪",
      executable: false,
      cadence: candidateType === "market_overview" ? "daily" : "event",
      score: 100,
      reasons: [],
    },
    locale: "zh_CN",
    decisionOwnerId: "pm",
    contributorIds: ["pm"],
    analystInputs: [],
    sourceThreadId: null,
    tradeDecision: null,
    createdAt,
    evaluationWindowEndsAt: null,
    resolvedAt: null,
    resolvedOutcome: null,
    promptVersion: "test",
    modelProvider: "test",
  };
}

function job(
  candidateType: "market_overview" | "hotspot",
  overrides: Partial<PmDecisionJobRecord> = {},
): PmDecisionJobRecord {
  const updatedAt = overrides.updatedAt ?? "2026-05-19T11:58:00.000Z";
  return {
    id: `pm-job:${candidateType}:${updatedAt}`,
    schemaVersion: 1,
    kind: "once",
    status: "queued",
    triggerSource: "cron",
    locale: "zh_CN",
    idempotencyKey: `once:cron:zh_CN:${candidateType}`,
    candidate: {
      candidateType,
      candidateKey: `${candidateType}:utc:zh_CN:2026-05-19T12`,
      displayTitle: candidateType === "market_overview" ? "今日大盘综述" : "热点异动追踪",
      executable: false,
      cadence: candidateType === "market_overview" ? "daily" : "event",
      score: 100,
      reasons: [],
    },
    symbol: null,
    createdAt: "2026-05-19T11:55:00.000Z",
    updatedAt,
    startedAt: null,
    completedAt: null,
    attemptCount: 0,
    maxAttempts: 3,
    nextRunAt: "2026-05-19T12:00:00.000Z",
    lastError: null,
    outputCount: 0,
    decisionRecordIds: [],
    auditEventCount: 0,
    ...overrides,
  };
}

describe("deriveResidentPrewarmStatus", () => {
  it("reports cached market success while surfacing newer hotspot failure", () => {
    const status = deriveResidentPrewarmStatus({
      records: [record("market_overview", "2026-05-19T06:30:00.000Z")],
      jobs: [
        job("hotspot", {
          status: "failed",
          updatedAt: "2026-05-19T11:58:00.000Z",
          completedAt: "2026-05-19T11:58:00.000Z",
          attemptCount: 2,
          lastError: "provider timeout",
          nextRunAt: "2026-05-19T12:03:00.000Z",
        }),
      ],
      now,
    });

    expect(status.overallState).toBe("failed");
    expect(status.latestSucceededAt).toBe("2026-05-19T06:30:00.000Z");
    expect(status.marketOverview).toMatchObject({
      kind: "market_overview",
      state: "ready",
      stale: false,
      lastSucceededAt: "2026-05-19T06:30:00.000Z",
    });
    expect(status.hotspot).toMatchObject({
      kind: "hotspot",
      state: "failed",
      lastError: "provider timeout",
      nextRunAt: "2026-05-19T12:03:00.000Z",
    });
  });

  it("prioritizes running resident jobs over older successful records", () => {
    const status = deriveResidentPrewarmStatus({
      records: [record("hotspot", "2026-05-19T10:00:00.000Z")],
      jobs: [
        job("hotspot", {
          status: "running",
          updatedAt: "2026-05-19T11:59:00.000Z",
          startedAt: "2026-05-19T11:59:00.000Z",
          attemptCount: 1,
          nextRunAt: null,
        }),
      ],
      now,
    });

    expect(status.overallState).toBe("running");
    expect(status.hotspot).toMatchObject({
      state: "running",
      lastSucceededAt: "2026-05-19T10:00:00.000Z",
      jobId: "pm-job:hotspot:2026-05-19T11:59:00.000Z",
    });
  });

  it("classifies UTC SLA health for resident market and hotspot tracks", () => {
    const status = deriveResidentPrewarmStatus({
      records: [
        record("market_overview", "2026-05-18T23:30:00.000Z"),
        record("hotspot", "2026-05-19T10:30:00.000Z"),
      ],
      jobs: [],
      now,
    });

    expect(status.slaState).toBe("critical");
    expect(status.marketOverview).toMatchObject({
      expectedIntervalMs: 3 * 60 * 60_000,
      staleAfterMs: 6 * 60 * 60_000,
      slaState: "critical",
      ageMs: 12.5 * 60 * 60_000,
    });
    expect(status.hotspot).toMatchObject({
      expectedIntervalMs: 3 * 60 * 60_000,
      staleAfterMs: 6 * 60 * 60_000,
      slaState: "healthy",
      ageMs: 1.5 * 60 * 60_000,
    });
  });
});
