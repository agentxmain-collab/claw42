import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  triggerPmDecisionPipelineBatch,
  triggerPmDecisionPipelineOnce,
} from "@/lib/team/pmDecisionTrigger";
import type { NewsEvidence } from "@/lib/news/newsEvidence";
import type { PmDecisionPipelineInput } from "@/lib/team/pmDecisionPipeline";
import type { CoinPoolPayload } from "@/modules/agent-watch/types";
import type { NewsItem } from "@/lib/types";
import { marketOverviewCandidate } from "@/lib/watch/residentCandidate";

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
    expect(selectionEvidence?.summary).toContain("新闻热度、市场信号是主因");
    expect(selectionEvidence?.summary).toContain("24h -5.40%");
    expect(selectionEvidence?.summary).not.toContain("依据：");
    expect(auditEvents).toEqual([
      expect.objectContaining({
        type: "candidate_considered",
        symbol: "ETH",
        hasTrigger: true,
        triggerSource: "user_visit_trigger",
        scoreBreakdown: expect.objectContaining({
          news: 60,
          market: 40,
          executable: 18,
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
    expect(selectionEvidence?.summary).not.toContain("候选池");
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

  it("runs cron candidates with symbol news even when no alert trigger fires", async () => {
    const auditEvents: unknown[] = [];
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
          id: "news-btc-low",
          title: "BTC market structure holds",
          currencies: ["BTC"],
          sentiment: "neutral",
          votes: {
            positive: 0,
            negative: 0,
            important: 0,
          },
        }),
      ],
      locale: "zh_CN",
      now,
      onAudit: (event) => auditEvents.push(event),
    });

    expect(runPmDecisionPipelineMock).toHaveBeenCalledTimes(1);
    const input = runPmDecisionPipelineMock.mock.calls[0]?.[0] as PmDecisionPipelineInput;
    expect(input.candidate).toMatchObject({ candidateType: "symbol", symbol: "BTC" });
    expect(input.importanceThreshold).toBe("low");
    expect(auditEvents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "candidate_considered",
          symbol: "BTC",
          hasTrigger: false,
        }),
        expect.objectContaining({
          type: "candidate_generated",
          symbol: "BTC",
        }),
      ]),
    );
    expect(auditEvents).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "candidate_skipped",
          reason: "no_trigger",
        }),
      ]),
    );
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
      newsItems: [
        newsItem(),
        newsItem({
          id: "news-sol",
          title: "SOL momentum improves",
          currencies: ["SOL"],
        }),
      ],
      locale: "zh_CN",
      now,
    });

    expect(tryAcquireLockMock).toHaveBeenCalledWith("watch:pm-decision:zh_CN:SOL", {
      ttlMs: 170 * 60_000,
      waitMs: 0,
    });
    const input = runPmDecisionPipelineMock.mock.calls[0]?.[0] as PmDecisionPipelineInput;
    expect(input.recentMarketSignals.map((signal) => signal.symbol)).toEqual(["SOL"]);
    expect(input.recentNewsEvidence.map((evidence) => evidence.symbol)).toEqual(
      expect.arrayContaining([["SOL"]]),
    );
  });

  it("emits audit events for candidates skipped by trigger and lock state", async () => {
    const auditEvents: unknown[] = [];
    tryAcquireLockMock.mockResolvedValue(null);
    const poolWithQuietCandidate = {
      ...pool(),
      opportunity: [{ symbol: "BILL", price: 0.12, change24h: 0.2, category: "opportunity" }],
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
    expect(tryAcquireLockMock).not.toHaveBeenCalled();
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
          reason: "no_news_evidence_for_symbol",
        }),
        expect.objectContaining({
          type: "candidate_skipped",
          symbol: "BILL",
          reason: "no_news_evidence_for_symbol",
        }),
      ]),
    );
  });

  it("skips an explicit symbol candidate before locking when no scoped news evidence exists", async () => {
    const auditEvents: unknown[] = [];

    const result = await triggerPmDecisionPipelineOnce({
      triggerSource: "cron",
      pool: pool(),
      newsItems: [],
      locale: "zh_CN",
      candidate: {
        candidateType: "symbol",
        candidateKey: "BTC",
        symbol: "BTC",
        displayTitle: "BTC 实时行情分析",
        executable: true,
        cadence: "event",
        score: 1,
        reasons: [],
      },
      now,
      onAudit: (event) => auditEvents.push(event),
    });

    expect(result).toBeNull();
    expect(tryAcquireLockMock).not.toHaveBeenCalled();
    expect(runPmDecisionPipelineMock).not.toHaveBeenCalled();
    expect(auditEvents).toEqual([
      expect.objectContaining({
        type: "candidate_skipped",
        symbol: "BTC",
        reason: "no_news_evidence_for_symbol",
      }),
    ]);
  });

  it("falls through to another major when macro news exists and BTC is locked", async () => {
    const auditEvents: unknown[] = [];
    tryAcquireLockMock.mockResolvedValueOnce(null).mockResolvedValueOnce({
      key: "watch:pm-decision:zh_CN:ETH",
      token: "test-token",
      acquiredAt: now,
    });
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

    expect(runPmDecisionPipelineMock).toHaveBeenCalledTimes(1);
    const input = runPmDecisionPipelineMock.mock.calls[0]?.[0] as PmDecisionPipelineInput;
    const selectedSymbol = input.candidate?.symbol;
    expect(selectedSymbol).toBeDefined();
    expect(["BTC", "ETH", "SOL"]).toContain(selectedSymbol);
    expect(selectedSymbol).not.toBe("SOL");
    expect(input.recentNewsEvidence.map((evidence) => evidence.symbol)).toContainEqual([]);
    expect(auditEvents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "candidate_considered",
          symbol: "SOL",
          hasTrigger: true,
        }),
        expect.objectContaining({
          type: "candidate_skipped",
          symbol: "SOL",
          reason: "locked",
        }),
        expect.objectContaining({
          type: "candidate_considered",
          symbol: selectedSymbol,
        }),
        expect.objectContaining({
          type: "candidate_generated",
          symbol: selectedSymbol,
        }),
      ]),
    );
  });

  it("caps user visit symbol candidates at three and emits telemetry", async () => {
    const auditEvents: unknown[] = [];
    runPmDecisionPipelineMock.mockResolvedValue(null);
    const expandedPool = {
      ...pool(),
      majors: [
        { symbol: "BTC", price: 101000, change24h: 4, category: "majors" },
        { symbol: "ETH", price: 4200, change24h: 4, category: "majors" },
        { symbol: "SOL", price: 220, change24h: 4, category: "majors" },
      ],
      trending: [
        { symbol: "HYPE", price: 34, change24h: 4, category: "trending" },
        { symbol: "XRP", price: 2.4, change24h: 4, category: "trending" },
      ],
      opportunity: [],
    } satisfies CoinPoolPayload;

    await triggerPmDecisionPipelineOnce({
      triggerSource: "user_visit_trigger",
      pool: expandedPool,
      newsItems: [],
      locale: "zh_CN",
      now,
      onAudit: (event) => auditEvents.push(event),
    });

    expect(auditEvents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "candidate_cost_cap_applied",
          candidateCount: 4,
          cappedTo: 3,
          maxResidentCandidates: 1,
          maxSymbolCandidates: 3,
        }),
      ]),
    );
    expect(runPmDecisionPipelineMock).not.toHaveBeenCalled();
    expect(tryAcquireLockMock).not.toHaveBeenCalled();
  });

  it("lets user visits rotate a quiet major when symbol coverage is still sparse", async () => {
    const auditEvents: unknown[] = [];
    const quietMajors = {
      ...pool(),
      majors: [
        { symbol: "BTC", price: 101000, change24h: 0.2, category: "majors" },
        { symbol: "ETH", price: 4200, change24h: 0.3, category: "majors" },
        { symbol: "SOL", price: 220, change24h: 0.4, category: "majors" },
      ],
      trending: [],
      opportunity: [],
    } satisfies CoinPoolPayload;

    await triggerPmDecisionPipelineOnce({
      triggerSource: "user_visit_trigger",
      pool: quietMajors,
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
          reason: "no_news_evidence_for_symbol",
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
      opportunity: [{ symbol: "BILL", price: 0.12, change24h: 18, category: "opportunity" }],
    } satisfies CoinPoolPayload;

    const outputs = await triggerPmDecisionPipelineBatch({
      triggerSource: "cron",
      pool: expandedPool,
      newsItems: [
        newsItem({ id: "news-bill", title: "BILL momentum accelerates", currencies: ["BILL"] }),
      ],
      locale: "zh_CN",
      now,
    });

    expect(outputs).toHaveLength(1);
    expect(runPmDecisionPipelineMock).toHaveBeenCalledTimes(1);
    const input = runPmDecisionPipelineMock.mock.calls[0]?.[0] as PmDecisionPipelineInput;
    expect(input.recentMarketSignals.map((signal) => signal.symbol)).toEqual(["BILL"]);
  });

  it("rotates back to a major candidate when recent-topic suppression removes the dynamic set", async () => {
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
      {
        id: "event-hype",
        ts: now - 20 * 60_000,
        visibility: "public",
        importance: "high",
        sourceTrigger: "pm_decision",
        evidenceIds: [],
        locale: "zh_CN",
        payload: {
          kind: "pm_decision",
          recordId: "record-hype",
          symbol: "HYPE",
          tradeDecision: null,
          rationaleByMember: {},
        },
      },
    ]);
    const auditEvents: unknown[] = [];

    const result = await triggerPmDecisionPipelineOnce({
      triggerSource: "user_visit_trigger",
      pool: pool(),
      newsItems: [
        newsItem({
          id: "news-btc",
          title: "BTC rotation baseline holds",
          currencies: ["BTC"],
        }),
      ],
      locale: "zh_CN",
      now,
      onAudit: (event) => auditEvents.push(event),
    });

    expect(result).not.toBeNull();
    expect(runPmDecisionPipelineMock).toHaveBeenCalledTimes(1);
    const input = runPmDecisionPipelineMock.mock.calls[0]?.[0] as PmDecisionPipelineInput;
    expect(input.candidate).toMatchObject({
      candidateType: "symbol",
      symbol: "BTC",
      candidateKey: "BTC",
    });
    expect(auditEvents).toEqual([
      expect.objectContaining({
        type: "candidate_considered",
        symbol: "BTC",
        hasTrigger: true,
      }),
      expect.objectContaining({
        type: "candidate_generated",
        symbol: "BTC",
      }),
    ]);
  });

  it("runs a resident market overview candidate with candidate lock and no symbol scoping", async () => {
    const candidate = marketOverviewCandidate({ locale: "zh_CN", now });

    await triggerPmDecisionPipelineOnce({
      triggerSource: "user_visit_trigger",
      pool: pool(),
      newsItems: [newsItem({ currencies: [] })],
      locale: "zh_CN",
      candidate,
      now,
    });

    expect(tryAcquireLockMock).toHaveBeenCalledWith(
      `watch:pm-decision:zh_CN:${candidate.candidateKey}`,
      {
        ttlMs: 170 * 60_000,
        waitMs: 0,
      },
    );
    expect(runPmDecisionPipelineMock).toHaveBeenCalledTimes(1);
    const input = runPmDecisionPipelineMock.mock.calls[0]?.[0] as PmDecisionPipelineInput;
    expect(input.candidate).toEqual(candidate);
    expect(input.recentMarketSignals.map((signal) => signal.symbol)).toEqual(["BTC", "ETH", "SOL"]);
    expect(input.recentNewsEvidence).toHaveLength(1);
  });

  it("lets admin backfill bypass the resident candidate lock explicitly", async () => {
    const candidate = marketOverviewCandidate({ locale: "zh_CN", now });
    tryAcquireLockMock.mockResolvedValue(null);

    await triggerPmDecisionPipelineOnce({
      triggerSource: "cron",
      pool: pool(),
      newsItems: [newsItem({ currencies: [] })],
      locale: "zh_CN",
      candidate,
      now,
      bypassLock: true,
    });

    expect(tryAcquireLockMock).not.toHaveBeenCalled();
    expect(runPmDecisionPipelineMock).toHaveBeenCalledTimes(1);
    const input = runPmDecisionPipelineMock.mock.calls[0]?.[0] as PmDecisionPipelineInput;
    expect(input.candidate).toEqual(candidate);
  });
});
