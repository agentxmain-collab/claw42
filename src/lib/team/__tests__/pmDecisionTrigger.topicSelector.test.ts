import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  triggerPmDecisionPipelineBatch,
  triggerPmDecisionPipelineOnce,
} from "@/lib/team/pmDecisionTrigger";
import type { NewsEvidence } from "@/lib/news/newsEvidence";
import type { PmDecisionPipelineInput } from "@/lib/team/pmDecisionPipeline";
import type { CoinPoolPayload } from "@/modules/agent-watch/types";
import type { NewsItem } from "@/lib/types";

const runPmDecisionPipelineMock = vi.hoisted(() => vi.fn());
const saveNewsEvidenceMock = vi.hoisted(() => vi.fn());
const tryAcquireLockMock = vi.hoisted(() => vi.fn());
const getWatchHistoryMock = vi.hoisted(() => vi.fn());
const filterPublicTimelineEventsMock = vi.hoisted(() => vi.fn());
const readAllDecisionRecordsMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/team/pmDecisionPipeline", () => ({
  runPmDecisionPipeline: runPmDecisionPipelineMock,
}));

vi.mock("@/lib/news/newsEvidenceStore", () => ({
  saveNewsEvidence: saveNewsEvidenceMock,
}));

vi.mock("@/lib/storage/kv-lock", () => ({
  tryAcquireLock: tryAcquireLockMock,
}));

vi.mock("@/lib/watchHistoryStore", () => ({
  getWatchHistory: getWatchHistoryMock,
}));

vi.mock("@/lib/watch/publicTimelineProjection", () => ({
  filterPublicTimelineEvents: filterPublicTimelineEventsMock,
}));

vi.mock("@/lib/team/decisionRecordStore", () => ({
  readAllDecisionRecords: readAllDecisionRecordsMock,
}));

const now = Date.UTC(2026, 4, 13, 20, 0, 0);

function pool(): CoinPoolPayload {
  return {
    ts: now,
    tickers: {
      BTC: { price: 101000, change24h: 3.3 },
      ETH: { price: 4200, change24h: -5.4 },
      SOL: { price: 220, change24h: 3.2 },
      USDT: { price: 1, change24h: 0.01 },
    },
    majors: [
      { symbol: "BTC", price: 101000, change24h: 3.3, category: "majors" },
      { symbol: "ETH", price: 4200, change24h: -5.4, category: "majors" },
    ],
    trending: [{ symbol: "SOL", price: 220, change24h: 3.2, category: "trending" }],
    opportunity: [],
    source: "coinw-kline",
  };
}

function newsItem(overrides: Partial<NewsItem> = {}): NewsItem {
  return {
    id: "news-eth",
    title: "ETH ETF flows accelerate",
    url: "https://example.com/eth-etf",
    source: "CoinDesk",
    currencies: ["ETH"],
    sentiment: "bullish",
    publishedAt: now - 10 * 60_000,
    votes: {
      positive: 5,
      negative: 0,
      important: 6,
    },
    ...overrides,
  };
}

