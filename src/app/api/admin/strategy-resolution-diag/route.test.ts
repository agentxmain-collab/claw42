import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/admin/strategy-resolution-diag/route";
import type { CoinPoolPayload } from "@/modules/agent-watch/types";
import type { StrategyDecisionRecord } from "@/lib/team/strategyDecisionRecord";
import type { TradeDecision } from "@/lib/team/tradeDecision";

const getCoinPoolMock = vi.hoisted(() => vi.fn());
const readAllDecisionRecordsMock = vi.hoisted(() => vi.fn());
const readPublicCardIndexPageMock = vi.hoisted(() => vi.fn());
const readPmDecisionJobsMock = vi.hoisted(() => vi.fn());
const getCoinWFuturesInstrumentSetMock = vi.hoisted(() => vi.fn());
const checkLockMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/marketDataCache", () => ({
  getCoinPool: getCoinPoolMock,
}));

vi.mock("@/lib/team/decisionRecordStore", () => ({
  readAllDecisionRecords: readAllDecisionRecordsMock,
}));

vi.mock("@/lib/watch/publicCardIndex", () => ({
  readPublicCardIndexPage: readPublicCardIndexPageMock,
}));

vi.mock("@/lib/watch/pmDecisionJobLedger", () => ({
  readPmDecisionJobs: readPmDecisionJobsMock,
}));

vi.mock("@/lib/coinw/futuresInstruments", () => ({
  getCoinWFuturesInstrumentSet: getCoinWFuturesInstrumentSetMock,
}));

vi.mock("@/lib/storage/kv-lock", () => ({
  checkLock: checkLockMock,
}));

const now = Date.UTC(2026, 4, 28, 12, 0, 0);

describe("/api/admin/strategy-resolution-diag", () => {
  beforeEach(() => {
    vi.setSystemTime(now);
    vi.stubEnv("CRON_SECRET", "test-cron-secret");
    vi.stubEnv("OPS_HEALTH_SECRET", "");
    getCoinPoolMock.mockReset().mockResolvedValue(pool());
    readAllDecisionRecordsMock.mockReset().mockResolvedValue([
      record({
        id: "record-1",
        evaluationWindowEndsAt: new Date(now - 60_000).toISOString(),
      }),
    ]);
    readPublicCardIndexPageMock.mockReset().mockResolvedValue({
      entries: [],
      page: 1,
      pageSize: 100,
      totalCount: 0,
      hasMore: false,
      oldestAt: null,
    });
    readPmDecisionJobsMock.mockReset().mockResolvedValue([]);
    getCoinWFuturesInstrumentSetMock.mockReset().mockResolvedValue(new Map([["BTC", {}]]));
    checkLockMock.mockReset().mockResolvedValue({
      key: "cron:strategy-replay:trigger-now:zh_CN",
      locked: false,
      expiresAt: null,
    });
  });

  it("rejects unauthorized requests before reading stores", async () => {
    const response = await GET(
      new NextRequest("https://claw42.ai/api/admin/strategy-resolution-diag?locale=zh_CN"),
    );
    const payload = await response.json();

    expect(response.status).toBe(401);
    expect(payload).toEqual({ ok: false, error: "unauthorized" });
    expect(readAllDecisionRecordsMock).not.toHaveBeenCalled();
    expect(getCoinPoolMock).not.toHaveBeenCalled();
  });

  it("returns the five diagnostic sections for one locale with transparent readLimit", async () => {
    const response = await GET(
      new NextRequest(
        "https://claw42.ai/api/admin/strategy-resolution-diag?locale=zh_CN&readLimit=50",
        { headers: { authorization: "Bearer test-cron-secret" } },
      ),
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.locale).toBe("zh_CN");
    expect(payload.readLimit).toBe(50);
    expect(payload.poolEntryCounts).toEqual({ majors: 1, trending: 0, opportunity: 0 });
    expect(Object.keys(payload.buckets).sort()).toEqual(
      [
        "alreadyResolved",
        "openNoTradeDecision",
        "openStrategyNoEvaluationWindow",
        "openStrategyWindowNotElapsed",
        "openStrategyWindowElapsedMissingPrice",
        "openStrategyWindowElapsedInvalidPrice",
        "openStrategyWindowElapsedResolvableHitTp",
        "openStrategyWindowElapsedResolvableHitSl",
        "openStrategyWindowElapsedResolvableExpired",
        "openStrategyManualCloseExcluded",
      ].sort(),
    );
    expect(payload.rawRecordsLast1h).toBe(1);
    expect(payload.dryRun.baselinePoolOnly.resolvableCount).toBe(1);
    expect(payload.dryRun.coinwResolverAugmented.perSourceBreakdown).toEqual({
      pool: 1,
      coinwWhitelistedAssumed: 0,
    });
    expect(payload.lockStatus.strategyReplayTriggerNow).toMatchObject({ locked: false });
    expect(readAllDecisionRecordsMock).toHaveBeenCalledWith(50, "zh_CN");
    expect(readPublicCardIndexPageMock).toHaveBeenCalledWith("zh_CN", {
      page: 1,
      pageSize: 100,
    });
  });

  it("supports x-claw42-ops-secret and defaults to zh_CN plus en_US", async () => {
    const response = await GET(
      new NextRequest("https://claw42.ai/api/admin/strategy-resolution-diag", {
        headers: { "x-claw42-ops-secret": "test-cron-secret" },
      }),
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.locales).toEqual(["zh_CN", "en_US"]);
    expect(payload.results.zh_CN.buckets.openStrategyWindowElapsedResolvableHitTp).toBe(1);
    expect(payload.results.en_US.buckets.openStrategyWindowElapsedResolvableHitTp).toBe(1);
    expect(readAllDecisionRecordsMock).toHaveBeenCalledWith(500, "zh_CN");
    expect(readAllDecisionRecordsMock).toHaveBeenCalledWith(500, "en_US");
  });
});

