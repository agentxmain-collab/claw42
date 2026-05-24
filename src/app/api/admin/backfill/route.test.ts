import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/admin/backfill/route";
import type { CoinPoolPayload } from "@/modules/agent-watch/types";
import type { NewsItem } from "@/lib/types";

const fetchNewsWithChainMock = vi.hoisted(() => vi.fn());
const normalizeNewsItemMock = vi.hoisted(() => vi.fn());
const getCoinPoolMock = vi.hoisted(() => vi.fn());
const triggerPmDecisionPipelineOnceMock = vi.hoisted(() => vi.fn());

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
  triggerPmDecisionPipelineOnce: triggerPmDecisionPipelineOnceMock,
}));

const now = Date.UTC(2026, 4, 24, 8, 0, 0);

function newsItem(): NewsItem {
  return {
    id: "news-1",
    title: "BTC funding stabilizes",
    url: "https://example.com/btc",
    source: "CryptoCompare",
    currencies: ["BTC"],
    sentiment: "neutral",
    publishedAt: now,
  };
}

function pool(): CoinPoolPayload {
  return {
    ts: now,
    tickers: {
      BTC: { price: 101000, change24h: 1.2 },
      ETH: { price: 3900, change24h: -0.4 },
      SOL: { price: 178, change24h: 0.3 },
      USDT: { price: 1, change24h: 0 },
    },
    majors: [{ symbol: "BTC", price: 101000, change24h: 1.2, category: "majors" }],
    trending: [],
    opportunity: [],
    source: "coinw-kline",
  };
}

describe("/api/admin/backfill", () => {
  beforeEach(() => {
    vi.setSystemTime(now);
    vi.stubEnv("CRON_SECRET", "test-cron-secret");
    fetchNewsWithChainMock.mockReset();
    normalizeNewsItemMock.mockReset();
    getCoinPoolMock.mockReset();
    triggerPmDecisionPipelineOnceMock.mockReset();

    fetchNewsWithChainMock.mockResolvedValue({
      items: [newsItem()],
      servedBy: "cryptocompare-news",
      fellBackFrom: [],
    });
    normalizeNewsItemMock.mockImplementation(async (item) => item);
    getCoinPoolMock.mockResolvedValue(pool());
    triggerPmDecisionPipelineOnceMock.mockResolvedValue({
      record: {
        id: "pm:MARKET:manual-backfill",
        candidate: {
          candidateType: "market_overview",
          candidateKey: "market_overview:utc:en_US:2026-05-24T06",
        },
        stageTrace: [
          { stageId: "analyst_inputs", status: "done" },
          { stageId: "research_lead", status: "done" },
          { stageId: "risk_lead", status: "done" },
          { stageId: "trade_decision", status: "done" },
          { stageId: "record_write", status: "done" },
          { stageId: "public_timeline", status: "done" },
        ],
      },
      publicTimelineEntry: {
        id: "timeline:pm:MARKET",
        payload: { kind: "pm_decision", candidateType: "market_overview" },
      },
    });
  });

  it("rejects requests without the cron bearer secret before side effects", async () => {
    const response = await GET(
      new NextRequest(
        "https://claw42.ai/api/admin/backfill?locale=en_US&candidateType=market_overview&trigger=force",
      ),
    );
    const payload = await response.json();

    expect(response.status).toBe(401);
    expect(payload).toEqual({ ok: false, error: "unauthorized" });
    expect(fetchNewsWithChainMock).not.toHaveBeenCalled();
    expect(getCoinPoolMock).not.toHaveBeenCalled();
    expect(triggerPmDecisionPipelineOnceMock).not.toHaveBeenCalled();
  });

  it("forces one market overview PM run for a requested locale", async () => {
    const response = await GET(
      new NextRequest(
        "https://claw42.ai/api/admin/backfill?locale=en_US&candidateType=market_overview&trigger=force",
        { headers: { authorization: "Bearer test-cron-secret" } },
      ),
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      ok: true,
      recordId: "pm:MARKET:manual-backfill",
      candidateType: "market_overview",
      locale: "en_US",
      stageTrace: {
        analyst_inputs: "done",
        research_lead: "done",
        risk_lead: "done",
        trade_decision: "done",
        record_write: "done",
        public_timeline: "done",
      },
    });
    expect(triggerPmDecisionPipelineOnceMock).toHaveBeenCalledTimes(1);
    expect(triggerPmDecisionPipelineOnceMock).toHaveBeenCalledWith(
      expect.objectContaining({
        triggerSource: "cron",
        locale: "en_US",
        partialStageUpdates: true,
        pool: expect.objectContaining({ source: "coinw-kline" }),
        newsItems: [expect.objectContaining({ id: "news-1" })],
        candidate: expect.objectContaining({
          candidateType: "market_overview",
          candidateKey: "market_overview:utc:en_US:2026-05-24T06",
          executable: false,
        }),
      }),
    );
  });

  it("returns ok=false when the forced PM run does not publish a record", async () => {
    triggerPmDecisionPipelineOnceMock.mockResolvedValueOnce(null);

    const response = await GET(
      new NextRequest(
        "https://claw42.ai/api/admin/backfill?locale=en_US&candidateType=market_overview&trigger=force",
        { headers: { authorization: "Bearer test-cron-secret" } },
      ),
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      ok: false,
      reason: "pm_pipeline_no_output",
      candidateType: "market_overview",
      locale: "en_US",
    });
  });
});
