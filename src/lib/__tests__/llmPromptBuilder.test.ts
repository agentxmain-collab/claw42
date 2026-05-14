import { describe, expect, it } from "vitest";
import { seedFromNews } from "@/lib/llmPromptBuilder";
import type { NewsItem } from "@/lib/types";

function newsItem(overrides: Partial<NewsItem> = {}): NewsItem {
  return {
    id: "news-1",
    title: "ETH protocol update improves execution",
    url: "https://example.com/news-1",
    source: "CoinDesk",
    currencies: [" $eth ", "$$sol", "$"],
    sentiment: "bullish",
    publishedAt: Date.UTC(2026, 4, 13, 20, 0, 0),
    ...overrides,
  };
}

describe("seedFromNews", () => {
  it("normalizes dirty news currencies before prompt seed creation", () => {
    const seed = seedFromNews(newsItem(), Date.UTC(2026, 4, 13, 20, 1, 0));

    expect(seed.symbols).toEqual(["ETH", "SOL"]);
  });
});
