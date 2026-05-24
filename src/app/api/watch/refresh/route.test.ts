import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { StrategyDecisionRecord } from "@/lib/team/strategyDecisionRecord";
import { WATCH_REFRESH_STATUSES } from "@/lib/watch/refreshStatus";
import { maxDuration, POST } from "./route";

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
const enqueuePmDecisionJobMock = vi.hoisted(() => vi.fn());
const publishPmDecisionJobToQueueMock = vi.hoisted(() => vi.fn());
const runPmDecisionJobMock = vi.hoisted(() => vi.fn());
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
}));

vi.mock("@/lib/team/topicSelector", () => ({
  selectPmDecisionTopics: selectPmDecisionTopicsMock,
}));

vi.mock("@/lib/watch/pmDecisionJobLedger", () => ({
  enqueuePmDecisionJob: enqueuePmDecisionJobMock,
}));

vi.mock("@/lib/team/pmDecisionJobQueue", () => ({
  publishPmDecisionJobToQueue: publishPmDecisionJobToQueueMock,
}));

vi.mock("@/lib/team/pmDecisionJobRunner", () => ({
  runPmDecisionJob: runPmDecisionJobMock,
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

function autoSymbolRequest() {
  return new Request(
    `https://claw42.ai/api/watch/refresh?candidateType=symbol&locale=zh_CN&testNow=${now}`,
    {
      method: "POST",
      headers: { "x-forwarded-for": "203.0.113.10" },
    },
  );
}

function record(createdAt: string, symbol = "BTC"): StrategyDecisionRecord {
  return {
    id: `record-${symbol.toLowerCase()}`,
    schemaVersion: 2,
    recordSource: "paper",
    symbol,
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
  it("declares enough runtime for waitUntil fallback PM generation", () => {
    expect(maxDuration).toBeGreaterThanOrEqual(300);
  });

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
    enqueuePmDecisionJobMock.mockReset();
    enqueuePmDecisionJobMock.mockImplementation(async (input) => ({
      id: "pm-job:test",
      schemaVersion: 1,
      kind: input.kind,
      status: "queued",
      triggerSource: input.triggerSource,
      locale: input.locale,
      idempotencyKey: "test",
      candidate: input.candidate ?? null,
      symbol: input.symbol ?? null,
      createdAt: new Date(now).toISOString(),
      updatedAt: new Date(now).toISOString(),
      startedAt: null,
      completedAt: null,
      attemptCount: 0,
      maxAttempts: 3,
      nextRunAt: new Date(now).toISOString(),
      lastError: null,
      outputCount: 0,
      decisionRecordIds: [],
      auditEventCount: 0,
    }));
    publishPmDecisionJobToQueueMock.mockReset();
    publishPmDecisionJobToQueueMock.mockResolvedValue({ mode: "disabled" });
    runPmDecisionJobMock.mockReset();
    runPmDecisionJobMock.mockResolvedValue({
      job: { id: "pm-job:test", status: "succeeded" },
      outputs: [],
      auditEvents: [],
    });
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
    expect(enqueuePmDecisionJobMock).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "once",
        triggerSource: "user_visit_trigger",
        locale: "zh_CN",
        symbol: "BTC",
      }),
    );
    expect(runPmDecisionJobMock).toHaveBeenCalledWith(
      expect.objectContaining({ id: "pm-job:test" }),
      expect.objectContaining({
        partialStageUpdates: true,
      }),
    );
    expect(releaseLockMock).toHaveBeenCalledWith(
      expect.objectContaining({ key: "watch:refresh:in-flight:zh_CN:BTC" }),
    );
  });

  it("publishes refresh jobs to Vercel Queue without directly running the PM pipeline", async () => {
    publishPmDecisionJobToQueueMock.mockResolvedValueOnce({
      mode: "queue",
      messageId: "msg_watch_refresh",
    });

    const response = await POST(request());
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      status: "stale",
      refreshStarted: true,
      symbol: "BTC",
    });
    expect(waitUntilMock).toHaveBeenCalledOnce();
    await waitUntilMock.mock.calls[0][0];
    expect(publishPmDecisionJobToQueueMock).toHaveBeenCalledWith(
      expect.objectContaining({ id: "pm-job:test" }),
      expect.objectContaining({ now }),
    );
    expect(runPmDecisionJobMock).not.toHaveBeenCalled();
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
      candidateKey: "market_overview:utc:zh_CN:2026-05-15T12",
      displayTitle: "今日大盘综述",
    });
    expect(callOrder.slice(0, 5)).toEqual([
      "rate",
      "check:watch:refresh:in-flight:zh_CN:market_overview:utc:zh_CN:2026-05-15T12",
      "freshness:records",
      "check:watch:refresh:cooldown:zh_CN",
      "check:watch:pm-decision:zh_CN:market_overview:utc:zh_CN:2026-05-15T12",
    ]);
    expect(waitUntilMock).toHaveBeenCalledOnce();
    await waitUntilMock.mock.calls[0][0];
    expect(enqueuePmDecisionJobMock).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "once",
        triggerSource: "user_visit_trigger",
        locale: "zh_CN",
        candidate: expect.objectContaining({
          candidateType: "market_overview",
          executable: false,
        }),
      }),
    );
  });

  it("supports server-selected priority symbol refresh when no symbol card exists yet", async () => {
    const response = await POST(autoSymbolRequest());
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      status: "stale",
      refreshStarted: true,
      symbol: "SYMBOL",
      candidateType: "symbol",
      candidateKey: "symbol:auto",
    });
    expect(callOrder.slice(0, 5)).toEqual([
      "rate",
      "check:watch:refresh:in-flight:zh_CN:symbol:auto",
      "freshness:records",
      "check:watch:refresh:cooldown:zh_CN",
      "check:watch:pm-decision:zh_CN:symbol:auto",
    ]);
    expect(waitUntilMock).toHaveBeenCalledOnce();
    await waitUntilMock.mock.calls[0][0];
    const jobArg = enqueuePmDecisionJobMock.mock.calls[0][0];
    expect(jobArg).toMatchObject({
      kind: "once",
      triggerSource: "user_visit_trigger",
      locale: "zh_CN",
    });
    expect(jobArg.symbol).toBeUndefined();
    expect(jobArg.candidate).toBeUndefined();
  });

  it("does not let resident records satisfy auto symbol freshness", async () => {
    readAllDecisionRecordsMock.mockImplementation(async () => {
      callOrder.push("freshness:records");
      return [
        {
          ...record(new Date(now - 5 * 60_000).toISOString()),
          id: "record-market",
          symbol: "MARKET",
          candidate: {
            candidateType: "market_overview",
            candidateKey: "market_overview:zh_CN:2026-05-15",
            displayTitle: "今日大盘综述",
            executable: false,
            cadence: "daily",
            score: 100,
            reasons: [],
          },
        },
      ];
    });

    const response = await POST(autoSymbolRequest());
    const payload = await response.json();

    expect(payload.status).toBe("stale");
    expect(payload.refreshStarted).toBe(true);
    expect(waitUntilMock).toHaveBeenCalledOnce();
  });

  it("does not treat one recent symbol as sufficient auto symbol coverage", async () => {
    readAllDecisionRecordsMock.mockImplementation(async () => {
      callOrder.push("freshness:records");
      return [record(new Date(now - 5 * 60_000).toISOString(), "HYPE")];
    });

    const response = await POST(autoSymbolRequest());
    const payload = await response.json();

    expect(payload).toMatchObject({
      status: "stale",
      refreshStarted: true,
      symbol: "SYMBOL",
    });
    expect(waitUntilMock).toHaveBeenCalledOnce();
  });

  it("allows automatic major rotation to run without an alert-level trigger", async () => {
    selectPmDecisionTopicsMock.mockReturnValueOnce([
      {
        symbol: "BTC",
        reasons: [{ kind: "pool", score: 1 }],
      },
    ]);

    const response = await POST(autoSymbolRequest());
    const payload = await response.json();

    expect(payload).toMatchObject({
      status: "stale",
      refreshStarted: true,
      symbol: "SYMBOL",
    });
    expect(waitUntilMock).toHaveBeenCalledOnce();
  });
});
