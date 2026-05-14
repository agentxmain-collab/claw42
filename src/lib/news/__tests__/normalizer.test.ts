import { beforeEach, describe, expect, it, vi } from "vitest";
import { normalizeNewsItem } from "@/lib/news/normalizer";
import type { NewsItem } from "@/lib/types";

const generateTextMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/llm/generateText", () => ({
  generateText: generateTextMock,
}));

function newsItem(overrides: Partial<NewsItem> = {}): NewsItem {
  return {
    id: "news-1",
    title: "Bitcoin ETF inflows rise as Ethereum gains",
    url: "https://example.com/news-1",
    source: "CoinDesk",
    currencies: [],
    sentiment: "neutral",
    publishedAt: Date.UTC(2026, 4, 13, 20, 0, 0),
    ...overrides,
  };
}

describe("normalizeNewsItem", () => {
  beforeEach(() => {
    generateTextMock.mockReset();
  });

  it("fills obvious currencies and sentiment locally before calling the LLM", async () => {
    const normalized = await normalizeNewsItem(newsItem(), "rss-coindesk");

    expect(normalized.currencies).toEqual(["BTC", "ETH"]);
    expect(normalized.sentiment).toBe("bullish");
    expect(generateTextMock).not.toHaveBeenCalled();
  });

  it("anchors broad crypto market headlines locally before calling the LLM", async () => {
    const normalized = await normalizeNewsItem(
      newsItem({
        title: "Crypto market rally accelerates as liquidity improves",
      }),
      "rss-coindesk",
    );

    expect(normalized.currencies).toEqual(["BTC"]);
    expect(normalized.sentiment).toBe("bullish");
    expect(generateTextMock).not.toHaveBeenCalled();
  });

  it("normalizes existing currency symbols locally before calling the LLM", async () => {
    const normalized = await normalizeNewsItem(
      newsItem({
        title: "Protocol update improves execution",
        currencies: [" btc ", " $eth ", "$$sol", "$"],
        sentiment: "bullish",
      }),
      "rss-coindesk",
    );

    expect(normalized.currencies).toEqual(["BTC", "ETH", "SOL"]);
    expect(generateTextMock).not.toHaveBeenCalled();
  });

  it("treats invalid existing currency values as missing instead of preserving dirty symbols", async () => {
    generateTextMock.mockResolvedValue(
      JSON.stringify({
        currencies: [],
      }),
    );

    const normalized = await normalizeNewsItem(
      newsItem({
        title: "Protocol update improves execution",
        currencies: [" $ ", "$"],
        sentiment: "bullish",
      }),
      "rss-coindesk",
    );

    expect(generateTextMock).toHaveBeenCalledTimes(1);
    expect(normalized.currencies).toEqual([]);
  });

  it("falls back to the LLM when local rules cannot infer missing fields", async () => {
    generateTextMock.mockResolvedValue(
      JSON.stringify({
        sentiment: "bearish",
        currencies: ["SOL"],
      }),
    );

    const normalized = await normalizeNewsItem(
      newsItem({
        title: "Protocol governance dispute escalates",
      }),
      "rss-coindesk",
    );

    expect(generateTextMock).toHaveBeenCalledTimes(1);
    expect(normalized.currencies).toEqual(["SOL"]);
    expect(normalized.sentiment).toBe("bearish");
  });
});