function pool(): CoinPoolPayload {
  return {
    ts: now - 5_000,
    tickers: {
      BTC: { price: 112, change24h: 1 },
      ETH: { price: 94, change24h: -1 },
      SOL: { price: 101, change24h: 0 },
      USDT: { price: 1, change24h: 0 },
    },
    majors: [{ symbol: "BTC", price: 112, change24h: 1, category: "majors" }],
    trending: [],
    opportunity: [],
    source: "coinw-kline",
  };
}

function record(
  overrides: {
    id?: string;
    symbol?: string;
    evaluationWindowEndsAt?: string | null;
  } = {},
): StrategyDecisionRecord {
  const symbol = overrides.symbol ?? "BTC";
  const tradeDecision: TradeDecision = {
    id: `trade-${overrides.id ?? "record"}`,
    schemaVersion: 1,
    symbol,
    generatedBy: "pm",
    generatedAt: new Date(now - 10 * 60_000).toISOString(),
    direction: "long",
    entryType: "market",
    entryPrice: 100,
    entryRange: null,
    stopLoss: 95,
    takeProfit: [110, 115],
    positionSizing: 0.05,
    timeHorizon: "intraday",
    rating: 4,
    confidence: 0.75,
    evidenceIds: [],
    riskNote: "test risk",
    invalidatesIf: "test invalidation",
    promptVersion: "test",
    modelProvider: "stub",
    severity: "high",
  };

  return {
    id: overrides.id ?? "record-1",
    schemaVersion: 1,
    recordSource: "paper",
    symbol,
    locale: "zh_CN",
    decisionOwnerId: "pm",
    contributorIds: ["pm"],
    analystInputs: [],
    sourceThreadId: null,
    tradeDecision,
    createdAt: new Date(now - 10 * 60_000).toISOString(),
    evaluationWindowEndsAt:
      overrides.evaluationWindowEndsAt ?? new Date(now + 60_000).toISOString(),
    resolvedAt: null,
    resolvedOutcome: null,
    promptVersion: "test",
    modelProvider: "stub",
  };
}
