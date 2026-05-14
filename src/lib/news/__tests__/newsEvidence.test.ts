import { describe, expect, it } from "vitest";
import { newsItemToEvidence } from "@/lib/news/newsEvidence";
import type { NewsItem } from "@/lib/types";

function newsItem(overrides: Partial<NewsItem> = {}): NewsItem {
  return {
    id: "news-1",
    title: "Bitcoin ETF inflows rise",
    url: "https://www.coindesk.com/markets/bitcoin-etf-inflows",
    source: "CoinDesk",
    sourceDomain: "www.coindesk.com",
    currencies: ["btc", "$ETH"],
    sentiment: "bullish",
    publishedAt: Date.UTC(2026, 4, 13, 20, 0, 0),
    votes: {
      positive: 5,
      negative: 0,
      important: 6,
    },
    ...overrides,
  };
}

describe("newsItemToEvidence", () => {
  it("preserves normalized publisher domain and ticker symbols", () => {
    const evidence = newsItemToEvidence(newsItem(), "2026-05-13T20:01:00.000Z");

    expect(evidence.sourceDomain).toBe("coindesk.com");
    expect(evidence.symbol).toEqual(["BTC", "ETH"]);
  });

  it("falls back to the article URL hostname when sourceDomain is missing", () => {
    const evidence = newsItemToEvidence(
      newsItem({
        sourceDomain: undefined,
        url: "https://cointelegraph.com/news/btc-market-update",
      }),
      "2026-05-13T20:01:00.000Z",
    );

    expect(evidence.sourceDomain).toBe("cointelegraph.com");
  });

  it("deduplicates normalized symbols and drops empty currency values", () => {
    const evidence = newsItemToEvidence(
      newsItem({
        currencies: ["btc", "$$ETH", " BTC ", " ", "$"],
      }),
      "2026-05-13T20:01:00.000Z",
    );

    expect(evidence.symbol).toEqual(["BTC", "ETH"]);
  });

  it("falls back to fetchedAt when publishedAt is invalid", () => {
    const evidence = newsItemToEvidence(
      newsItem({
        publishedAt: Number.NaN,
      }),
      "2026-05-13T20:01:00.000Z",
    );

    expect(evidence.publishedAt).toBe("2026-05-13T20:01:00.000Z");
  });
});
