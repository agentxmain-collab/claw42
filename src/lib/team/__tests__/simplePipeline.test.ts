import { readFile } from "fs/promises";
import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  canonicalDedupeKeys,
  dedupeByCanonicalNewsItem,
  MIN_TITLE_DEDUPE_CJK_LENGTH,
  MIN_TITLE_DEDUPE_LENGTH,
  runSimplePipeline,
  SIMPLE_PIPELINE_CARDS_PER_RUN,
  SIMPLE_PIPELINE_LLM_CONCURRENCY,
} from "@/lib/team/simplePipeline";
import { projectDecisionRecordToPublicEvent } from "@/lib/watch/publicTimelineProjection";
import type { NewsItem } from "@/lib/types";
import type { DecisionCandidate } from "@/lib/watch/decisionCandidate";
import type { CoinPoolPayload } from "@/modules/agent-watch/types";
import type { StrategyDecisionRecord } from "@/lib/team/strategyDecisionRecord";

const generateTextMock = vi.hoisted(() => vi.fn());
const appendDecisionRecordMock = vi.hoisted(() => vi.fn());
const saveNewsEvidenceMock = vi.hoisted(() => vi.fn((evidence) => Promise.resolve(evidence)));

vi.mock("@/lib/llm/generateText", () => ({
  generateText: generateTextMock,
}));

vi.mock("@/lib/team/decisionRecordStore", () => ({
  appendDecisionRecord: appendDecisionRecordMock,
}));

vi.mock("@/lib/news/newsEvidenceStore", () => ({
  saveNewsEvidence: saveNewsEvidenceMock,
}));

const now = Date.UTC(2026, 4, 26, 8, 0, 0);

const btcCandidate: DecisionCandidate = {
  candidateType: "symbol",
  candidateKey: "news-driven:BTC:test",
  symbol: "BTC",
  displayTitle: "BTC 实时行情分析",
  executable: true,
  cadence: "event",
  score: 95,
  reasons: [],
};

const hypeCandidate: DecisionCandidate = {
  candidateType: "symbol",
  candidateKey: "news-driven:HYPE:test",
  symbol: "HYPE",
  displayTitle: "HYPE 实时行情分析",
  executable: true,
  cadence: "event",
  score: 82,
  reasons: [],
};

function news(symbol = "BTC", overrides: Partial<NewsItem> = {}): NewsItem {
  return {
    id: `news-${symbol}`,
    title: `${symbol} futures volume expands`,
    url: `https://example.com/${symbol.toLowerCase()}`,
    source: "CoinDesk",
    currencies: [symbol],
    sentiment: "bullish",
    publishedAt: now,
    ...overrides,
  };
}

function pool(): CoinPoolPayload {
  return {
    ts: now,
    tickers: {
      BTC: { price: 101000, change24h: 2.1 },
      ETH: { price: 3800, change24h: 0.4 },
      SOL: { price: 170, change24h: -0.8 },
      USDT: { price: 1, change24h: 0 },
    },
    majors: [
      {
        symbol: "BTC",
        price: 101000,
        change24h: 2.1,
        category: "majors",
        execution: { executable: true, coinwPair: "BTC_USDT", watchOnly: false },
      },
    ],
    trending: [
      {
        symbol: "HYPE",
        price: 34,
        change24h: 9.4,
        category: "trending",
        execution: { executable: true, coinwPair: "HYPE_USDT", watchOnly: false },
      },
    ],
    opportunity: [],
    source: "coinw-kline",
  };
}

function recordsWritten() {
  return appendDecisionRecordMock.mock.calls.map((call) => call[0] as StrategyDecisionRecord);
}

function completeDecision(symbol = "BTC") {
  return JSON.stringify({
    analysisSummary: `${symbol} 成交与新闻共振，短线偏多。`,
    rationale: `${symbol} 成交与新闻共振，短线偏多。`,
    direction: "long",
    confidence: 0.76,
    entryPrice: 101000,
    stopLoss: 99000,
    takeProfit: [104000, 106000],
    positionSizing: 0.06,
    riskNote: "跌破 99000 降级。",
    invalidatesIf: `${symbol} 跌破 99000。`,
  });
}

function candidateFor(symbol: string, key = symbol): DecisionCandidate {
  return {
    ...btcCandidate,
    candidateKey: `news-driven:${symbol}:${key}`,
    symbol,
    displayTitle: `${symbol} 实时行情分析`,
  };
}