describe("triggerPmDecisionPipelineOnce topic selection", () => {
  beforeEach(() => {
    runPmDecisionPipelineMock.mockReset();
    saveNewsEvidenceMock.mockReset();
    tryAcquireLockMock.mockReset();
    tryAcquireLockMock.mockResolvedValue({
      key: "watch:pm-decision:zh_CN:ETH",
      token: "test-token",
      acquiredAt: now,
    });
    getWatchHistoryMock.mockResolvedValue({
      entries: [],
      hasMore: false,
      oldestTs: null,
    });
    filterPublicTimelineEventsMock.mockReturnValue([]);
    readAllDecisionRecordsMock.mockReset();
    readAllDecisionRecordsMock.mockResolvedValue([]);
    saveNewsEvidenceMock.mockResolvedValue(undefined);
    runPmDecisionPipelineMock.mockResolvedValue({
      record: {},
      publicTimelineEntry: {},
      tradeDecision: null,
    });
  });

  it("runs the PM pipeline for the top-ranked topic and includes selection context", async () => {
    const auditEvents: unknown[] = [];

    await triggerPmDecisionPipelineOnce({
      triggerSource: "user_visit_trigger",
      pool: pool(),
      newsItems: [newsItem()],
      locale: "zh_CN",
      now,
      onAudit: (event) => auditEvents.push(event),
    });

    expect(runPmDecisionPipelineMock).toHaveBeenCalledTimes(1);
    const input = runPmDecisionPipelineMock.mock.calls[0]?.[0] as PmDecisionPipelineInput;
    expect(input.recentMarketSignals.map((signal) => signal.symbol)).toEqual(["ETH"]);
    expect(input.recentNewsEvidence.map((evidence) => evidence.id)).toEqual(
      expect.arrayContaining(["topic_selection:ETH:1778702400000"]),
    );
    const selectionEvidence = input.recentNewsEvidence.find((evidence: NewsEvidence) =>
      evidence.id.startsWith("topic_selection:ETH:"),
    );
    expect(selectionEvidence?.summary).toContain("本轮优先分析 ETH");
    expect(selectionEvidence?.summary).toContain("新闻冲击、市场信号是主因");
    expect(selectionEvidence?.summary).toContain("24h -5.40%");
    expect(auditEvents).toEqual([
      expect.objectContaining({
        type: "candidate_considered",
        symbol: "ETH",
        hasTrigger: true,
        triggerSource: "user_visit_trigger",
        scoreBreakdown: expect.objectContaining({
          news: 60,
          market: 40,
          pool: 1,
        }),
      }),
      expect.objectContaining({
        type: "candidate_generated",
        symbol: "ETH",
      }),
    ]);
  });

  it("normalizes pool symbols before scoping market signals for the PM input", async () => {
    const dirtyPool = pool();
    dirtyPool.majors = [dirtyPool.majors[0], { ...dirtyPool.majors[1], symbol: " $$eth " }];

    await triggerPmDecisionPipelineOnce({
      triggerSource: "user_visit_trigger",
      pool: dirtyPool,
      newsItems: [newsItem()],
      locale: "zh_CN",
      now,
    });

    expect(runPmDecisionPipelineMock).toHaveBeenCalledTimes(1);
    const input = runPmDecisionPipelineMock.mock.calls[0]?.[0] as PmDecisionPipelineInput;
    expect(input.recentMarketSignals.map((signal) => signal.symbol)).toEqual(["ETH"]);
    expect(input.recentMarketSignals[0]?.payload.description).toBe("ETH 24h -5.40%");
    const selectionEvidence = input.recentNewsEvidence.find((evidence: NewsEvidence) =>
      evidence.id.startsWith("topic_selection:ETH:"),
    );
    expect(selectionEvidence?.summary).toContain("市场信号：ETH 24h -5.40%");
    expect(selectionEvidence?.summary).not.toContain("$eth");
    expect(selectionEvidence?.summary).not.toContain("$$");
  });

  it("continues topic selection when evidence pre-save fails", async () => {
    saveNewsEvidenceMock.mockRejectedValue(new Error("evidence pre-save unavailable"));

    await triggerPmDecisionPipelineOnce({
      triggerSource: "cron",
      pool: pool(),
      newsItems: [newsItem()],
      locale: "zh_CN",
      now,
    });

    expect(runPmDecisionPipelineMock).toHaveBeenCalledTimes(1);
    const input = runPmDecisionPipelineMock.mock.calls[0]?.[0] as PmDecisionPipelineInput;
    expect(input.recentNewsEvidence.map((evidence) => evidence.symbol)).toContainEqual(["ETH"]);
  });

  it("adds recent decision memory to the selection evidence sent into the PM prompt", async () => {
    readAllDecisionRecordsMock.mockResolvedValue([
      {
        id: "pm:ETH:memory",
        schemaVersion: 1,
        recordSource: "live",
        symbol: "ETH",
        locale: "zh_CN",
        decisionOwnerId: "pm",
        contributorIds: ["pm"],
        analystInputs: [],
        sourceThreadId: null,
        tradeDecision: null,
        createdAt: new Date(now - 90 * 60_000).toISOString(),
        evaluationWindowEndsAt: null,
        resolvedAt: new Date(now - 30 * 60_000).toISOString(),
        resolvedOutcome: "hit_sl",
        promptVersion: "test",
        modelProvider: "test",
        legacyFactionId: null,
      },
    ]);

    await triggerPmDecisionPipelineOnce({
      triggerSource: "cron",
      pool: pool(),
      newsItems: [newsItem()],
      locale: "zh_CN",
      now,
    });

    const input = runPmDecisionPipelineMock.mock.calls[0]?.[0] as PmDecisionPipelineInput;
    const selectionEvidence = input.recentNewsEvidence.find((evidence: NewsEvidence) =>
      evidence.id.startsWith("topic_selection:ETH:"),
    );
    expect(selectionEvidence?.summary).toContain("复盘记忆");
    expect(selectionEvidence?.summary).toContain("上一轮触发止损");
  });

  it("skips a recently published PM decision symbol before trying the next ranked candidate", async () => {
    filterPublicTimelineEventsMock.mockReturnValue([
      {
        id: "event-eth",
        ts: now - 20 * 60_000,
        visibility: "public",
        importance: "high",
        sourceTrigger: "pm_decision",
        evidenceIds: [],
        locale: "zh_CN",
        payload: {
          kind: "pm_decision",
          recordId: "record-eth",
          symbol: "ETH",
          tradeDecision: null,
          rationaleByMember: {},
        },
      },
    ]);

    await triggerPmDecisionPipelineOnce({
      triggerSource: "user_visit_trigger",
      pool: pool(),
      newsItems: [newsItem()],
      locale: "zh_CN",
      now,
    });

    expect(tryAcquireLockMock).toHaveBeenCalledWith("watch:pm-decision:zh_CN:SOL", {
      ttlMs: 170 * 60_000,
      waitMs: 0,
    });
    const input = runPmDecisionPipelineMock.mock.calls[0]?.[0] as PmDecisionPipelineInput;
    expect(input.recentMarketSignals.map((signal) => signal.symbol)).toEqual(["SOL"]);
    expect(input.recentNewsEvidence.map((evidence) => evidence.symbol)).toEqual([["SOL"]]);
  });

  it("emits audit events for candidates skipped by trigger and lock state", async () => {
    const auditEvents: unknown[] = [];
    tryAcquireLockMock.mockResolvedValue(null);
    const poolWithQuietCandidate = {
      ...pool(),
      opportunity: [{ symbol: "XRP", price: 2.1, change24h: 0.2, category: "opportunity" }],
    } satisfies CoinPoolPayload;

    await triggerPmDecisionPipelineOnce({
      triggerSource: "cron",
      pool: poolWithQuietCandidate,
      newsItems: [],
      locale: "zh_CN",
      now,
      onAudit: (event) => auditEvents.push(event),
    });

    expect(runPmDecisionPipelineMock).not.toHaveBeenCalled();
    expect(auditEvents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "candidate_considered",
          symbol: "BTC",
          hasTrigger: true,
        }),
        expect.objectContaining({
          type: "candidate_skipped",
          symbol: "BTC",
          reason: "locked",
        }),
        expect.objectContaining({
          type: "candidate_skipped",
          symbol: "XRP",
          reason: "no_trigger",
        }),
      ]),
    );
  });

  it("does not let symbol-less market news trigger non-BTC candidates after BTC is locked", async () => {
    const auditEvents: unknown[] = [];
    tryAcquireLockMock.mockResolvedValue(null);
    const quietPool = {
      ...pool(),
      tickers: {
        BTC: { price: 101000, change24h: 0.2 },
        ETH: { price: 4200, change24h: 0.3 },
        SOL: { price: 220, change24h: 0.4 },
        USDT: { price: 1, change24h: 0.01 },
      },
      majors: [
        { symbol: "BTC", price: 101000, change24h: 0.2, category: "majors" },
        { symbol: "ETH", price: 4200, change24h: 0.3, category: "majors" },
      ],
      trending: [{ symbol: "SOL", price: 220, change24h: 0.4, category: "trending" }],
    } satisfies CoinPoolPayload;

    await triggerPmDecisionPipelineOnce({
      triggerSource: "cron",
      pool: quietPool,
      newsItems: [
        newsItem({
          id: "news-market",
          title: "Crypto market liquidity stress rises",
          currencies: [],
          votes: {
            positive: 0,
            negative: 4,
            important: 7,
          },
        }),
      ],
      locale: "zh_CN",
      now,
      onAudit: (event) => auditEvents.push(event),
    });

    expect(runPmDecisionPipelineMock).not.toHaveBeenCalled();
    expect(auditEvents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "candidate_considered",
          symbol: "BTC",
          hasTrigger: true,
        }),
        expect.objectContaining({
          type: "candidate_skipped",
          symbol: "BTC",
          reason: "locked",
        }),
        expect.objectContaining({
          type: "candidate_considered",
          symbol: "ETH",
          hasTrigger: false,
        }),
        expect.objectContaining({
          type: "candidate_skipped",
          symbol: "ETH",
          reason: "no_trigger",
        }),
        expect.objectContaining({
          type: "candidate_considered",
          symbol: "SOL",
          hasTrigger: false,
        }),
        expect.objectContaining({
          type: "candidate_skipped",
          symbol: "SOL",
          reason: "no_trigger",
        }),
      ]),
    );
  });

  it("lets scheduled batch processing reach opportunity symbols beyond the first six pool entries", async () => {
    const expandedPool = {
      ...pool(),
      tickers: {
        BTC: { price: 101000, change24h: 0.2 },
        ETH: { price: 4200, change24h: 0.3 },
        SOL: { price: 220, change24h: 0.4 },
        USDT: { price: 1, change24h: 0.01 },
      },
      majors: [
        { symbol: "BTC", price: 101000, change24h: 0.2, category: "majors" },
        { symbol: "ETH", price: 4200, change24h: 0.3, category: "majors" },
        { symbol: "SOL", price: 220, change24h: 0.4, category: "majors" },
      ],
      trending: [
        { symbol: "TAO", price: 520, change24h: 0.5, category: "trending" },
        { symbol: "HYPE", price: 34, change24h: 0.6, category: "trending" },
        { symbol: "ENA", price: 0.8, change24h: 0.7, category: "trending" },
      ],
      opportunity: [{ symbol: "BLEND", price: 0.12, change24h: 18, category: "opportunity" }],
    } satisfies CoinPoolPayload;

    const outputs = await triggerPmDecisionPipelineBatch({
      triggerSource: "cron",
      pool: expandedPool,
      newsItems: [],
      locale: "zh_CN",
      now,
    });

    expect(outputs).toHaveLength(1);
    expect(runPmDecisionPipelineMock).toHaveBeenCalledTimes(1);
    const input = runPmDecisionPipelineMock.mock.calls[0]?.[0] as PmDecisionPipelineInput;
    expect(input.recentMarketSignals.map((signal) => signal.symbol)).toEqual(["BLEND"]);
  });

  it("emits an audit event when recent-topic suppression leaves no candidates", async () => {
    filterPublicTimelineEventsMock.mockReturnValue([
      {
        id: "event-btc",
        ts: now - 20 * 60_000,
        visibility: "public",
        importance: "high",
        sourceTrigger: "pm_decision",
        evidenceIds: [],
        locale: "zh_CN",
        payload: {
          kind: "pm_decision",
          recordId: "record-btc",
          symbol: "BTC",
          tradeDecision: null,
          rationaleByMember: {},
        },
      },
      {
        id: "event-eth",
        ts: now - 20 * 60_000,
        visibility: "public",
        importance: "high",
        sourceTrigger: "pm_decision",
        evidenceIds: [],
        locale: "zh_CN",
        payload: {
          kind: "pm_decision",
          recordId: "record-eth",
          symbol: "ETH",
          tradeDecision: null,
          rationaleByMember: {},
        },
      },
      {
        id: "event-sol",
        ts: now - 20 * 60_000,
        visibility: "public",
        importance: "high",
        sourceTrigger: "pm_decision",
        evidenceIds: [],
        locale: "zh_CN",
        payload: {
          kind: "pm_decision",
          recordId: "record-sol",
          symbol: "SOL",
          tradeDecision: null,
          rationaleByMember: {},
        },
      },
    ]);
    const auditEvents: unknown[] = [];

    const result = await triggerPmDecisionPipelineOnce({
      triggerSource: "user_visit_trigger",
      pool: pool(),
      newsItems: [newsItem()],
      locale: "zh_CN",
      now,
      onAudit: (event) => auditEvents.push(event),
    });

    expect(result).toBeNull();
    expect(runPmDecisionPipelineMock).not.toHaveBeenCalled();
    expect(auditEvents).toEqual([
      expect.objectContaining({
        type: "selection_skipped",
        reason: "no_candidates",
        candidateCount: 0,
      }),
    ]);
  });
});
