import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { StrategyDecisionRecord } from "@/lib/team/strategyDecisionRecord";
import { WATCH_REFRESH_STATUSES } from "@/lib/watch/refreshStatus";
import { POST } from "./route";

const waitUntilMock = vi.hoisted(() => vi.fn());
const checkRateLimitMock = vi.hoisted(() => vi.fn());
const checkLockMock = vi.hoisted(() => vi.fn());
const tryAcquireLockMock = vi.hoisted(() => vi.fn());
const releaseLockMock = vi.hoisted(() => vi.fn());
const readAllDecisionRecordsMock = vi.hoisted(() => vi.fn());
const getWatchHistoryMock = vi.hoisted(() => vi.fn());
const filterPublicTimelineEventsMock = vi.hoisted(() => vi.fn());
const fetchNewsWithChainMock = vi.hoisted(() => vi.fn());
const normalizeNewsItemMock = vi.hoisted(() => vi.fn());
const getCoinPoolMock = vi.hoisted(() => vi.fn());
const marketSignalsFromPoolMock = vi.hoisted(() => vi.fn());
const triggerPmDecisionPipelineOnceMock = vi.hoisted(() => vi.fn());
const selectPmDecisionTopicsMock = vi.hoisted(() => vi.fn());
const callOrder = vi.hoisted(() => [] as string[]);

vi.mock("@vercel/functions", () => ({
  waitUntil: waitUntilMock,
}));

vi.mock("@/lib/storage/kv-rate-limiter", () => ({
  checkRateLimit: checkRateLimitMock,
}));

vi.mock("@/lib/storage/kv-lock", () => ({
  checkLock: checkLockMock,
  tryAcquireLock: tryAcquireLockMock,
  releaseLock: releaseLockMock,
}));

vi.mock("@/lib/team/decisionRecordStore", () => ({
  readAllDecisionRecords: readAllDecisionRecordsMock,
}));

vi.mock("@/lib/watchHistoryStore", () => ({
  getWatchHistory: getWatchHistoryMock,
}));

vi.mock("@/lib/watch/publicTimelineProjection", () => ({
  filterPublicTimelineEvents: filterPublicTimelineEventsMock,
}));

vi.mock("@/lib/news/sourceChain", () => ({
  fetchNewsWithChain: fetchNewsWithChainMock,
}));

vi.mock("@/lib/news/normalizer", () => ({
  normalizeNewsItem: normalizeNewsItemMock,
}));

vi.mock("@/lib/marketDataCache", () => ({
  getCoinPool: getCoinPoolMock,
}));

vi.mock("@/lib/team/pmDecisionTrigger", () => ({
  marketSignalsFromPool: marketSignalsFromPoolMock,
  triggerPmDecisionPipelineOnce: triggerPmDecisionPipelineOnceMock,
}));

vi.mock("@/lib/team/topicSelector", () => ({
  selectPmDecisionTopics: selectPmDecisionTopicsMock,
}));

const now = Date.UTC(2026, 4, 15, 12, 0, 0);

function request(symbol = "BTC") {
  return new Request(`https://claw42.ai/api/watch/refresh?symbol=${symbol}&locale=zh_CN`, {
    method: "POST",
    headers: { "x-forwarded-for": "203.0.113.10" },
  });
}

function residentRequest() {
  return new Request(
    `https://claw42.ai/api/watch/refresh?candidateType=market_overview&locale=zh_CN&testNow=${now}`,
    {
      method: "POST",
      headers: { "x-forwarded-for": "203.0.113.10" },
    },
  );
}

