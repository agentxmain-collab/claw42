import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/cron/strategy-replay/route";
import type { CoinPoolPayload } from "@/modules/agent-watch/types";
import type { NewsItem } from "@/lib/types";

const normalizeNewsItemMock = vi.hoisted(() => vi.fn());
const fetchNewsWithChainMock = vi.hoisted(() => vi.fn());
const tryOrchestrateNewsDebateMock = vi.hoisted(() => vi.fn());
const listNewsDebatesMock = vi.hoisted(() => vi.fn());
const getCoinPoolMock = vi.hoisted(() => vi.fn());
const adjustDebtFromReplaysMock = vi.hoisted(() => vi.fn());
const tryAcquireLockMock = vi.hoisted(() => vi.fn());
const triggerPmDecisionPipelineOnceMock = vi.hoisted(() => vi.fn());
const triggerPmDecisionPipelineBatchMock = vi.hoisted(() => vi.fn());
const readAllDecisionRecordsMock = vi.hoisted(() => vi.fn());
const resolveDecisionRecordFromPriceMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/news/normalizer", () => ({
  normalizeNewsItem: normalizeNewsItemMock,
}));

vi.mock("@/lib/news/sourceChain", () => ({
  fetchNewsWithChain: fetchNewsWithChainMock,
}));

vi.mock("@/lib/debateOrchestrator", () => ({
  tryOrchestrateNewsDebate: tryOrchestrateNewsDebateMock,
  listNewsDebates: listNewsDebatesMock,
}));

vi.mock("@/lib/marketDataCache", () => ({
  getCoinPool: getCoinPoolMock,
}));

vi.mock("@/lib/agentRelationship", () => ({
  adjustDebtFromReplays: adjustDebtFromReplaysMock,
}));

vi.mock("@/lib/strategyHistory", () => ({
  evaluateStrategy: vi.fn(),
  recordStrategyReplay: vi.fn(),
}));

vi.mock("@/lib/storage/kv-lock", () => ({
  tryAcquireLock: tryAcquireLockMock,
}));

vi.mock("@/lib/team/pmDecisionTrigger", () => ({
  triggerPmDecisionPipelineOnce: triggerPmDecisionPipelineOnceMock,
  triggerPmDecisionPipelineBatch: triggerPmDecisionPipelineBatchMock,
}));

vi.mock("@/lib/team/decisionRecordStore", () => ({
  readAllDecisionRecords: readAllDecisionRecordsMock,
}));

vi.mock("@/lib/team/decisionResolution", () => ({
  resolveDecisionRecordFromPrice: resolveDecisionRecordFromPriceMock,
}));

vi.mock("@/lib/watch/locale", () => ({
  localeFromRequestUrl: () => "zh_CN",
}));

const now = Date.UTC(2026, 4, 13, 20, 0, 0);

function newsItem(): NewsItem {
  return {
    id: "news-1",
    title: "BTC inflows rise",
    url: "https://example.com/btc",
    source: "CoinDesk",
    currencies: ["BTC"],
    sentiment: "bullish",
    publishedAt: now,
  };
}

function pool(): CoinPoolPayload {
  return {
    ts: now,
    tickers: {
      BTC: { price: 101000, change24h: 3.3 },
      ETH: { price: 4200, change24h: 0.5 },
      SOL: { price: 220, change24h: 0.2 },
      USDT: { price: 1, change24h: 0 },
    },
    majors: [{ symbol: "BTC", price: 101000, change24h: 3.3, category: "majors" }],
    trending: [],
    opportunity: [],
    source: "coinw-kline",
  };
}