describe("runSimplePipeline", () => {
  beforeEach(() => {
    generateTextMock.mockReset();
    appendDecisionRecordMock.mockReset();
    saveNewsEvidenceMock.mockClear();
    appendDecisionRecordMock.mockResolvedValue(undefined);
    saveNewsEvidenceMock.mockImplementation((evidence) => Promise.resolve(evidence));
  });

  it("card contains newsItem + analysis + strategy", async () => {
    generateTextMock.mockResolvedValue(completeDecision("BTC"));

    const result = await runSimplePipeline({
      locale: "zh_CN",
      now,
      pool: pool(),
      newsItems: [news()],
      newsDrivenCandidates: [{ candidate: btcCandidate, newsItem: news(), symbol: "BTC" }],
    });

    expect(result.generatedRecords).toHaveLength(1);
    expect(generateTextMock).toHaveBeenCalledTimes(result.generatedRecords.length);
    expect(saveNewsEvidenceMock).toHaveBeenCalledTimes(1);
    const [record] = recordsWritten();
    expect(record.analysisSummary).toBe("BTC 成交与新闻共振，短线偏多。");
    expect(record.tradeDecision).toMatchObject({
      symbol: "BTC",
      direction: "long",
      entryPrice: 101000,
      stopLoss: 99000,
      takeProfit: [104000, 106000],
    });
    expect(record.tradeDecision?.evidenceIds[0]).toMatch(/^ev_/);
    expect(record.analystInputs[0]?.evidenceIds).toEqual(record.tradeDecision?.evidenceIds);
    const event = projectDecisionRecordToPublicEvent(record);
    if (event?.payload.kind !== "pm_decision") throw new Error("expected pm decision payload");
    expect(event.payload).toMatchObject({
      candidateType: "symbol",
      executable: true,
      analysisSummary: "BTC 成交与新闻共振，短线偏多。",
      tradeDecision: expect.objectContaining({ symbol: "BTC", direction: "long" }),
    });
  });

  it("writes executable symbol records only when the LLM returns a complete trade plan", async () => {
    generateTextMock.mockResolvedValue(completeDecision("BTC"));

    await runSimplePipeline({
      locale: "zh_CN",
      now,
      pool: pool(),
      newsItems: [news()],
      newsDrivenCandidates: [{ candidate: btcCandidate, newsItem: news(), symbol: "BTC" }],
    });

    const [record] = recordsWritten();
    expect(record.symbol).toBe("BTC");
    expect(record.tradeDecision).toMatchObject({
      symbol: "BTC",
      direction: "long",
      entryPrice: 101000,
      stopLoss: 99000,
      takeProfit: [104000, 106000],
    });
    const event = projectDecisionRecordToPublicEvent(record);
    if (event?.payload.kind !== "pm_decision") throw new Error("expected pm decision payload");
    expect(event.payload).toMatchObject({
      candidateType: "symbol",
      executable: true,
      tradeDecision: expect.objectContaining({ symbol: "BTC", direction: "long" }),
    });
  });

  it("retries on null strategy then skips", async () => {
    generateTextMock
      .mockResolvedValueOnce(
        JSON.stringify({
          analysisSummary: "HYPE 动量不足，暂不形成交易方案。",
          rationale: "HYPE 动量不足。",
          direction: "wait",
          confidence: 0.42,
        }),
      )
      .mockResolvedValueOnce(
        JSON.stringify({
          analysisSummary: "HYPE 仍未形成交易方案。",
          rationale: "HYPE 仍未形成交易方案。",
          direction: "neutral",
          confidence: 0.45,
        }),
      );

    const result = await runSimplePipeline({
      locale: "zh_CN",
      now,
      pool: pool(),
      newsItems: [news("HYPE")],
      newsDrivenCandidates: [{ candidate: hypeCandidate, newsItem: news("HYPE"), symbol: "HYPE" }],
    });

    expect(result.generatedRecords).toHaveLength(0);
    expect(result.skippedCandidates).toEqual([
      { candidateKey: hypeCandidate.candidateKey, reason: "no_strategy" },
    ]);
    expect(generateTextMock).toHaveBeenCalledTimes(2);
    expect(appendDecisionRecordMock).not.toHaveBeenCalled();
    expect(saveNewsEvidenceMock).not.toHaveBeenCalled();
  });

  it("dedupes same canonical story by URL and title keys", async () => {
    const longTitle = "Bitcoin ETF flows accelerate as BTC futures volume expands";
    const candidates = dedupeByCanonicalNewsItem([
      {
        candidate: candidateFor("BTC", "url-a"),
        newsItem: news("BTC", {
          id: "url-a",
          title: longTitle,
          url: "https://news.example.com/story?utm_source=a",
        }),
        symbol: "BTC",
      },
      {
        candidate: candidateFor("BTC", "url-b"),
        newsItem: news("BTC", {
          id: "url-b",
          title: longTitle,
          url: "https://news.example.com/story?utm_source=b",
        }),
        symbol: "BTC",
      },
      {
        candidate: candidateFor("BTC", "title-b"),
        newsItem: news("BTC", {
          id: "title-b",
          title: longTitle,
          url: "https://other.example.com/reprint",
        }),
        symbol: "BTC",
      },
    ]);

    expect(candidates).toHaveLength(1);
    expect(canonicalDedupeKeys(candidates[0].newsItem)).toEqual(
      expect.arrayContaining([
        "url:https://news.example.com/story",
        "title:bitcoin etf flows accelerate as btc futures volume expands",
      ]),
    );
  });

  it("allows multi cards same symbol different news", async () => {
    generateTextMock.mockResolvedValue(completeDecision("BTC"));

    const result = await runSimplePipeline({
      locale: "zh_CN",
      now,
      pool: pool(),
      newsItems: [],
      newsDrivenCandidates: [
        {
          candidate: candidateFor("BTC", "story-a"),
          newsItem: news("BTC", {
            id: "story-a",
            title: "Bitcoin ETF flows accelerate as BTC futures volume expands",
            url: "https://example.com/story-a",
          }),
          symbol: "BTC",
        },
        {
          candidate: candidateFor("BTC", "story-b"),
          newsItem: news("BTC", {
            id: "story-b",
            title: "Bitcoin miners increase reserves after volatility fades",
            url: "https://example.com/story-b",
          }),
          symbol: "BTC",
        },
      ],
    });

    expect(result.generatedRecords).toHaveLength(2);
    expect(recordsWritten().map((record) => record.candidate?.candidateKey)).toEqual([
      "news-driven:BTC:story-a",
      "news-driven:BTC:story-b",
    ]);
  });

  it("keeps simple pipeline LLM concurrency bounded at two", async () => {
    let active = 0;
    let maxActive = 0;
    generateTextMock.mockImplementation(async () => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await Promise.resolve();
      active -= 1;
      return completeDecision("BTC");
    });

    const result = await runSimplePipeline({
      locale: "zh_CN",
      now,
      pool: pool(),
      newsItems: [],
      newsDrivenCandidates: Array.from({ length: 5 }, (_, index) => ({
        candidate: candidateFor("BTC", `story-${index}`),
        newsItem: news("BTC", {
          id: `story-${index}`,
          title: `Bitcoin unique market update number ${index} expands futures volume`,
          url: `https://example.com/story-${index}`,
        }),
        symbol: "BTC",
      })),
    });

    expect(result.generatedRecords).toHaveLength(5);
    expect(maxActive).toBeLessThanOrEqual(SIMPLE_PIPELINE_LLM_CONCURRENCY);
  });

  it("short titles use only URL dedupe", () => {
    const shortTitle = "BTC";
    expect(MIN_TITLE_DEDUPE_LENGTH).toBe(24);
    expect(MIN_TITLE_DEDUPE_CJK_LENGTH).toBe(12);
    expect(canonicalDedupeKeys(news("BTC", { title: shortTitle }))).toEqual([
      "url:https://example.com/btc",
    ]);

    const differentUrls = dedupeByCanonicalNewsItem([
      {
        candidate: candidateFor("BTC", "short-a"),
        newsItem: news("BTC", { id: "short-a", title: shortTitle, url: "https://a.example.com" }),
        symbol: "BTC",
      },
      {
        candidate: candidateFor("BTC", "short-b"),
        newsItem: news("BTC", { id: "short-b", title: shortTitle, url: "https://b.example.com" }),
        symbol: "BTC",
      },
    ]);
    const sameUrl = dedupeByCanonicalNewsItem([
      {
        candidate: candidateFor("BTC", "short-c"),
        newsItem: news("BTC", {
          id: "short-c",
          title: shortTitle,
          url: "https://a.example.com/item?utm=1",
        }),
        symbol: "BTC",
      },
      {
        candidate: candidateFor("BTC", "short-d"),
        newsItem: news("BTC", {
          id: "short-d",
          title: shortTitle,
          url: "https://a.example.com/item?utm=2",
        }),
        symbol: "BTC",
      },
    ]);

    expect(differentUrls).toHaveLength(2);
    expect(sameUrl).toHaveLength(1);
  });

  it("exports the scheduled simple pipeline cap", () => {
    expect(SIMPLE_PIPELINE_CARDS_PER_RUN).toBe(5);
  });

  it("does not import the retired multi-step public-chatter path", async () => {
    const source = await readFile("src/lib/team/simplePipeline.ts", "utf8");
    expect(source).not.toMatch(/multiRoundPipeline|chatter|chatGuardrails|sedimentation/);
    expect(source).not.toMatch(/residentPrewarmCandidates/);
  });
});