function record(createdAt: string): StrategyDecisionRecord {
  return {
    id: "record-btc",
    schemaVersion: 2,
    recordSource: "paper",
    symbol: "BTC",
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

describe("/api/watch/refresh", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
    callOrder.length = 0;
    waitUntilMock.mockReset();
    waitUntilMock.mockImplementation((promise: Promise<unknown>) => promise);
    checkRateLimitMock.mockReset();
    checkRateLimitMock.mockImplementation(async () => {
      callOrder.push("rate");
      return { allowed: true, remaining: 5, resetAt: now + 60_000 };
    });
    checkLockMock.mockReset();
    checkLockMock.mockImplementation(async (key: string) => {
      callOrder.push(`check:${key}`);
      return { key, locked: false, expiresAt: null };
    });
    tryAcquireLockMock.mockReset();
    tryAcquireLockMock.mockImplementation(async (key: string) => {
      callOrder.push(`acquire:${key}`);
      return { key, token: `${key}:token`, acquiredAt: now };
    });
    releaseLockMock.mockReset();
    releaseLockMock.mockResolvedValue(true);
    readAllDecisionRecordsMock.mockReset();
    readAllDecisionRecordsMock.mockImplementation(async () => {
      callOrder.push("freshness:records");
      return [];
    });
    getWatchHistoryMock.mockReset();
    getWatchHistoryMock.mockResolvedValue({ entries: [] });
    filterPublicTimelineEventsMock.mockReset();
    filterPublicTimelineEventsMock.mockReturnValue([]);
    fetchNewsWithChainMock.mockReset();
    fetchNewsWithChainMock.mockResolvedValue({ items: [], servedBy: "mock", fellBackFrom: [] });
    normalizeNewsItemMock.mockReset();
    normalizeNewsItemMock.mockImplementation(async (item) => item);
    getCoinPoolMock.mockReset();
    getCoinPoolMock.mockResolvedValue({ majors: [], trending: [], opportunity: [] });
    marketSignalsFromPoolMock.mockReset();
    marketSignalsFromPoolMock.mockReturnValue([]);
    triggerPmDecisionPipelineOnceMock.mockReset();
    triggerPmDecisionPipelineOnceMock.mockResolvedValue(null);
    selectPmDecisionTopicsMock.mockReset();
    selectPmDecisionTopicsMock.mockReturnValue([
      {
        symbol: "BTC",
        reasons: [{ kind: "market", score: 40 }],
      },
    ]);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("exports the five public refresh statuses", () => {
    expect(WATCH_REFRESH_STATUSES).toEqual([
      "cached",
      "stale",
      "refreshing",
      "locked",
      "no_signal",
    ]);
  });

  it("follows rate, in-flight, freshness, cooldown, per-symbol lock ordering before scheduling", async () => {
    const response = await POST(request());
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      status: "stale",
      refreshStarted: true,
      symbol: "BTC",
    });
    expect(callOrder.slice(0, 5)).toEqual([
      "rate",
      "check:watch:refresh:in-flight:zh_CN:BTC",
      "freshness:records",
      "check:watch:refresh:cooldown:zh_CN",
      "check:watch:pm-decision:zh_CN:BTC",
    ]);
    expect(callOrder).toContain("acquire:watch:refresh:cooldown:zh_CN");
    expect(callOrder).toContain("acquire:watch:refresh:in-flight:zh_CN:BTC");
    expect(waitUntilMock).toHaveBeenCalledOnce();
    await waitUntilMock.mock.calls[0][0];
    expect(triggerPmDecisionPipelineOnceMock).toHaveBeenCalledWith(
      expect.objectContaining({
        triggerSource: "user_visit_trigger",
        locale: "zh_CN",
        symbol: "BTC",
      }),
    );
    expect(releaseLockMock).toHaveBeenCalledWith(
      expect.objectContaining({ key: "watch:refresh:in-flight:zh_CN:BTC" }),
    );
  });

  it("returns cached when a strategy record is fresher than 15 minutes", async () => {
    readAllDecisionRecordsMock.mockImplementation(async () => {
      callOrder.push("freshness:records");
      return [record(new Date(now - 5 * 60_000).toISOString())];
    });

    const response = await POST(request());
    const payload = await response.json();

    expect(payload.status).toBe("cached");
    expect(payload.refreshSource).toBe("records");
    expect(checkLockMock).toHaveBeenCalledTimes(1);
    expect(waitUntilMock).not.toHaveBeenCalled();
  });

  it("returns refreshing when the in-flight lock is already held", async () => {
    checkLockMock.mockImplementationOnce(async (key: string) => {
      callOrder.push(`check:${key}`);
      return { key, locked: true, expiresAt: now + 60_000 };
    });

    const response = await POST(request());
    const payload = await response.json();

    expect(payload).toMatchObject({
      status: "refreshing",
      refreshStarted: false,
      nextAllowedAt: new Date(now + 60_000).toISOString(),
    });
    expect(tryAcquireLockMock).not.toHaveBeenCalled();
    expect(waitUntilMock).not.toHaveBeenCalled();
  });

  it("returns no_signal without acquiring locks when the current pool has no trigger", async () => {
    selectPmDecisionTopicsMock.mockReturnValueOnce([
      {
        symbol: "BTC",
        reasons: [{ kind: "market", score: 5 }],
      },
    ]);

    const response = await POST(request());
    const payload = await response.json();

    expect(payload.status).toBe("no_signal");
    expect(tryAcquireLockMock).not.toHaveBeenCalled();
    expect(waitUntilMock).not.toHaveBeenCalled();
  });

  it("supports market overview refresh with candidate cadence identity", async () => {
    const response = await POST(residentRequest());
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      status: "stale",
      refreshStarted: true,
      symbol: "MARKET",
      candidateType: "market_overview",
      candidateKey: "market_overview:zh_CN:2026-05-15",
      displayTitle: "今日大盘综述",
    });
    expect(callOrder.slice(0, 5)).toEqual([
      "rate",
      "check:watch:refresh:in-flight:zh_CN:market_overview:zh_CN:2026-05-15",
      "freshness:records",
      "check:watch:refresh:cooldown:zh_CN",
      "check:watch:pm-decision:zh_CN:market_overview:zh_CN:2026-05-15",
    ]);
    expect(waitUntilMock).toHaveBeenCalledOnce();
    await waitUntilMock.mock.calls[0][0];
    expect(triggerPmDecisionPipelineOnceMock).toHaveBeenCalledWith(
      expect.objectContaining({
        triggerSource: "user_visit_trigger",
        locale: "zh_CN",
        candidate: expect.objectContaining({
          candidateType: "market_overview",
          executable: false,
        }),
      }),
    );
  });
});
