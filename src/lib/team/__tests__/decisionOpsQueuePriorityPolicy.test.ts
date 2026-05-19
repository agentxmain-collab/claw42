import { describe, expect, it } from "vitest";
import {
  buildDecisionOpsQueuePriorityPolicy,
  findResidentPriorityBlockers,
  getPmDecisionJobQueuePriority,
} from "@/lib/team/decisionOpsQueuePriorityPolicy";
import type { PmDecisionJobRecord } from "@/lib/watch/pmDecisionJobLedger";

const now = Date.parse("2026-05-19T12:00:00.000Z");

describe("decisionOpsQueuePriorityPolicy", () => {
  it("orders due cron work as market overview, hotspot, symbol, then batch", () => {
    const jobs = [
      job({ id: "job:batch", kind: "batch", candidate: null }),
      job({ id: "job:symbol", candidateType: "symbol", candidateKey: "symbol:BTC", symbol: "BTC" }),
      job({
        id: "job:hotspot",
        candidateType: "hotspot",
        candidateKey: "hotspot:utc:zh_CN:2026-05-19T12:market",
      }),
      job({
        id: "job:market",
        candidateType: "market_overview",
        candidateKey: "market_overview:utc:zh_CN:2026-05-19T12",
      }),
    ];

    const report = buildDecisionOpsQueuePriorityPolicy({ jobs, now });

    expect(report.pendingOrder.map((item) => item.jobId)).toEqual([
      "job:market",
      "job:hotspot",
      "job:symbol",
      "job:batch",
    ]);
    expect(report.status).toBe("prioritizing_resident");
    expect(report.residentPriorityActive).toBe(true);
    expect(report.priorityBands).toMatchObject({
      residentMarketOverview: 1,
      residentHotspot: 1,
      symbolOnce: 1,
      batch: 1,
    });
  });

  it("blocks lower-priority work while a higher-priority resident job is due", () => {
    const market = job({
      id: "job:market",
      candidateType: "market_overview",
      candidateKey: "market_overview:utc:zh_CN:2026-05-19T12",
    });
    const hotspot = job({
      id: "job:hotspot",
      candidateType: "hotspot",
      candidateKey: "hotspot:utc:zh_CN:2026-05-19T12:market",
    });
    const batch = job({ id: "job:batch", kind: "batch", candidate: null });

    expect(findResidentPriorityBlockers(hotspot, [market, hotspot, batch], now)).toMatchObject({
      blockingJobIds: ["job:market"],
      retryAfterSeconds: 30,
      reason: "higher_priority_resident_due",
    });
    expect(findResidentPriorityBlockers(batch, [market, hotspot, batch], now)).toMatchObject({
      blockingJobIds: ["job:market", "job:hotspot"],
      retryAfterSeconds: 30,
      reason: "higher_priority_resident_due",
    });
  });

  it("does not let exhausted resident failures block lower-priority work forever", () => {
    const exhaustedMarket = job({
      id: "job:market",
      status: "failed",
      attemptCount: 3,
      maxAttempts: 3,
      nextRunAt: null,
      candidateType: "market_overview",
      candidateKey: "market_overview:utc:zh_CN:2026-05-19T12",
    });
    const batch = job({ id: "job:batch", kind: "batch", candidate: null });

    expect(findResidentPriorityBlockers(batch, [exhaustedMarket, batch], now)).toBeNull();
  });

  it("defers behind an actively running resident job only until its lease expires", () => {
    const runningMarket = job({
      id: "job:market",
      status: "running",
      startedAt: "2026-05-19T11:45:00.000Z",
      nextRunAt: null,
      candidateType: "market_overview",
      candidateKey: "market_overview:utc:zh_CN:2026-05-19T12",
    });
    const batch = job({ id: "job:batch", kind: "batch", candidate: null });

    expect(
      findResidentPriorityBlockers(batch, [runningMarket, batch], now, {
        visibilityTimeoutSeconds: 30 * 60,
      }),
    ).toMatchObject({
      blockingJobIds: ["job:market"],
      retryAfterSeconds: 900,
      reason: "higher_priority_resident_due",
    });

    expect(
      findResidentPriorityBlockers(
        batch,
        [runningMarket, batch],
        Date.parse("2026-05-19T12:20:00.000Z"),
        {
          visibilityTimeoutSeconds: 30 * 60,
        },
      ),
    ).toBeNull();
  });

  it("exposes explicit priority metadata per job", () => {
    expect(
      getPmDecisionJobQueuePriority(
        job({
          candidateType: "market_overview",
          candidateKey: "market_overview:utc:zh_CN:2026-05-19T12",
        }),
      ),
    ).toMatchObject({
      rank: 10,
      band: "resident_market_overview",
      resident: true,
    });
  });
});

function job(
  overrides: Partial<PmDecisionJobRecord> & {
    candidateType?: "market_overview" | "hotspot" | "symbol";
    candidateKey?: string;
  } = {},
): PmDecisionJobRecord {
  const candidateType = overrides.candidateType;
  const candidateKey = overrides.candidateKey ?? (candidateType ? `${candidateType}:test` : null);
  return {
    id: overrides.id ?? `job:${candidateKey ?? "batch"}`,
    schemaVersion: 1,
    kind: overrides.kind ?? (candidateType ? "once" : "batch"),
    status: overrides.status ?? "queued",
    triggerSource: overrides.triggerSource ?? "cron",
    locale: overrides.locale ?? "zh_CN",
    idempotencyKey: overrides.idempotencyKey ?? `idem:${candidateKey ?? "batch"}`,
    candidate:
      "candidate" in overrides
        ? (overrides.candidate ?? null)
        : candidateType && candidateKey
          ? {
              candidateType,
              candidateKey,
              displayTitle: candidateType,
              executable: candidateType === "symbol",
              cadence: candidateType === "market_overview" ? "daily" : "intraday",
              score: candidateType === "market_overview" ? 100 : 90,
              reasons: [],
              ...(overrides.symbol ? { symbol: overrides.symbol } : {}),
            }
          : null,
    symbol: overrides.symbol ?? null,
    createdAt: overrides.createdAt ?? "2026-05-19T12:00:00.000Z",
    updatedAt: overrides.updatedAt ?? "2026-05-19T12:00:00.000Z",
    startedAt: overrides.startedAt ?? null,
    completedAt: overrides.completedAt ?? null,
    attemptCount: overrides.attemptCount ?? 0,
    maxAttempts: overrides.maxAttempts ?? 3,
    nextRunAt:
      "nextRunAt" in overrides ? (overrides.nextRunAt ?? null) : "2026-05-19T12:00:00.000Z",
    lastError: overrides.lastError ?? null,
    outputCount: overrides.outputCount ?? 0,
    decisionRecordIds: overrides.decisionRecordIds ?? [],
    auditEventCount: overrides.auditEventCount ?? 0,
  };
}