describe("/api/cron/strategy-replay", () => {
  beforeEach(() => {
    vi.setSystemTime(now);
    normalizeNewsItemMock.mockReset();
    fetchNewsWithChainMock.mockReset();
    tryOrchestrateNewsDebateMock.mockReset();
    listNewsDebatesMock.mockReset();
    getCoinPoolMock.mockReset();
    adjustDebtFromReplaysMock.mockReset();
    tryAcquireLockMock.mockReset();
    triggerPmDecisionPipelineOnceMock.mockReset();
    triggerPmDecisionPipelineBatchMock.mockReset();
    readAllDecisionRecordsMock.mockReset();
    resolveDecisionRecordFromPriceMock.mockReset();

    fetchNewsWithChainMock.mockResolvedValue({
      items: [newsItem()],
      servedBy: "rss-coindesk",
      fellBackFrom: [],
    });
    normalizeNewsItemMock.mockImplementation(async (item) => item);
    tryOrchestrateNewsDebateMock.mockResolvedValue(null);
    listNewsDebatesMock.mockReturnValue([]);
    getCoinPoolMock.mockResolvedValue(pool());
    adjustDebtFromReplaysMock.mockResolvedValue(undefined);
    tryAcquireLockMock.mockResolvedValue({
      key: "cron:strategy-replay:trigger-now",
      token: "lock",
      acquiredAt: now,
    });
    triggerPmDecisionPipelineOnceMock.mockImplementation(async (input) => {
      input.onAudit?.({
        type: "candidate_considered",
        triggerSource: "user_visit_trigger",
        locale: "zh_CN",
        symbol: "BTC",
        score: 40,
        reasonCount: 2,
        hasTrigger: true,
        marketSignalIds: ["ticker:BTC"],
        newsEvidenceIds: ["ev_1"],
      });
      return {
        record: { id: "pm:BTC:test" },
        publicTimelineEntry: {},
        tradeDecision: {},
      };
    });
    readAllDecisionRecordsMock.mockResolvedValue([
      {
        id: "pm:BTC:open",
        symbol: "BTC",
        tradeDecision: { id: "trade:BTC:open" },
        resolvedOutcome: null,
      },
    ]);
    resolveDecisionRecordFromPriceMock.mockResolvedValue({
      record: { id: "pm:BTC:open", resolvedOutcome: "hit_tp" },
      resolution: { outcome: "hit_tp" },
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("rejects unauthorized cron requests before running source or PM side effects", async () => {
    vi.stubEnv("CRON_SECRET", "test-cron-secret");

    const response = await GET(new NextRequest("https://claw42.ai/api/cron/strategy-replay"));
    const payload = await response.json();

    expect(response.status).toBe(401);
    expect(payload).toEqual({ error: "unauthorized" });
    expect(fetchNewsWithChainMock).not.toHaveBeenCalled();
    expect(getCoinPoolMock).not.toHaveBeenCalled();
    expect(triggerPmDecisionPipelineOnceMock).not.toHaveBeenCalled();
    expect(triggerPmDecisionPipelineBatchMock).not.toHaveBeenCalled();
  });

  it("returns PM decision audit details for trigger=now verification", async () => {
    const response = await GET(
      new NextRequest("https://claw42.ai/api/cron/strategy-replay?trigger=now"),
    );
    const payload = await response.json();

    expect(payload.pmDecisionGenerated).toBe(true);
    expect(payload.pmDecisionAudit).toEqual([
      expect.objectContaining({
        type: "candidate_considered",
        symbol: "BTC",
        hasTrigger: true,
      }),
    ]);
    expect(payload.newsSourceHealth).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "coinw-announcements",
          unavailableReason: "planned_endpoint",
        }),
      ]),
    );
    expect(payload.resolvedPmDecisions).toBe(1);
    expect(resolveDecisionRecordFromPriceMock).toHaveBeenCalledWith(
      expect.objectContaining({ id: "pm:BTC:open" }),
      101000,
      expect.any(Number),
      undefined,
      "coinw-kline",
    );
    expect(tryAcquireLockMock).toHaveBeenCalledWith("cron:strategy-replay:trigger-now:zh_CN", {
      ttlMs: 5 * 60_000,
      waitMs: 0,
    });
  });

  it("keeps audit and source-health details out of the scheduled cron response", async () => {
    triggerPmDecisionPipelineBatchMock.mockResolvedValue([
      {
        record: { id: "pm:BTC:cron" },
        publicTimelineEntry: {},
        tradeDecision: {},
      },
    ]);

    const response = await GET(new NextRequest("https://claw42.ai/api/cron/strategy-replay"));
    const payload = await response.json();

    expect(payload.pmDecisionGenerated).toBe(true);
    expect(payload.generatedPmDecisions).toBe(1);
    expect(payload.pmDecisionAudit).toBeUndefined();
    expect(payload.newsSourceHealth).toBeUndefined();
    expect(payload.trigger).toBeNull();
    expect(payload.triggerLockAcquiredAt).toBeNull();
    expect(triggerPmDecisionPipelineOnceMock).not.toHaveBeenCalled();
    expect(triggerPmDecisionPipelineBatchMock).toHaveBeenCalledTimes(1);
  });

  it("continues resolving later PM decisions when one record write fails", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    try {
      getCoinPoolMock.mockResolvedValueOnce({
        ...pool(),
        tickers: {
          ...pool().tickers,
          ETH: { price: 4200, change24h: 0.5 },
        },
        majors: [
          ...pool().majors,
          { symbol: "ETH", price: 4200, change24h: 0.5, category: "majors" },
        ],
      });
      readAllDecisionRecordsMock.mockResolvedValueOnce([
        {
          id: "pm:BTC:open",
          symbol: "BTC",
          tradeDecision: { id: "trade:BTC:open" },
          resolvedOutcome: null,
        },
        {
          id: "pm:ETH:open",
          symbol: "ETH",
          tradeDecision: { id: "trade:ETH:open" },
          resolvedOutcome: null,
        },
      ]);
      resolveDecisionRecordFromPriceMock
        .mockRejectedValueOnce(new Error("write failed"))
        .mockResolvedValueOnce({
          record: { id: "pm:ETH:open", resolvedOutcome: "hit_tp" },
          resolution: { outcome: "hit_tp" },
        });

      const response = await GET(
        new NextRequest("https://claw42.ai/api/cron/strategy-replay?trigger=now"),
      );
      const payload = await response.json();

      expect(payload.resolvedPmDecisions).toBe(1);
      expect(resolveDecisionRecordFromPriceMock).toHaveBeenCalledTimes(2);
      expect(resolveDecisionRecordFromPriceMock).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({ id: "pm:ETH:open" }),
        4200,
        expect.any(Number),
        undefined,
        "coinw-kline",
      );
    } finally {
      warnSpy.mockRestore();
    }
  });

  it("normalizes open PM decision symbols before resolving against the CoinW pool", async () => {
    readAllDecisionRecordsMock.mockResolvedValueOnce([
      {
        id: "pm:BTC:dirty-symbol",
        symbol: " $btc ",
        tradeDecision: { id: "trade:BTC:open" },
        resolvedOutcome: null,
      },
    ]);

    const response = await GET(
      new NextRequest("https://claw42.ai/api/cron/strategy-replay?trigger=now"),
    );
    const payload = await response.json();

    expect(payload.resolvedPmDecisions).toBe(1);
    expect(resolveDecisionRecordFromPriceMock).toHaveBeenCalledWith(
      expect.objectContaining({ id: "pm:BTC:dirty-symbol" }),
      101000,
      expect.any(Number),
      undefined,
      "coinw-kline",
    );
  });

  it("falls back to trade decision symbol when the record symbol is unusable", async () => {
    readAllDecisionRecordsMock.mockResolvedValueOnce([
      {
        id: "pm:BTC:legacy-unknown-symbol",
        symbol: "UNKNOWN",
        tradeDecision: { id: "trade:BTC:open", symbol: " $btc " },
        resolvedOutcome: null,
      },
    ]);

    const response = await GET(
      new NextRequest("https://claw42.ai/api/cron/strategy-replay?trigger=now"),
    );
    const payload = await response.json();

    expect(payload.resolvedPmDecisions).toBe(1);
    expect(resolveDecisionRecordFromPriceMock).toHaveBeenCalledWith(
      expect.objectContaining({ id: "pm:BTC:legacy-unknown-symbol" }),
      101000,
      expect.any(Number),
      undefined,
      "coinw-kline",
    );
  });

  it("does not re-evaluate already manually closed PM decisions", async () => {
    readAllDecisionRecordsMock.mockResolvedValueOnce([
      {
        id: "pm:BTC:manual-close",
        symbol: "BTC",
        tradeDecision: { id: "trade:BTC:manual-close", symbol: "BTC" },
        resolvedOutcome: "manual_close",
      },
      {
        id: "pm:BTC:open",
        symbol: "BTC",
        tradeDecision: { id: "trade:BTC:open", symbol: "BTC" },
        resolvedOutcome: null,
      },
    ]);

    const response = await GET(
      new NextRequest("https://claw42.ai/api/cron/strategy-replay?trigger=now"),
    );
    const payload = await response.json();

    expect(payload.resolvedPmDecisions).toBe(1);
    expect(resolveDecisionRecordFromPriceMock).toHaveBeenCalledTimes(1);
    expect(resolveDecisionRecordFromPriceMock).toHaveBeenCalledWith(
      expect.objectContaining({ id: "pm:BTC:open" }),
      101000,
      expect.any(Number),
      undefined,
      "coinw-kline",
    );
  });
});
